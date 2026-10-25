// Effective site settings: values saved from the admin dashboard
// (Postgres `site_settings`, key "site") override the built-in
// defaults. Public pages and APIs read settings through here so
// dashboard edits take effect without a redeploy.
//
// Owner's rule for PAYMENT values (addresses, methods, PayPal email,
// Stripe link): they come from the DATABASE only — never from the
// environment or runtime secrets. Secrets and keys (DATABASE_URL,
// ETHERSCAN_API_KEY, tokens) are the opposite: env/secrets only.

import { LICENSE_PACKAGES, type LicensePackage } from './packages';
import {
	getSetting,
	setSetting,
	listPackageRows,
	replacePackageRows,
	type PackageRow,
} from './db';

export interface SiteSettings {
	payments: {
		usdtAddress: string;
		usdtNetwork: string;
		btcAddress: string;
		ethAddress: string;
		/** Checkout visibility switches. A method is offered at
		 * checkout only when it is enabled here AND its value is
		 * filled in (see availableMethods). */
		usdtEnabled: boolean;
		btcEnabled: boolean;
		ethEnabled: boolean;
		paypalEnabled: boolean;
		/** PayPal email the customer sends the payment to. */
		paypalEmail: string;
		stripeEnabled: boolean;
		/** Stripe Payment Link URL (created in the Stripe dashboard);
		 * the customer pays on Stripe's page, then submits proof here. */
		stripeLink: string;
	};
	download: {
		url: string;
		packageName: string;
		sizeLabel: string;
		version: string;
		sha256: string;
	};
	/** Login lockout: after maxAttempts wrong passwords the account
	 * locks; the lock length grows per lockout on the same day
	 * (1st: firstHours, 2nd: secondHours, 3rd+: thirdDays). */
	lockout: {
		maxAttempts: number;
		firstHours: number;
		secondHours: number;
		thirdDays: number;
	};
	packages: LicensePackage[];
}

type EnvGetter = (key: string) => string | undefined;

export function defaultSettings(_env: EnvGetter): SiteSettings {
	return {
		// Payment values are intentionally NOT read from the
		// environment (see the owner's rule at the top of this file):
		// until the dashboard saves them, every method is empty/off
		// and checkout shows its "being configured" notice.
		payments: {
			usdtAddress: '',
			usdtNetwork: 'TRC20',
			btcAddress: '',
			ethAddress: '',
			usdtEnabled: false,
			btcEnabled: false,
			ethEnabled: false,
			paypalEnabled: false,
			paypalEmail: '',
			stripeEnabled: false,
			stripeLink: '',
		},
		download: {
			url: '/YoutubeCPM.zip',
			packageName: 'YoutubeCPM.zip',
			sizeLabel: '17.0 MB',
			version: '3.0.4',
			sha256: '97e5f3ebffb3b573a3990ab6a969f6204b2c5dcaab08a26415697d38a4deef6f',
		},
		lockout: {
			maxAttempts: 3,
			firstHours: 1,
			secondHours: 12,
			thirdDays: 7,
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
		lockout: { ...base.lockout },
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
		// Visibility switches. Settings saved before the switches
		// existed have no boolean stored: for crypto, derive it from
		// whether an address is filled in, so the checkout keeps
		// behaving exactly as it did (address present = shown).
		const boolOr = (v: unknown, fallback: boolean): boolean =>
			typeof v === 'boolean' ? v : fallback;
		out.payments.usdtEnabled = boolOr(stored.payments.usdtEnabled, out.payments.usdtAddress.trim() !== '');
		out.payments.btcEnabled = boolOr(stored.payments.btcEnabled, out.payments.btcAddress.trim() !== '');
		out.payments.ethEnabled = boolOr(stored.payments.ethEnabled, out.payments.ethAddress.trim() !== '');
		out.payments.paypalEnabled = boolOr(stored.payments.paypalEnabled, false);
		if (typeof stored.payments.paypalEmail === 'string') out.payments.paypalEmail = stored.payments.paypalEmail;
		out.payments.stripeEnabled = boolOr(stored.payments.stripeEnabled, false);
		if (typeof stored.payments.stripeLink === 'string') out.payments.stripeLink = stored.payments.stripeLink;
	}
	if (stored.download) {
		if (nonEmpty(stored.download.url)) out.download.url = stored.download.url;
		if (nonEmpty(stored.download.packageName)) out.download.packageName = stored.download.packageName;
		if (nonEmpty(stored.download.sizeLabel)) out.download.sizeLabel = stored.download.sizeLabel;
		if (nonEmpty(stored.download.version)) out.download.version = stored.download.version;
		if (nonEmpty(stored.download.sha256)) out.download.sha256 = stored.download.sha256;
	}
	if (stored.lockout) {
		const num = (v: unknown, min: number, max: number): number | null => {
			const n = typeof v === 'number' ? v : Number(v);
			return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
		};
		const maxAttempts = num(stored.lockout.maxAttempts, 1, 10);
		if (maxAttempts !== null) out.lockout.maxAttempts = maxAttempts;
		const firstHours = num(stored.lockout.firstHours, 1, 720);
		if (firstHours !== null) out.lockout.firstHours = firstHours;
		const secondHours = num(stored.lockout.secondHours, 1, 720);
		if (secondHours !== null) out.lockout.secondHours = secondHours;
		const thirdDays = num(stored.lockout.thirdDays, 1, 30);
		if (thirdDays !== null) out.lockout.thirdDays = thirdDays;
	}
	if (Array.isArray(stored.packages) && stored.packages.length > 0) {
		out.packages = stored.packages;
	}
	return out;
}

let cache: { at: number; value: SiteSettings } | null = null;
const CACHE_MS = 60_000;

/**
 * Duration in days for a package whose days were never recorded —
 * packages saved by older code (settings JSON) have no durationDays.
 * Inferred from the label so existing licenses still expire correctly;
 * null stays lifetime.
 */
export function inferDurationDays(durationLabel: string): number | null {
	const l = durationLabel.toLowerCase();
	if (l.includes('lifetime')) return null;
	const months = l.match(/(\d+)\s*months?/);
	if (months) {
		const n = Number(months[1]);
		return n >= 12 ? Math.round((n / 12) * 365) : n * 30;
	}
	const years = l.match(/(\d+)\s*years?/);
	if (years) return Number(years[1]) * 365;
	const days = l.match(/(\d+)\s*days?/);
	if (days) return Number(days[1]);
	return null;
}

function rowToPackage(r: PackageRow): LicensePackage {
	return {
		slug: r.slug,
		duration: r.duration_label,
		durationDays: r.duration_days,
		devices: r.devices,
		priceUsd: r.price_usd,
		saveNote: r.save_note ?? undefined,
		popular: r.popular || undefined,
		active: r.active,
	};
}

export function packageToRow(p: LicensePackage, sort: number): PackageRow {
	return {
		slug: p.slug,
		duration_label: p.duration,
		// Legacy package objects (from the old settings JSON) may lack
		// durationDays entirely — infer those; an explicit null from
		// the admin editor means lifetime and is kept.
		duration_days:
			(p as { durationDays?: number | null }).durationDays === undefined
				? inferDurationDays(p.duration)
				: p.durationDays,
		devices: p.devices,
		price_usd: p.priceUsd,
		save_note: p.saveNote?.trim() ? p.saveNote.trim() : null,
		popular: !!p.popular,
		active: p.active !== false,
		sort,
	};
}

// Packages live in their own table. The first time the table is seen
// empty it is seeded from whatever the settings JSON / defaults hold
// (a marker row in site_settings records that seeding happened, so an
// admin can still empty the list deliberately afterwards).
const PACKAGES_SEEDED_KEY = 'packages_seeded_v1';

async function packagesFromTable(dbUrl: string, fallback: LicensePackage[]): Promise<LicensePackage[]> {
	const rows = await listPackageRows(dbUrl);
	if (rows.length > 0) {
		// Self-heal rows seeded from legacy data without duration days.
		let healed = false;
		const fixed = rows.map((r) => {
			if (r.duration_days === null && !r.duration_label.toLowerCase().includes('lifetime')) {
				const inferred = inferDurationDays(r.duration_label);
				if (inferred !== null) {
					healed = true;
					return { ...r, duration_days: inferred };
				}
			}
			return r;
		});
		if (healed) {
			try {
				await replacePackageRows(dbUrl, fixed);
			} catch {
				// Display still uses the healed values below.
			}
			return fixed.map(rowToPackage);
		}
		return rows.map(rowToPackage);
	}
	const seeded = await getSetting<boolean>(dbUrl, PACKAGES_SEEDED_KEY);
	if (seeded) return [];
	await replacePackageRows(dbUrl, fallback.map((p, i) => packageToRow(p, i)));
	await setSetting(dbUrl, PACKAGES_SEEDED_KEY, true);
	return fallback;
}

/** Effective settings. Falls back to defaults when the DB is unreachable. */
/** Does this customer currently hold an ACTIVE license (a confirmed
 * order that has not expired)? Drives the Support entry points —
 * they are only shown while a license is active. */
export async function userHasActiveLicense(
	dbUrl: string | null,
	userId: string,
	email: string,
	env: EnvGetter,
): Promise<boolean> {
	if (!dbUrl) return false;
	try {
		const { listOrdersForUser } = await import('./db');
		const settings = await getEffectiveSettings(dbUrl, env);
		const orders = await listOrdersForUser(dbUrl, userId, email);
		const now = Date.now();
		return orders.some((o) => {
			if (o.status !== 'confirmed') return false;
			const pkg = settings.packages.find((p) => p.slug === o.package_slug);
			if (!pkg || pkg.durationDays == null) return true; // lifetime (or unknown package treated as lifetime legacy)
			const expires = new Date(o.updated_at).getTime() + pkg.durationDays * 86400000;
			return now <= expires;
		});
	} catch {
		return false;
	}
}

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
		try {
			merged.packages = await packagesFromTable(dbUrl, merged.packages);
		} catch {
			// Packages table unavailable — keep the JSON/default list.
		}
		cache = { at: Date.now(), value: merged };
		return merged;
	} catch {
		return base;
	}
}

/** Save the package list to its table and drop the settings cache. */
export async function savePackages(dbUrl: string, packages: LicensePackage[]): Promise<void> {
	await replacePackageRows(dbUrl, packages.map((p, i) => packageToRow(p, i)));
	await setSetting(dbUrl, PACKAGES_SEEDED_KEY, true);
	cache = null;
}

export async function saveSiteSettings(
	dbUrl: string,
	settings: SiteSettings,
): Promise<void> {
	await setSetting(dbUrl, 'site', settings);
	cache = null;
}

/** Every payment method the checkout can offer. A method is
 * available only when it is enabled in the dashboard AND its value
 * is complete — a disabled or half-filled method never appears. */
export type PaymentMethod = 'USDT' | 'BTC' | 'ETH' | 'PayPal' | 'Stripe';

export function availableMethods(s: SiteSettings): PaymentMethod[] {
	const p = s.payments;
	const filled = (v: string) => v.trim() !== '';
	const out: PaymentMethod[] = [];
	if (p.usdtEnabled && filled(p.usdtAddress)) out.push('USDT');
	if (p.btcEnabled && filled(p.btcAddress)) out.push('BTC');
	if (p.ethEnabled && filled(p.ethAddress)) out.push('ETH');
	if (p.paypalEnabled && filled(p.paypalEmail) && p.paypalEmail.includes('@')) out.push('PayPal');
	if (p.stripeEnabled && filled(p.stripeLink) && p.stripeLink.startsWith('https://')) out.push('Stripe');
	return out;
}

export function findPackage(settings: SiteSettings, slug: string): LicensePackage | undefined {
	return settings.packages.find((p) => p.slug === slug && p.active !== false);
}

export function activePackages(settings: SiteSettings): LicensePackage[] {
	return settings.packages.filter((p) => p.active !== false);
}
