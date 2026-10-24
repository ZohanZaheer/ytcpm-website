import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { isAdminRequest } from '../../../lib/auth';
import { authForRequest } from '../../../lib/baSession';
import {
	ensureSchema,
	getAuthUserByEmail,
	createProfile,
	profileFieldTaken,
	setAuthUserEmailVerified,
} from '../../../lib/db';
import { validateRegistration } from '../../../lib/profile';

export const prerender = false;

function backTo(param: 'msg' | 'error', code: string): Response {
	// Errors return to the Add New User page (the form lives there now);
	// success goes straight to the new user's detail page (see below).
	const base = param === 'error' ? '/admin/users/new' : '/admin/users';
	return new Response(null, { status: 303, headers: { Location: `${base}?${param}=` + code } });
}

// Admin creates a customer account manually (same validation and
// uniqueness rules as self-registration). The account is marked
// email-verified — the admin vouches for it — and the new customer
// is NOT signed in on the admin's browser.
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized', { status: 401 });
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return backTo('error', 'server');
	const form = await ctx.request.formData().catch(() => null);
	if (!form) return backTo('error', 'server');
	const raw: Record<string, string> = {};
	for (const k of ['username', 'email', 'password', 'fullName', 'country', 'state', 'city', 'address', 'zip', 'whatsapp', 'telegram']) {
		raw[k] = String(form.get(k) ?? '');
	}
	const { values, error } = validateRegistration(raw);
	if (!values) return backTo('error', error ?? 'server');

	try {
		await ensureSchema(dbUrl);
		if (await getAuthUserByEmail(dbUrl, values.email)) return backTo('error', 'email-taken');
		if (await profileFieldTaken(dbUrl, 'username', values.username)) return backTo('error', 'username-taken');
		if (await profileFieldTaken(dbUrl, 'whatsapp', values.whatsapp)) return backTo('error', 'whatsapp-taken');
		if (values.telegram && (await profileFieldTaken(dbUrl, 'telegram', values.telegram)))
			return backTo('error', 'telegram-taken');

		const auth = await authForRequest(ctx);
		if (!auth) return backTo('error', 'server');
		const res = await auth.api.signUpEmail({
			body: { name: values.fullName, email: values.email, password: values.password },
			asResponse: true,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			if (/exist|already/i.test(text)) return backTo('error', 'email-taken');
			return backTo('error', 'server');
		}
		// NOTE: the sign-up response cookies are deliberately not
		// forwarded — the admin stays signed in as admin.
		const created = await getAuthUserByEmail(dbUrl, values.email);
		if (!created) return backTo('error', 'server');
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
		await setAuthUserEmailVerified(dbUrl, created.id);
		return new Response(null, {
			status: 303,
			headers: { Location: `/admin/users/${created.id}?msg=created` },
		});
	} catch {
		return backTo('error', 'server');
	}
};
