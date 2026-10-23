import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { getEffectiveSettings, saveSiteSettings } from '../../../lib/settings';
import { isAdminRequest } from '../../../lib/auth';
import type { LicensePackage } from '../../../lib/packages';

export const prerender = false;

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

// Save the license-package list from the admin dashboard editor.
// Form fields are indexed: slug[i], duration[i], devices[i], price[i],
// saveNote[i], popular[i], active[i], delete[i].
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized.', { status: 401 });
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });

	const form = await ctx.request.formData();
	const env = (key: string) => getEnv(ctx, key);
	const current = await getEffectiveSettings(dbUrl, env);

	const rows = new Map<number, Record<string, string>>();
	for (const [key, value] of form.entries()) {
		const m = key.match(/^([a-zA-Z]+)\[(\d+)\]$/);
		if (!m) continue;
		const idx = Number(m[2]);
		if (!rows.has(idx)) rows.set(idx, {});
		rows.get(idx)![m[1]] = String(value);
	}

	const packages: LicensePackage[] = [];
	const usedSlugs = new Set<string>();
	for (const idx of [...rows.keys()].sort((a, b) => a - b)) {
		const row = rows.get(idx)!;
		if (row.delete === 'on' || row.delete === '1') continue;
		const duration = (row.duration ?? '').trim();
		const devices = Number(row.devices);
		const priceUsd = Number(row.price);
		if (!duration || !Number.isFinite(devices) || devices <= 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
			return new Response(null, {
				status: 303,
				headers: { Location: '/admin/packages?error=' + encodeURIComponent(`Row ${idx + 1}: duration, devices and price are required and must be valid numbers.`) },
			});
		}
		let slug = (row.slug ?? '').trim();
		if (!slug) slug = slugify(`${duration}-${devices}`) || `package-${idx + 1}`;
		if (usedSlugs.has(slug)) slug = `${slug}-${idx + 1}`;
		usedSlugs.add(slug);
		const pkg: LicensePackage = {
			slug,
			duration,
			devices: Math.round(devices),
			priceUsd: Math.round(priceUsd),
			active: row.active === 'on' || row.active === '1',
		};
		if ((row.saveNote ?? '').trim()) pkg.saveNote = row.saveNote.trim();
		if (row.popular === 'on' || row.popular === '1') pkg.popular = true;
		packages.push(pkg);
	}
	if (packages.length === 0) {
		return new Response(null, {
			status: 303,
			headers: { Location: '/admin/packages?error=' + encodeURIComponent('At least one package is required.') },
		});
	}

	await saveSiteSettings(dbUrl, { ...current, packages });
	return new Response(null, { status: 303, headers: { Location: '/admin/packages?saved=1' } });
};
