import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { getOrder, setOrderStatus } from '../../../lib/db';
import { checkTransaction } from '../../../lib/verify';

export const prerender = false;

// Public status check for one order. Runs the on-chain verification when a
// transaction hash is available and the order is still pending.
export const GET: APIRoute = async (ctx) => {
	const id = ctx.params.id ?? '';
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response(JSON.stringify({ error: 'Database not configured.' }), { status: 503 });
	const order = await getOrder(dbUrl, id);
	if (!order) return new Response(JSON.stringify({ error: 'Order not found.' }), { status: 404 });

	let status = order.status;
	let verifyDetail: string | null = null;

	if (status === 'pending' && order.tx_hash) {
		const addressKey =
			order.crypto === 'USDT'
				? 'PAYMENT_USDT_ADDRESS'
				: order.crypto === 'BTC'
					? 'PAYMENT_BTC_ADDRESS'
					: 'PAYMENT_ETH_ADDRESS';
		const result = await checkTransaction({
			crypto: order.crypto,
			network: order.network,
			txHash: order.tx_hash,
			expectedAddress: getEnv(ctx, addressKey),
			etherscanApiKey: getEnv(ctx, 'ETHERSCAN_API_KEY'),
		});
		verifyDetail = result.detail;
		if (result.state === 'confirmed') {
			await setOrderStatus(dbUrl, id, 'confirmed');
			status = 'confirmed';
		}
	}

	return new Response(
		JSON.stringify({
			id: order.id,
			status,
			package: order.package_label,
			amount_usd: order.amount_usd,
			crypto: order.crypto,
			network: order.network,
			created_at: order.created_at,
			verify: verifyDetail,
		}),
		{ headers: { 'Content-Type': 'application/json' } },
	);
};
