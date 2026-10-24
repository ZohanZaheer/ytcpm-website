import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { baSessionUser } from '../../../lib/baSession';
import { updateProfile, createProfile, getProfile, profileFieldTaken } from '../../../lib/db';
import { validateProfileUpdate } from '../../../lib/profile';

export const prerender = false;

function backTo(code: string): Response {
	return new Response(null, {
		status: 303,
		headers: { Location: '/account/profile?saved=' + code },
	});
}

// Update the signed-in customer's profile details. Username and
// email are fixed at registration; WhatsApp and Telegram stay
// unique across accounts.
export const POST: APIRoute = async (ctx) => {
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return backTo('error');
	try {
		const user = await baSessionUser(ctx);
		if (!user) return ctx.redirect('/login?next=/account/profile');
		const form = await ctx.request.formData().catch(() => null);
		if (!form) return backTo('error');
		const raw: Record<string, string> = {};
		for (const k of ['fullName', 'country', 'state', 'city', 'address', 'zip', 'whatsapp', 'telegram']) {
			raw[k] = String(form.get(k) ?? '');
		}
		const { values, error } = validateProfileUpdate(raw);
		if (!values) return backTo(error ?? 'error');
		if (await profileFieldTaken(dbUrl, 'whatsapp', values.whatsapp, user.id)) return backTo('whatsapp-taken');
		if (values.telegram && (await profileFieldTaken(dbUrl, 'telegram', values.telegram, user.id)))
			return backTo('telegram-taken');
		// Accounts created before profiles existed have no row yet —
		// their first save creates it (with a generated username).
		const existing = await getProfile(dbUrl, user.id);
		if (!existing) {
			let username =
				user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 18) || 'customer';
			if (await profileFieldTaken(dbUrl, 'username', username)) {
				username = username.slice(0, 14) + Math.random().toString(36).slice(2, 6);
			}
			await createProfile(dbUrl, {
				user_id: user.id,
				username,
				full_name: values.fullName,
				country: values.country,
				state: values.state,
				city: values.city,
				address: values.address,
				zip: values.zip,
				whatsapp: values.whatsapp,
				telegram: values.telegram,
			});
			return backTo('1');
		}
		await updateProfile(dbUrl, user.id, {
			full_name: values.fullName,
			country: values.country,
			state: values.state,
			city: values.city,
			address: values.address,
			zip: values.zip,
			whatsapp: values.whatsapp,
			telegram: values.telegram,
		});
		return backTo('1');
	} catch {
		return backTo('error');
	}
};
