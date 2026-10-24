import type { APIRoute } from 'astro';
import { authForRequest, baSessionUser, forwardCookies } from '../../../lib/baSession';
import { isStrongPassword } from '../../../lib/profile';

export const prerender = false;

function backTo(code: string): Response {
	return new Response(null, {
		status: 303,
		headers: { Location: '/account/profile?pw=' + code },
	});
}

// Change the signed-in customer's password (current password required;
// other sessions are revoked, this one stays signed in).
export const POST: APIRoute = async (ctx) => {
	try {
		const user = await baSessionUser(ctx);
		if (!user) return ctx.redirect('/login?next=/account/profile');
		const form = await ctx.request.formData().catch(() => null);
		const currentPassword = String(form?.get('currentPassword') ?? '');
		const newPassword = String(form?.get('newPassword') ?? '');
		if (!currentPassword || !isStrongPassword(newPassword)) return backTo('invalid');
		const auth = await authForRequest(ctx);
		if (!auth) return backTo('error');
		const res = await auth.api.changePassword({
			body: { currentPassword, newPassword, revokeOtherSessions: true },
			headers: ctx.request.headers,
			asResponse: true,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			if (/password/i.test(text)) return backTo('wrong');
			return backTo('error');
		}
		const headers = new Headers({ Location: '/account/profile?pw=done' });
		forwardCookies(res, headers);
		return new Response(null, { status: 303, headers });
	} catch {
		return backTo('error');
	}
};
