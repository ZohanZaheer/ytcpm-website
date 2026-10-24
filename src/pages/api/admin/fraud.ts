import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { getOrder, markOrderFraud, addFraudStrike, getFraudInfoByEmail } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/auth';

export const prerender = false;

/**
 * Marks one order as fraud and adds a strike to its customer. At
 * FRAUD_LIMIT strikes the customer is blocked and signed out everywhere
 * (see addFraudStrike). Each order can be marked once.
 */
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized.', { status: 401 });

	const form = await ctx.request.formData();

	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Payments are not configured.', { status: 503 });

	const backTo = (code: string) =>
		new Response(null, { status: 303, headers: { Location: '/admin/orders?msg=' + code } });

	const id = String(form.get('id') ?? '').trim();
	if (!id) return backTo('fraud-error');

	try {
		const order = await getOrder(dbUrl, id);
		if (!order) return backTo('fraud-error');
		if (order.fraud_at) return backTo('fraud-already');

		const marked = await markOrderFraud(dbUrl, id);
		if (!marked) return backTo('fraud-already');

		// Strike the customer: the order's account when it has one,
		// otherwise the account registered with the order's email.
		let userId = order.user_id;
		if (!userId) {
			userId = (await getFraudInfoByEmail(dbUrl, order.email))?.id ?? null;
		}
		if (userId) {
			const strike = await addFraudStrike(dbUrl, userId);
			if (strike.blockedNow) return backTo('fraud-blocked');
		}
		return backTo('fraud');
	} catch {
		return backTo('fraud-error');
	}
};
