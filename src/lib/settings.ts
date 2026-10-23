// Effective site settings: values saved from the admin dashboard
// (Postgres `site_settings`, key "site") override the built-in defaults
// and the environment variables. Public pages and APIs read settings
// through here so dashboard edits take effect without a redeploy.

import { LICENSE_PACKAGES, type LicensePackage } from './packages';
import { getSetting, setSetting } from './db';

export interface SiteSettings {
	payments: {
		usdtAddress: string;
		usdtNetwork: string;
		btcAddress: string;
		ethAddress: string;
	};
	download: {
		url: string;
		packageName: string;
		sizeLabel: string;
		version: string;
		sha256: string;
	};
	packages: LicensePackage[];
}

type EnvGetter = (key: string) => string | undefined;

export function defaultSettings(env: EnvGetter): SiteSettings {
	return {
		payments: {
			usdtAddress: env('PAYMENT_USDT_ADDRESS') ?? '',
			usdtNetwork: env('PAYMENT_USDT_NETWORK') ?? 'TRC20',
			btcAddress: env('PAYMENT_BTC_ADDRESS') ?? '',
			ethAddress: env('PAYMENT_ETH_ADDRESS') ?? '',
		},
		download: {
			url: '/YoutubeCPM.zip',
			packageName: 'YoutubeCPM.zip',
			sizeLabel: '17.0 MB',
			version: '3.0.4',
			sha256: '97e5f3ebffb3b573a3990ab6a969f6204b2c5dcaab08a26415697d38a4deef6f',
		},
		packages: LICENSE_PACKAGES,
	};
}

function nonEmpty(v: unknown): v is string {
	return typeof v === 'string' && v.trim() !== '';
}

export function mergeSettings(base: SiteSettings, stored: Partial<SiteSettings> | null): SiteSettings {
	if (!stored) return base;
	const out: SiteSettings = {
		payments: { ...base.payments },
		download: { ...base.download },
		packages: base.packages,
	};
	if (stored.payments) {
		// Once settings have been saved from the dashboard, its payment
		// addresses are authoritative — including an intentionally empty
		// BTC/ETH address (which hides that currency at checkout). The
		// dashboard form always shows the effective values, so what the
		// admin sees is exactly what gets saved.
		if (typeof stored.payments.usdtAddress === 'string') out.payments.usdtAddress = stored.payments.usdtAddress;
		if (nonEmpty(stored.payments.usdtNetwork)) out.payments.usdtNetwork = stored.payments.usdtNetwork;
		if (typeof stored.payments.btcAddress === 'string') out.payments.btcAddress = stored.payments.btcAddress;
		if (typeof stored.payments.ethAddress === 'string') out.payments.ethAddress = stored.payments.ethAddress;
	}
	if (stored.download) {
		if (nonEmpty(stored.download.url)) out.download.url = stored.download.url;
		if (nonEmpty(stored.download.packageName)) out.download.packageName = stored.download.packageName;
		if (nonEmpty(stored.download.sizeLabel)) out.download.sizeLabel = stored.download.sizeLabel;
		if (nonEmpty(stored.download.version)) out.download.version = stored.download.version;
		if (nonEmpty(stored.download.sha256)) out.download.sha256 = stored.download.sha256;
	}
	if (Array.isArray(stored.packages) && stored.packages.length > 0) {
		out.packages = stored.packages;
	}
	return out;
}

let cache: { at: number; value: SiteSettings } | null = null;
const CACHE_MS = 20_000;

/** Effective settings. Falls back to defaults when the DB is unreachable. */
export async function getEffectiveSettings(
	dbUrl: string | undefined,
	env: EnvGetter,
): Promise<SiteSettings> {
	const base = defaultSettings(env);
	if (!dbUrl) return base;
	if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
	try {
		const stored = await getSetting<Partial<SiteSettings>>(dbUrl, 'site');
		const merged = mergeSettings(base, stored);
		cache = { at: Date.now(), value: merged };
		return merged;
	} catch {
		return base;
	}
}

export async function saveSiteSettings(
	dbUrl: string,
	settings: SiteSettings,
): Promise<void> {
	await setSetting(dbUrl, 'site', settings);
	cache = null;
}

export function findPackage(settings: SiteSettings, slug: string): LicensePackage | undefined {
	return settings.packages.find((p) => p.slug === slug && p.active !== false);
}

export function activePackages(settings: SiteSettings): LicensePackage[] {
	return settings.packages.filter((p) => p.active !== false);
}
