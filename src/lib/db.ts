// Minimal PostgreSQL layer for payment orders and site settings.
//
// Reliability notes for Cloudflare Workers: a fresh client is created
// per operation and closed afterwards (long-lived pools hold sockets
// that go stale when an isolate is suspended, which showed up as
// intermittent Worker errors). Each operation is retried once on a
// connection failure. Tables are created on first use; db/schema.sql
// holds the same schema for manual setup.

import type { Client } from 'pg';

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

const SCHEMA_SQL = `
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
	CREATE TABLE IF NOT EXISTS site_settings (
		key TEXT PRIMARY KEY,
		value JSONB NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE TABLE IF NOT EXISTS contact_messages (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL,
		topic TEXT NOT NULL,
		message TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'new',
		created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
`;

async function withClient<T>(connectionString: string, fn: (client: Client) => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 2; attempt++) {
		const { Client: PgClient } = await import('pg');
		const client = new PgClient({ connectionString, connectionTimeoutMillis: 8000 });
		try {
			await client.connect();
			await client.query(SCHEMA_SQL);
			return await fn(client);
		} catch (err) {
			lastError = err;
			if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
		} finally {
			try {
				await client.end();
			} catch {
				/* already closed */
			}
		}
	}
	throw lastError;
}

export async function createOrder(
	connectionString: string,
	order: Omit<PaymentOrder, 'status' | 'created_at' | 'updated_at'>,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
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
		),
	);
}

export async function getOrder(connectionString: string, id: string): Promise<PaymentOrder | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM payment_orders WHERE id = $1', [id]),
	);
	return (res.rows[0] as PaymentOrder) ?? null;
}

export async function listOrders(connectionString: string, limit = 100): Promise<PaymentOrder[]> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM payment_orders ORDER BY created_at DESC LIMIT $1', [limit]),
	);
	return res.rows as PaymentOrder[];
}

export async function setOrderStatus(
	connectionString: string,
	id: string,
	status: OrderStatus,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE payment_orders SET status = $2, updated_at = now() WHERE id = $1', [id, status]),
	);
}

export async function getSetting<T>(connectionString: string, key: string): Promise<T | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT value FROM site_settings WHERE key = $1', [key]),
	);
	return (res.rows[0]?.value as T) ?? null;
}

export async function setSetting(connectionString: string, key: string, value: unknown): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
			`INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			[key, JSON.stringify(value)],
		),
	);
}

export type ContactStatus = 'new' | 'read';

export interface ContactMessage {
	id: string;
	name: string;
	email: string;
	topic: string;
	message: string;
	status: ContactStatus;
	created_at: string;
}

export async function createContactMessage(
	connectionString: string,
	msg: { name: string; email: string; topic: string; message: string },
): Promise<string> {
	const id = `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	await withClient(connectionString, (c) =>
		c.query('INSERT INTO contact_messages (id, name, email, topic, message) VALUES ($1, $2, $3, $4, $5)', [
			id,
			msg.name,
			msg.email,
			msg.topic,
			msg.message,
		]),
	);
	return id;
}

export async function listContactMessages(connectionString: string, limit = 100): Promise<ContactMessage[]> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT $1', [limit]),
	);
	return res.rows as ContactMessage[];
}

export async function countNewMessages(connectionString: string): Promise<number> {
	const res = await withClient(connectionString, (c) =>
		c.query("SELECT COUNT(*)::int AS n FROM contact_messages WHERE status = 'new'"),
	);
	return res.rows[0]?.n ?? 0;
}

export async function setContactMessageStatus(
	connectionString: string,
	id: string,
	status: ContactStatus,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE contact_messages SET status = $2 WHERE id = $1', [id, status]),
	);
}

export async function deleteContactMessage(connectionString: string, id: string): Promise<void> {
	await withClient(connectionString, (c) => c.query('DELETE FROM contact_messages WHERE id = $1', [id]));
}
