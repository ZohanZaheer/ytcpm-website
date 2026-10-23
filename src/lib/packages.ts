// License packages for YTCPM Bot — prices and terms supplied by the owner.
// Keep this file as the single source of truth for pricing: the pricing
// page and the payment pages both read from here.

export interface LicensePackage {
	slug: string;
	duration: string;
	devices: number;
	priceUsd: number;
	/** "Save $X" note exactly as supplied, if any. */
	saveNote?: string;
	popular?: boolean;
	/** Hidden from the pricing page and checkout when false. Default true. */
	active?: boolean;
}

export const LICENSE_PACKAGES: LicensePackage[] = [
	// 1 month
	{ slug: '1-month-200', duration: '1 Month License', devices: 200, priceUsd: 500 },
	{ slug: '1-month-500', duration: '1 Month License', devices: 500, priceUsd: 1150, saveNote: 'Save $100' },
	// 6 months
	{ slug: '6-months-200', duration: '6 Months License', devices: 200, priceUsd: 2500, saveNote: 'Save $500' },
	{ slug: '6-months-500', duration: '6 Months License', devices: 500, priceUsd: 5000, saveNote: 'Save $2,500', popular: true },
	// 12 months
	{ slug: '12-months-100', duration: '12 Months License', devices: 100, priceUsd: 2400, saveNote: 'Save $600' },
	{ slug: '12-months-200', duration: '12 Months License', devices: 200, priceUsd: 4500, saveNote: 'Save $1,500' },
	{ slug: '12-months-500', duration: '12 Months License', devices: 500, priceUsd: 8000, saveNote: 'Save $7,000' },
	// Lifetime
	{ slug: 'lifetime-200', duration: 'Lifetime License', devices: 200, priceUsd: 10000 },
	{ slug: 'lifetime-500', duration: 'Lifetime License', devices: 500, priceUsd: 20000 },
];

export const DURATION_ORDER = ['1 Month License', '6 Months License', '12 Months License', 'Lifetime License'];

export function getPackage(slug: string): LicensePackage | undefined {
	return LICENSE_PACKAGES.find((p) => p.slug === slug);
}

export function formatUsd(n: number): string {
	return '$' + n.toLocaleString('en-US');
}

export type CryptoCode = 'USDT' | 'BTC' | 'ETH';
export const CRYPTOS: CryptoCode[] = ['USDT', 'BTC', 'ETH'];
