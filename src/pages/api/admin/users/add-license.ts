import type { APIRoute } from 'astro';
import { getDatabaseUrl, getEnv } from '../../../../lib/env';
import { isAdminRequest } from '../../../../lib/auth';
import { createOrder, getAuthUserById, getProfile, setOrderStatus } from '../../../../lib/db';
import { findPackage, getEffectiveSettings } from '../../../../lib/settings';

export const prerender = false;

// Admin assigns a license to a customer directly (no checkout): a
// confirmed order is created for the chosen package, starting today.
// Bot credentials are then assigned from the user page (the usual
// Bot Licenses flow) before the customer can see them.
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized', { status: 401 });
	const dbUrl = getDatabaseUrl(ctx);
	const form = await ctx.request.formData().catch(() => null);
	const userId = String(form?.get('user_id') ?? '');
	const slug = String(form?.get('package') ?? '');
	const back = (param: 'msg' | 'error', code: string) =>
		new Response(null, {
			status: 303,
			headers: { Location: `/admin/users/${userId}?${param}=` + code },
		});
	if (!dbUrl || !userId) return new Response('Bad request.', { status: 400 });
	try {
		const user = await getAuthUserById(dbUrl, userId);
		if (!user) return new Response('Unknown user.', { status: 404 });
		const settings = await getEffectiveSettings(dbUrl, (k) => getEnv(ctx, k));
		const pkg = findPackage(settings, slug);
		if (!pkg) return back('error', 'package');
		const profile = await getProfile(dbUrl, userId).catch(() => null);
		const contact = profile
			? [profile.whatsapp, profile.telegram ? '@' + profile.telegram : ''].filter(Boolean).join(' · ')
			: null;
		const id =
			'ord_' + Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-6);
		await createOrder(dbUrl, {
			id,
			package_slug: pkg.slug,
			package_label: `${pkg.duration} — ${pkg.devices} devices`,
			amount_usd: pkg.priceUsd,
			crypto: 'USDT',
			network: settings.payments.usdtNetwork,
			customer_name: profile?.full_name ?? user.name,
			email: user.email,
			contact,
			tx_hash: null,
			note: 'Added by admin (no online payment).',
			screenshot_driver: 'none',
			screenshot_ref: '',
			user_id: user.id,
		});
		await setOrderStatus(dbUrl, id, 'confirmed');
		return back('msg', 'license-added');
	} catch {
		return back('error', 'server');
	}
};
