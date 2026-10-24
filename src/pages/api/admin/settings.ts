import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { getEffectiveSettings, saveSiteSettings } from '../../../lib/settings';
import { isAdminRequest } from '../../../lib/auth';

export const prerender = false;

// Save payment + download settings from the admin dashboard.
// Empty text fields keep the current effective value (env/config
// fallback), so the admin only overrides what they actually change —
// EXCEPT the BTC/ETH addresses, where empty means "hide this currency
// at checkout", exactly as the settings form labels say.
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized.', { status: 401 });
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });

	const form = await ctx.request.formData();
	const env = (key: string) => getEnv(ctx, key);
	const current = await getEffectiveSettings(dbUrl, env);

	const get = (name: string) => String(form.get(name) ?? '').trim();
	const set = (currentValue: string, name: string) => {
		const v = get(name);
		return v !== '' ? v : currentValue;
	};

	const next = {
		payments: {
			usdtAddress: set(current.payments.usdtAddress, 'usdtAddress'),
			usdtNetwork: get('usdtNetwork') === 'ERC20' ? 'ERC20' : 'TRC20',
			btcAddress: get('btcAddress'),
			ethAddress: get('ethAddress'),
		},
		download: {
			url: set(current.download.url, 'downloadUrl'),
			packageName: set(current.download.packageName, 'packageName'),
			sizeLabel: set(current.download.sizeLabel, 'sizeLabel'),
			version: set(current.download.version, 'version'),
			sha256: set(current.download.sha256, 'sha256'),
		},
		lockout: (() => {
			// Numbers are clamped again in mergeSettings; invalid input
			// keeps the current value.
			const num = (name: string, fallback: number) => {
				const n = Number(get(name));
				return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
			};
			return {
				maxAttempts: num('lockoutMaxAttempts', current.lockout.maxAttempts),
				firstHours: num('lockoutFirstHours', current.lockout.firstHours),
				secondHours: num('lockoutSecondHours', current.lockout.secondHours),
				thirdDays: num('lockoutThirdDays', current.lockout.thirdDays),
			};
		})(),
		packages: current.packages,
	};

	await saveSiteSettings(dbUrl, next);
	return new Response(null, { status: 303, headers: { Location: '/admin/settings?saved=1' } });
};
