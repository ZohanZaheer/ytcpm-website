// Minimal PostgreSQL layer for payment orders (uses the `pg` driver).
// The table is created on first use; db/schema.sql holds the same schema
// if you prefer to create it manually.

import type { Pool } from 'pg';

export type OrderStatus = 'pending' | 'confirmed' | 'rejected';

export interface PaymentOrder {
	id: string;
	package_slug: string;
	package_label: string;
	amount_usd: number;
	crypto: string;
	network: string | null;
	customer_name: string;
	email: string;
	contact: string | null;
	tx_hash: string | null;
	note: string | null;
	screenshot_driver: string;
	screenshot_ref: string;
	status: OrderStatus;
	created_at: string;
	updated_at: string;
}

let pool: Pool | null = null;
let schemaReady = false;

async function getPool(connectionString: string): Promise<Pool> {
	if (!pool) {
		const { Pool: PgPool } = await import('pg');
		pool = new PgPool({ connectionString, max: 3 });
	}
	return pool;
}

export async function ensureSchema(connectionString: string): Promise<void> {
	if (schemaReady) return;
	const p = await getPool(connectionString);
	await p.query(`
		CREATE TABLE IF NOT EXISTS payment_orders (
			id TEXT PRIMARY KEY,
			package_slug TEXT NOT NULL,
			package_label TEXT NOT NULL,
			amount_usd INTEGER NOT NULL,
			crypto TEXT NOT NULL,
			network TEXT,
			customer_name TEXT NOT NULL,
			email TEXT NOT NULL,
			contact TEXT,
			tx_hash TEXT,
			note TEXT,
			screenshot_driver TEXT NOT NULL,
			screenshot_ref TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
	`);
	schemaReady = true;
}

export async function createOrder(
	connectionString: string,
	order: Omit<PaymentOrder, 'status' | 'created_at' | 'updated_at'>,
): Promise<void> {
	await ensureSchema(connectionString);
	const p = await getPool(connectionString);
	await p.query(
		`INSERT INTO payment_orders
		 (id, package_slug, package_label, amount_usd, crypto, network, customer_name,
		  email, contact, tx_hash, note, screenshot_driver, screenshot_ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		[
			order.id,
			order.package_slug,
			order.package_label,
			order.amount_usd,
			order.crypto,
			order.network,
			order.customer_name,
			order.email,
			order.contact,
			order.tx_hash,
			order.note,
			order.screenshot_driver,
			order.screenshot_ref,
		],
	);
}

export async function getOrder(connectionString: string, id: string): Promise<PaymentOrder | null> {
	await ensureSchema(connectionString);
	const p = await getPool(connectionString);
	const res = await p.query('SELECT * FROM payment_orders WHERE id = $1', [id]);
	return (res.rows[0] as PaymentOrder) ?? null;
}

export async function listOrders(connectionString: string, limit = 100): Promise<PaymentOrder[]> {
	await ensureSchema(connectionString);
	const p = await getPool(connectionString);
	const res = await p.query('SELECT * FROM payment_orders ORDER BY created_at DESC LIMIT $1', [limit]);
	return res.rows as PaymentOrder[];
}

export async function setOrderStatus(
	connectionString: string,
	id: string,
	status: OrderStatus,
): Promise<void> {
	await ensureSchema(connectionString);
	const p = await getPool(connectionString);
	await p.query('UPDATE payment_orders SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
}
