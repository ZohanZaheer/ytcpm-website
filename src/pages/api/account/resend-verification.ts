import type { APIRoute } from 'astro';
import { authForRequest, baSessionUser } from '../../../lib/baSession';

export const prerender = false;

// Resend the email-verification link to the signed-in customer.
export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	const back = String(form?.get('back') ?? '/account');
	const dest = back.startsWith('/') && !back.startsWith('//') ? back : '/account';
	const sep = dest.includes('?') ? '&' : '?';
	try {
		const user = await baSessionUser(ctx);
		if (!user) return ctx.redirect('/login');
		if (user.emailVerified) return ctx.redirect(dest + sep + 'verified=1');
		const auth = await authForRequest(ctx);
		if (!auth) return ctx.redirect(dest + sep + 'verify=error');
		await auth.api.sendVerificationEmail({
			body: { email: user.email, callbackURL: '/account?verified=1' },
		});
		return ctx.redirect(dest + sep + 'verify=sent');
	} catch {
		return ctx.redirect(dest + sep + 'verify=error');
	}
};
