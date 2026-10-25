import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../lib/env';
import { validateScreenshot, storeImage } from '../../lib/storage';
import { createOrder, getProfile, getFraudInfoById } from '../../lib/db';
import { getEffectiveSettings, findPackage, availableMethods } from '../../lib/settings';
import { baSessionUser, verificationEnforced } from '../../lib/baSession';

export const prerender = false;

function backToPay(slug: string, error: string): Response {
	const url = `/pay/${slug}?error=${encodeURIComponent(error)}`;
	return new Response(null, { status: 303, headers: { Location: url } });
}

export const POST: APIRoute = async (ctx) => {
	const env = (key: string) => getEnv(ctx, key);
	let form: FormData;
	try {
		form = await ctx.request.formData();
	} catch {
		return new Response('Invalid form submission.', { status: 400 });
	}

	const slug = String(form.get('package') ?? '');
	const dbUrlEarly = getDatabaseUrl(ctx);
	if (!dbUrlEarly) {
		return backToPay(
			slug,
			'Checkout is being configured — payments are not being accepted yet. Please contact us to order.',
		);
	}
	const settings = await getEffectiveSettings(dbUrlEarly, env);
	const pkg = findPackage(settings, slug);
	if (!pkg) return new Response('Unknown package.', { status: 400 });

	// The submitted method must be one the checkout actually offers:
	// enabled in the dashboard AND fully configured. This stops
	// orders for methods that are switched off or half-filled.
	const method = String(form.get('crypto') ?? '');
	if (!(availableMethods(settings) as string[]).includes(method)) {
		return backToPay(slug, 'Please choose one of the payment methods shown on this page.');
	}

	// Identity comes from the signed-in account — the checkout no
	// longer asks for name / email / contact (they are on the
	// account). Form values remain a fallback for the legacy guest
	// path only.
	const buyer = await baSessionUser(ctx).catch(() => null);
	if (buyer && dbUrlEarly) {
		// Fraud-blocked accounts cannot place new orders.
		const fraud = await getFraudInfoById(dbUrlEarly, buyer.id).catch(() => null);
		if (fraud?.blocked_at) {
			return backToPay(
				slug,
				'This account has been blocked due to repeated fraudulent orders. Please contact us if you believe this is a mistake.',
			);
		}
	}
	if (buyer && verificationEnforced(ctx) && !buyer.emailVerified) {
		return backToPay(
			slug,
			'Please verify your email address before completing a purchase — check your inbox for the verification link.',
		);
	}
	let name = String(form.get('name') ?? '').trim();
	let email = String(form.get('email') ?? '').trim();
	let contact: string | null = String(form.get('contact') ?? '').trim() || null;
	if (buyer) {
		const profile = dbUrlEarly ? await getProfile(dbUrlEarly, buyer.id).catch(() => null) : null;
		name = profile?.full_name ?? buyer.name;
		email = buyer.email;
		if (profile) {
			contact = [profile.whatsapp, profile.telegram ? '@' + profile.telegram : '']
				.filter(Boolean)
				.join(' · ');
		}
	}
	const txHash = String(form.get('tx_hash') ?? '').trim() || null;
	const note = String(form.get('note') ?? '').trim() || null;
	if (!name) return backToPay(slug, 'Please enter your full name.');
	if (!email || !email.includes('@')) return backToPay(slug, 'Please enter a valid email address.');

	const file = form.get('screenshot');
	if (!(file instanceof File) || file.size === 0) {
		return backToPay(slug, 'Please attach your payment screenshot.');
	}

	const dbUrl = dbUrlEarly;

	const maxBytes = Number(env('MAX_UPLOAD_BYTES') ?? 5 * 1024 * 1024);
	const bytes = new Uint8Array(await file.arrayBuffer());
	const check = validateScreenshot(bytes, maxBytes);
	if (!check.ok || !check.ext || !check.type) {
		return backToPay(slug, check.error ?? 'The screenshot could not be accepted.');
	}

	const id =
		'ord_' +
		Math.random().toString(36).slice(2, 6) +
		Date.now().toString(36).slice(-6);

	// `buyer` was resolved above; the order links to their account
	// so it shows in their dashboard.

	try {
		const stored = await storeImage(env, id, bytes, check.ext, check.type);
		const network =
			method === 'USDT'
				? settings.payments.usdtNetwork
				: method === 'BTC'
					? 'Bitcoin'
					: method === 'ETH'
						? 'ERC20'
						: method;
		await createOrder(dbUrl, {
			id,
			package_slug: pkg.slug,
			package_label: `${pkg.duration} — ${pkg.devices} devices`,
			amount_usd: pkg.priceUsd,
			crypto: method,
			network,
			customer_name: name,
			email,
			contact,
			tx_hash: txHash,
			note,
			screenshot_driver: stored.driver,
			screenshot_ref: stored.ref,
			user_id: buyer?.id ?? null,
		});
	} catch (err) {
		return backToPay(slug, `Could not save your submission: ${(err as Error).message}`);
	}

	return new Response(null, { status: 303, headers: { Location: `/pay/status/${id}` } });
};
