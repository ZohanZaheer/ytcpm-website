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
	user_id: string | null;
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
	-- Orders placed by a signed-in customer carry their account id
	-- (guests stay NULL and are matched by email in the dashboard).
	ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS user_id TEXT;
	-- License packages live in their own table (edited from the admin
	-- dashboard); site_settings no longer stores them.
	CREATE TABLE IF NOT EXISTS packages (
		slug TEXT PRIMARY KEY,
		duration_label TEXT NOT NULL,
		duration_days INTEGER,
		devices INTEGER NOT NULL,
		price_usd INTEGER NOT NULL,
		save_note TEXT,
		popular BOOLEAN NOT NULL DEFAULT false,
		active BOOLEAN NOT NULL DEFAULT true,
		sort INTEGER NOT NULL DEFAULT 0,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	-- better-auth tables (email + password accounts for customers and
	-- the admin; a user with role = 'admin' is the administrator).
	CREATE TABLE IF NOT EXISTS "user" (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		"emailVerified" BOOLEAN NOT NULL DEFAULT false,
		image TEXT,
		role TEXT DEFAULT 'user',
		"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
		"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE TABLE IF NOT EXISTS "session" (
		id TEXT PRIMARY KEY,
		"expiresAt" TIMESTAMPTZ NOT NULL,
		token TEXT NOT NULL UNIQUE,
		"ipAddress" TEXT,
		"userAgent" TEXT,
		"userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
		"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE TABLE IF NOT EXISTS "account" (
		id TEXT PRIMARY KEY,
		"accountId" TEXT NOT NULL,
		"providerId" TEXT NOT NULL,
		"userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		"accessToken" TEXT,
		"refreshToken" TEXT,
		"idToken" TEXT,
		"accessTokenExpiresAt" TIMESTAMPTZ,
		"refreshTokenExpiresAt" TIMESTAMPTZ,
		scope TEXT,
		password TEXT,
		"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
		"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE TABLE IF NOT EXISTS "verification" (
		id TEXT PRIMARY KEY,
		identifier TEXT NOT NULL,
		value TEXT NOT NULL,
		"expiresAt" TIMESTAMPTZ NOT NULL,
		"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
		"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
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

/** Run the idempotent schema step (every table, created if missing). */
export async function ensureSchema(connectionString: string): Promise<void> {
	await withClient(connectionString, async () => {
		// withClient always executes SCHEMA_SQL before the callback.
	});
}

export async function createOrder(
	connectionString: string,
	order: Omit<PaymentOrder, 'status' | 'created_at' | 'updated_at'>,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
			`INSERT INTO payment_orders
			 (id, package_slug, package_label, amount_usd, crypto, network, customer_name,
			  email, contact, tx_hash, note, screenshot_driver, screenshot_ref, user_id)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
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
				order.user_id ?? null,
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

// ---------------------------------------------------------------------------
// Packages table — the storefront's source of truth for license plans.
// Rows are mapped to/from LicensePackage in src/lib/settings.ts.
// ---------------------------------------------------------------------------

export interface PackageRow {
	slug: string;
	duration_label: string;
	duration_days: number | null;
	devices: number;
	price_usd: number;
	save_note: string | null;
	popular: boolean;
	active: boolean;
	sort: number;
}

export async function listPackageRows(connectionString: string): Promise<PackageRow[]> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM packages ORDER BY sort ASC, slug ASC'),
	);
	return res.rows as PackageRow[];
}

/** Replace the whole package list atomically (admin editor saves). */
export async function replacePackageRows(connectionString: string, rows: PackageRow[]): Promise<void> {
	await withClient(connectionString, async (c) => {
		await c.query('BEGIN');
		try {
			await c.query('DELETE FROM packages');
			for (const r of rows) {
				await c.query(
					`INSERT INTO packages (slug, duration_label, duration_days, devices, price_usd, save_note, popular, active, sort, updated_at)
					 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())`,
					[r.slug, r.duration_label, r.duration_days, r.devices, r.price_usd, r.save_note, r.popular, r.active, r.sort],
				);
			}
			await c.query('COMMIT');
		} catch (err) {
			await c.query('ROLLBACK');
			throw err;
		}
	});
}

// ---------------------------------------------------------------------------
// better-auth account helpers (the auth library owns writes; these are
// for the admin bootstrap, role checks and the customer dashboard).
// ---------------------------------------------------------------------------

export interface AuthUserRow {
	id: string;
	email: string;
	name: string;
	role: string;
}

export async function getAuthUserByEmail(connectionString: string, email: string): Promise<AuthUserRow | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT id, email, name, COALESCE(role, \'user\') AS role FROM "user" WHERE lower(email) = lower($1)', [email]),
	);
	return (res.rows[0] as AuthUserRow) ?? null;
}

export async function setAuthUserRole(connectionString: string, id: string, role: string): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE "user" SET role = $2, "updatedAt" = now() WHERE id = $1', [id, role]),
	);
}

/** Orders belonging to a customer account: linked by id, or by the
 * account's email for orders placed as a guest. */
export async function listOrdersForUser(
	connectionString: string,
	userId: string,
	email: string,
	limit = 50,
): Promise<PaymentOrder[]> {
	const res = await withClient(connectionString, (c) =>
		c.query(
			'SELECT * FROM payment_orders WHERE user_id = $1 OR lower(email) = lower($2) ORDER BY created_at DESC LIMIT $3',
			[userId, email, limit],
		),
	);
	return res.rows as PaymentOrder[];
}
