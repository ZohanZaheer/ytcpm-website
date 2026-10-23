import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../lib/env';
import { CRYPTOS, type CryptoCode } from '../../lib/packages';
import { validateScreenshot, storeImage } from '../../lib/storage';
import { createOrder } from '../../lib/db';
import { getEffectiveSettings, findPackage } from '../../lib/settings';

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

	const crypto = String(form.get('crypto') ?? '') as CryptoCode;
	if (!CRYPTOS.includes(crypto)) return backToPay(slug, 'Please choose a payment currency (USDT, BTC or ETH).');

	const name = String(form.get('name') ?? '').trim();
	const email = String(form.get('email') ?? '').trim();
	const contact = String(form.get('contact') ?? '').trim() || null;
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

	try {
		const stored = await storeImage(env, id, bytes, check.ext, check.type);
		const network =
			crypto === 'USDT' ? settings.payments.usdtNetwork : crypto === 'BTC' ? 'Bitcoin' : 'ERC20';
		await createOrder(dbUrl, {
			id,
			package_slug: pkg.slug,
			package_label: `${pkg.duration} — ${pkg.devices} devices`,
			amount_usd: pkg.priceUsd,
			crypto,
			network,
			customer_name: name,
			email,
			contact,
			tx_hash: txHash,
			note,
			screenshot_driver: stored.driver,
			screenshot_ref: stored.ref,
		});
	} catch (err) {
		return backToPay(slug, `Could not save your submission: ${(err as Error).message}`);
	}

	return new Response(null, { status: 303, headers: { Location: `/pay/status/${id}` } });
};
