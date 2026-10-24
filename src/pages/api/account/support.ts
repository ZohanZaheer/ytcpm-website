import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { baSessionUser } from '../../../lib/baSession';
import { createSupportRequest, getOrder, listOrdersForUser } from '../../../lib/db';
import { getEffectiveSettings, findPackage } from '../../../lib/settings';
import { getEnv } from '../../../lib/env';
import { SUPPORT_TOPICS } from '../../../lib/support';

export const prerender = false;

// A signed-in customer with an active license sends a priority
// support request from inside their dashboard.
export const POST: APIRoute = async (ctx) => {
	const back = (code: string, orderId?: string) =>
		new Response(null, {
			status: 303,
			headers: {
				Location:
					'/account/support?msg=' + code + (orderId ? '&order=' + encodeURIComponent(orderId) : ''),
			},
		});
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return back('error');
	try {
		const user = await baSessionUser(ctx);
		if (!user) return ctx.redirect('/login?next=/account/support');
		const form = await ctx.request.formData().catch(() => null);
		const orderId = String(form?.get('order') ?? '');
		const topic = String(form?.get('topic') ?? '');
		const message = String(form?.get('message') ?? '').trim();
		if (!SUPPORT_TOPICS[topic]) return back('topic', orderId || undefined);
		if (message.length < 5 || message.length > 2000) return back('message', orderId || undefined);
		// The chosen license must be one of the customer's own
		// confirmed, unexpired licenses.
		const order = orderId ? await getOrder(dbUrl, orderId) : null;
		if (!order || order.status !== 'confirmed') return back('license');
		if (order.user_id !== user.id && order.email.toLowerCase() !== user.email.toLowerCase())
			return back('license');
		const settings = await getEffectiveSettings(dbUrl, (k) => getEnv(ctx, k));
		const pkg = findPackage(settings, order.package_slug);
		if (pkg?.durationDays != null) {
			const activatedAt = new Date(order.updated_at).getTime();
			const expiresAt = activatedAt + pkg.durationDays * 86400000;
			if (Date.now() > expiresAt) return back('expired');
		}
		await createSupportRequest(dbUrl, { userId: user.id, orderId: order.id, topic, message });
		return back('sent', order.id);
	} catch {
		return back('error');
	}
};
