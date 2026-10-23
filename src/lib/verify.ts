// Best-effort on-chain confirmation checks, used by the order-status API.
// A check can only run when the customer provided a transaction hash.
//   BTC          — mempool.space public API (no key needed)
//   USDT (TRC20) — Trongrid public API (no key needed for basic lookups)
//   ETH / USDT (ERC20) — Etherscan, requires ETHERSCAN_API_KEY
// Anything that cannot be checked returns 'unknown' and the order simply
// stays pending for manual admin review. Nothing here can mark an order
// confirmed unless the transaction is confirmed on-chain AND (where the
// API exposes it) pays the configured address.

export type VerifyState = 'confirmed' | 'pending' | 'unknown';

export interface VerifyResult {
	state: VerifyState;
	detail: string;
}

async function fetchJson(url: string): Promise<unknown> {
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

export async function checkTransaction(opts: {
	crypto: string;
	network: string | null;
	txHash: string;
	expectedAddress?: string;
	etherscanApiKey?: string;
}): Promise<VerifyResult> {
	const { crypto, network, txHash, expectedAddress, etherscanApiKey } = opts;
	try {
		if (crypto === 'BTC') {
			const tx = (await fetchJson(`https://mempool.space/api/tx/${encodeURIComponent(txHash)}`)) as {
				status?: { confirmed?: boolean };
				vout?: Array<{ scriptpubkey_address?: string }>;
			};
			if (expectedAddress && tx.vout && !tx.vout.some((o) => o.scriptpubkey_address === expectedAddress)) {
				return { state: 'unknown', detail: 'Transaction found, but it does not pay the configured BTC address.' };
			}
			return tx.status?.confirmed
				? { state: 'confirmed', detail: 'Confirmed on the Bitcoin network.' }
				: { state: 'pending', detail: 'Transaction seen, waiting for a block confirmation.' };
		}

		if (crypto === 'USDT' && (network ?? 'TRC20').toUpperCase() === 'TRC20') {
			const data = (await fetchJson(`https://api.trongrid.io/v1/transactions/${encodeURIComponent(txHash)}`)) as {
				data?: Array<{ ret?: Array<{ contractRet?: string }> }>;
			};
			const ret = data.data?.[0]?.ret?.[0]?.contractRet;
			if (!ret) return { state: 'pending', detail: 'Transaction not visible on the TRON network yet.' };
			return ret === 'SUCCESS'
				? { state: 'confirmed', detail: 'Confirmed on the TRON network.' }
				: { state: 'unknown', detail: `TRON transaction status: ${ret}.` };
		}

		if (crypto === 'ETH' || crypto === 'USDT') {
			// ERC20 path
			if (!etherscanApiKey) {
				return { state: 'unknown', detail: 'Set ETHERSCAN_API_KEY to enable automatic ERC20 checks.' };
			}
			const data = (await fetchJson(
				`https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${encodeURIComponent(txHash)}&apikey=${etherscanApiKey}`,
			)) as { result?: { status?: string } };
			if (data.result?.status === '1') return { state: 'confirmed', detail: 'Confirmed on the Ethereum network.' };
			if (data.result?.status === '0') return { state: 'unknown', detail: 'Ethereum transaction failed on-chain.' };
			return { state: 'pending', detail: 'Transaction not confirmed on Ethereum yet.' };
		}
	} catch (err) {
		return { state: 'unknown', detail: `Explorer check failed: ${(err as Error).message}` };
	}
	return { state: 'unknown', detail: 'No automatic check available for this currency.' };
}
