import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { getEffectiveSettings, savePackages } from '../../../lib/settings';
import { recordSlugRename } from '../../../lib/db';
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
	// Ensures the packages table is seeded before edits; the current
	// list is also how renames are detected (origSlug[i] vs slug[i]).
	const before = await getEffectiveSettings(dbUrl, env);
	const beforeSlugs = new Set(before.packages.map((p) => p.slug));

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
	const renames: { from: string; to: string }[] = [];
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
		// Link name: editable in the dashboard. A typed name is
		// normalized to URL form; a blank one is generated from the
		// duration + devices as before. A typed name that collides
		// with another package is an error (never silently changed).
		const rawSlug = (row.slug ?? '').trim();
		let slug: string;
		if (rawSlug) {
			slug = slugify(rawSlug);
			if (!slug) {
				return new Response(null, {
					status: 303,
					headers: { Location: '/admin/packages?error=' + encodeURIComponent(`Row ${idx + 1}: the link name may only contain letters, numbers and hyphens.`) },
				});
			}
			if (usedSlugs.has(slug)) {
				return new Response(null, {
					status: 303,
					headers: { Location: '/admin/packages?error=' + encodeURIComponent(`Row ${idx + 1}: link name "${slug}" is already used by another package.`) },
				});
			}
		} else {
			slug = slugify(`${duration}-${devices}`) || `package-${idx + 1}`;
			if (usedSlugs.has(slug)) slug = `${slug}-${idx + 1}`;
		}
		usedSlugs.add(slug);
		// A rename is an existing package (origSlug) saved under a
		// different link name — recorded after the save so the old
		// link keeps forwarding to the new one.
		const origSlug = (row.origSlug ?? '').trim();
		if (origSlug && origSlug !== slug && beforeSlugs.has(origSlug)) {
			renames.push({ from: origSlug, to: slug });
		}
		// Duration in days drives license expiry in the customer
		// dashboard; empty means lifetime (never expires).
		const daysRaw = (row.days ?? '').trim();
		const durationDays = daysRaw === '' ? null : Math.round(Number(daysRaw));
		if (durationDays !== null && (!Number.isFinite(durationDays) || durationDays <= 0)) {
			return new Response(null, {
				status: 303,
				headers: { Location: '/admin/packages?error=' + encodeURIComponent(`Row ${idx + 1}: duration days must be a positive number, or empty for lifetime.`) },
			});
		}
		const pkg: LicensePackage = {
			slug,
			duration,
			durationDays,
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

	await savePackages(dbUrl, packages);
	for (const r of renames) {
		try {
			await recordSlugRename(dbUrl, r.from, r.to);
		} catch (err) {
			// The packages themselves are saved; a failed redirect only
			// means the old link stops forwarding. Surface it in logs.
			console.error('recordSlugRename failed', r, err);
		}
	}
	return new Response(null, { status: 303, headers: { Location: '/admin/packages?saved=1' } });
};
