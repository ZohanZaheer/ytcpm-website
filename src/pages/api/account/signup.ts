import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { authForRequest } from '../../../lib/baSession';
import { ensureSchema, getAuthUserByEmail, createProfile, profileFieldTaken } from '../../../lib/db';
import { validateRegistration } from '../../../lib/profile';

export const prerender = false;

function backTo(code: string): Response {
	return new Response(null, { status: 303, headers: { Location: '/signup?error=' + code } });
}

// Customer registration: validates every field, checks the unique
// values (email, username, WhatsApp, Telegram) against the database
// FIRST so the customer gets a clear "already registered" message,
// then creates the better-auth account (which also sends the email
// verification link when an email provider is configured) and the
// profile row.
export const POST: APIRoute = async (ctx) => {
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return backTo('server');
	const form = await ctx.request.formData().catch(() => null);
	if (!form) return backTo('server');
	const raw: Record<string, string> = {};
	for (const k of ['username', 'email', 'password', 'fullName', 'country', 'state', 'city', 'address', 'zip', 'whatsapp', 'telegram']) {
		raw[k] = String(form.get(k) ?? '');
	}
	const { values, error } = validateRegistration(raw);
	if (!values) return backTo(error ?? 'server');

	try {
		await ensureSchema(dbUrl);
		if (await getAuthUserByEmail(dbUrl, values.email)) return backTo('email-taken');
		if (await profileFieldTaken(dbUrl, 'username', values.username)) return backTo('username-taken');
		if (await profileFieldTaken(dbUrl, 'whatsapp', values.whatsapp)) return backTo('whatsapp-taken');
		if (values.telegram && (await profileFieldTaken(dbUrl, 'telegram', values.telegram)))
			return backTo('telegram-taken');

		const auth = await authForRequest(ctx);
		if (!auth) return backTo('server');
		const res = await auth.api.signUpEmail({
			body: { name: values.fullName, email: values.email, password: values.password },
			asResponse: true,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			if (/exist|already/i.test(text)) return backTo('email-taken');
			return backTo('server');
		}
		// Identify the created account and attach the profile row.
		const created = await getAuthUserByEmail(dbUrl, values.email);
		if (!created) return backTo('server');
		await createProfile(dbUrl, {
			user_id: created.id,
			username: values.username,
			full_name: values.fullName,
			country: values.country,
			state: values.state,
			city: values.city,
			address: values.address,
			zip: values.zip,
			whatsapp: values.whatsapp,
			telegram: values.telegram,
		});
		const nextRaw = String(form.get('next') ?? '');
		const dest =
			nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.includes('\\')
				? nextRaw
				: '/account?welcome=1';
		const headers = new Headers({ Location: dest });
		const { forwardCookies } = await import('../../../lib/baSession');
		forwardCookies(res, headers);
		return new Response(null, { status: 303, headers });
	} catch {
		return backTo('server');
	}
};
