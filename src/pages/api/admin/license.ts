import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/auth';
import { getDatabaseUrl } from '../../../lib/env';
import { getOrder, setOrderLicense, unfulfillOrder } from '../../../lib/db';

export const prerender = false;

// Assign (or update) the bot login for a confirmed order, and mark
// the license done — only then does the customer see the
// credentials in their dashboard.
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized', { status: 401 });
	const dbUrl = getDatabaseUrl(ctx);
	const form = await ctx.request.formData().catch(() => null);
	// Forms may send the admin back to another admin page (e.g. the
	// user detail page) instead of the licenses list.
	const backRaw = String(form?.get('back') ?? '');
	const backBase = backRaw.startsWith('/admin/') && !backRaw.includes('?') ? backRaw : '/admin/licenses';
	const back = (code: string) =>
		new Response(null, { status: 303, headers: { Location: backBase + '?msg=' + code } });
	if (!dbUrl) return back('error');
	const id = String(form?.get('id') ?? '');
	const action = String(form?.get('action') ?? 'save');
	const order = id ? await getOrder(dbUrl, id) : null;
	if (!order) return back('error');
	try {
		if (action === 'unfulfill') {
			await unfulfillOrder(dbUrl, id);
			return back('reopened');
		}
		const botUsername = String(form?.get('bot_username') ?? '').trim() || null;
		const botPassword = String(form?.get('bot_password') ?? '').trim() || null;
		const done = String(form?.get('done') ?? '') === '1';
		if (done && (!botUsername || !botPassword)) return back('creds');
		await setOrderLicense(dbUrl, id, botUsername, botPassword, done);
		return back(done ? 'done' : 'saved');
	} catch {
		return back('error');
	}
};
