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
	bot_username: string | null;
	bot_password: string | null;
	fulfilled_at: string | null;
	fraud_at: string | null;
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
	-- Administrators live in their OWN table, fully separate from
	-- customer accounts: a customer login can never open the admin,
	-- because admin sign-in only ever reads this table (plus the
	-- one-time environment bootstrap that creates the first row).
	CREATE TABLE IF NOT EXISTS admin_users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL DEFAULT 'Admin',
		password_hash TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS lock_level INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS lock_day TEXT;
	ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
	-- Extended customer profile collected at registration (the
	-- better-auth user row holds only name + email).
	CREATE TABLE IF NOT EXISTS customer_profiles (
		user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
		username TEXT NOT NULL UNIQUE,
		full_name TEXT NOT NULL,
		country TEXT NOT NULL,
		state TEXT NOT NULL,
		city TEXT NOT NULL,
		address TEXT NOT NULL,
		zip TEXT NOT NULL,
		whatsapp TEXT NOT NULL UNIQUE,
		telegram TEXT UNIQUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	-- Bot license assignment on an order: credentials the admin gives
	-- the customer for the bot itself; shown to the customer only
	-- once fulfilled_at is set (admin marked it done).
	ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fraud_at TIMESTAMPTZ;
	ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS bot_username TEXT;
	ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS bot_password TEXT;
	ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
	-- Priority support requests from customers with an active
	-- license, sent from inside their dashboard.
	CREATE TABLE IF NOT EXISTS support_requests (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		order_id TEXT,
		topic TEXT NOT NULL,
		message TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'new',
		created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	-- Fraud tracking on better-auth users: each fraud-marked order adds a
	-- strike; at 3 strikes the account is blocked (blocked_at set) and can
	-- no longer sign in. The "user" table is created by better-auth, so
	-- only alter it when it already exists (this schema runs on every
	-- operation, so the columns appear as soon as the table does).
	DO $$
	BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user') THEN
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS fraud_count INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS block_reason TEXT;
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS lock_level INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS lock_day TEXT;
			ALTER TABLE "user" ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
		END IF;
	END $$;
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
	order: Omit<PaymentOrder, 'status' | 'created_at' | 'updated_at' | 'bot_username' | 'bot_password' | 'fulfilled_at' | 'fraud_at'>,
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

// ---------------------------------------------------------------------
// Fraud strikes & account blocking. An admin marks an order as fraud;
// each mark adds one strike to the customer. At FRAUD_LIMIT strikes the
// account is blocked: sign-in is refused (checked in the login route and
// at checkout) and any live sessions are deleted.
// ---------------------------------------------------------------------

export const FRAUD_LIMIT = 3;

export interface FraudInfo {
	id: string;
	email: string;
	fraud_count: number;
	blocked_at: string | null;
	block_reason: string | null;
}

/** Marks an order as fraud. Returns false when it was already marked. */
export async function markOrderFraud(connectionString: string, id: string): Promise<boolean> {
	const res = await withClient(connectionString, (c) =>
		c.query('UPDATE payment_orders SET fraud_at = now(), updated_at = now() WHERE id = $1 AND fraud_at IS NULL', [id]),
	);
	return (res.rowCount ?? 0) > 0;
}

export async function getFraudInfoByEmail(
	connectionString: string,
	email: string,
): Promise<FraudInfo | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT id, email, fraud_count, blocked_at::text AS blocked_at, block_reason FROM "user" WHERE lower(email) = lower($1)', [email]),
	);
	return (res.rows[0] as FraudInfo) ?? null;
}

export async function getFraudInfoById(
	connectionString: string,
	userId: string,
): Promise<FraudInfo | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT id, email, fraud_count, blocked_at::text AS blocked_at, block_reason FROM "user" WHERE id = $1', [userId]),
	);
	return (res.rows[0] as FraudInfo) ?? null;
}

/** Every user's fraud state, for the admin orders/users pages. */
export async function listFraudInfo(connectionString: string): Promise<FraudInfo[]> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT id, email, fraud_count, blocked_at::text AS blocked_at, block_reason FROM "user"'),
	);
	return res.rows as FraudInfo[];
}

async function deleteUserSessions(client: Client, userId: string): Promise<void> {
	// The BA session table exists wherever accounts exist; guard anyway.
	const reg = await client.query("SELECT to_regclass('session') AS t");
	if (reg.rows[0]?.t) {
		await client.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
	}
}

/**
 * Adds one fraud strike. When the count reaches FRAUD_LIMIT the account
 * is blocked and its sessions are deleted (the user is signed out
 * everywhere). Returns the new count and whether this strike blocked.
 */
export async function addFraudStrike(
	connectionString: string,
	userId: string,
): Promise<{ count: number; blockedNow: boolean }> {
	return withClient(connectionString, async (c) => {
		const res = await c.query(
			'UPDATE "user" SET fraud_count = fraud_count + 1 WHERE id = $1 RETURNING fraud_count, blocked_at::text AS blocked_at',
			[userId],
		);
		const row = res.rows[0];
		if (!row) return { count: 0, blockedNow: false };
		const count = Number(row.fraud_count);
		if (count >= FRAUD_LIMIT && !row.blocked_at) {
			await c.query(
				'UPDATE "user" SET blocked_at = now(), block_reason = $2 WHERE id = $1',
				[userId, `Blocked after ${FRAUD_LIMIT} fraudulent orders.`],
			);
			await deleteUserSessions(c, userId);
			return { count, blockedNow: true };
		}
		return { count, blockedNow: false };
	});
}

/** Signs a user out everywhere (used when a blocked user signs in). */
export async function clearUserSessions(connectionString: string, userId: string): Promise<void> {
	await withClient(connectionString, (c) => deleteUserSessions(c, userId));
}

/** Admin unblock: clears the block and resets the strike count. */
export async function clearUserBlock(connectionString: string, userId: string): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE "user" SET fraud_count = 0, blocked_at = NULL, block_reason = NULL WHERE id = $1', [userId]),
	);
}

// ---------------------------------------------------------------------
// Login lockout. Wrong-password attempts are counted per account
// (customers in "user", admins in admin_users). Reaching the configured
// max attempts locks the account; the lock length escalates per
// lockout on the same day (site timezone, America/New_York):
// 1st = firstHours, 2nd = secondHours, 3rd and later = thirdDays.
// ---------------------------------------------------------------------

export interface LockoutConfig {
	maxAttempts: number;
	firstHours: number;
	secondHours: number;
	thirdDays: number;
}

export interface LoginGuard {
	id: string;
	failed_logins: number;
	lock_level: number;
	lock_day: string | null;
	locked_until: string | null;
}

export type LoginTable = 'user' | 'admin';

const LOGIN_TABLE_SQL: Record<LoginTable, string> = { user: '"user"', admin: 'admin_users' };

/** "Today" for lockout escalation — the site's business timezone. */
export function lockoutToday(now = new Date()): string {
	return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function isLocked(guard: LoginGuard | null, now = new Date()): boolean {
	return !!guard?.locked_until && new Date(guard.locked_until).getTime() > now.getTime();
}

export async function getLoginGuard(
	connectionString: string,
	table: LoginTable,
	email: string,
): Promise<LoginGuard | null> {
	const res = await withClient(connectionString, (c) =>
		c.query(
			`SELECT id, failed_logins, lock_level, lock_day, locked_until::text AS locked_until FROM ${LOGIN_TABLE_SQL[table]} WHERE lower(email) = lower($1)`,
			[email],
		),
	);
	return (res.rows[0] as LoginGuard) ?? null;
}

export async function getLoginGuardById(
	connectionString: string,
	table: LoginTable,
	id: string,
): Promise<LoginGuard | null> {
	const res = await withClient(connectionString, (c) =>
		c.query(
			`SELECT id, failed_logins, lock_level, lock_day, locked_until::text AS locked_until FROM ${LOGIN_TABLE_SQL[table]} WHERE id = $1`,
			[id],
		),
	);
	return (res.rows[0] as LoginGuard) ?? null;
}

/**
 * Records one wrong-password attempt. Returns the attempts remaining
 * before the next lock, or the moment the new lock ends when this
 * attempt triggered it.
 */
export async function recordLoginFailure(
	connectionString: string,
	table: LoginTable,
	guard: LoginGuard,
	cfg: LockoutConfig,
): Promise<{ attemptsLeft: number; lockedUntil: string | null }> {
	const today = lockoutToday();
	// A new day restarts the escalation ladder.
	const level = guard.lock_day === today ? guard.lock_level : 0;
	const failed = guard.failed_logins + 1;
	const t = LOGIN_TABLE_SQL[table];
	if (failed >= cfg.maxAttempts) {
		const newLevel = level + 1;
		const hours =
			newLevel === 1 ? cfg.firstHours : newLevel === 2 ? cfg.secondHours : cfg.thirdDays * 24;
		const until = new Date(Date.now() + hours * 3_600_000);
		await withClient(connectionString, (c) =>
			c.query(
				`UPDATE ${t} SET failed_logins = 0, lock_level = $2, lock_day = $3, locked_until = $4 WHERE id = $1`,
				[guard.id, newLevel, today, until.toISOString()],
			),
		);
		return { attemptsLeft: 0, lockedUntil: until.toISOString() };
	}
	await withClient(connectionString, (c) =>
		c.query(`UPDATE ${t} SET failed_logins = $2, lock_level = $3, lock_day = $4 WHERE id = $1`, [
			guard.id,
			failed,
			level,
			today,
		]),
	);
	return { attemptsLeft: cfg.maxAttempts - failed, lockedUntil: null };
}

/** Successful sign-in clears the running attempt counter (the day's
 * lockout level stays until the day rolls over). */
export async function resetLoginFailures(
	connectionString: string,
	table: LoginTable,
	id: string,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(`UPDATE ${LOGIN_TABLE_SQL[table]} SET failed_logins = 0 WHERE id = $1`, [id]),
	);
}

/** Admin action: lift a login lock immediately and reset the ladder. */
export async function clearLoginLock(connectionString: string, userId: string): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
			'UPDATE "user" SET failed_logins = 0, lock_level = 0, lock_day = NULL, locked_until = NULL WHERE id = $1',
			[userId],
		),
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

export async function getAuthUserById(connectionString: string, id: string): Promise<AuthUserRow | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT id, email, name, COALESCE(role, \'user\') AS role FROM "user" WHERE id = $1', [id]),
	);
	return (res.rows[0] as AuthUserRow) ?? null;
}

/** Mark an account's email verified (used when the admin creates the
 * account personally and vouches for the address). */
export async function setAuthUserEmailVerified(connectionString: string, id: string): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE "user" SET "emailVerified" = true, "updatedAt" = now() WHERE id = $1', [id]),
	);
}

export interface CustomerRow {
	id: string;
	email: string;
	name: string;
	email_verified: boolean;
	created_at: string;
	username: string | null;
	full_name: string | null;
	whatsapp: string | null;
	telegram: string | null;
	country: string | null;
	state: string | null;
	city: string | null;
	address: string | null;
	zip: string | null;
	orders_total: number;
	licenses_total: number;
	fraud_count: number;
	blocked_at: string | null;
	failed_logins: number;
	lock_level: number;
	locked_until: string | null;
}

const CUSTOMER_SELECT = `
	SELECT u.id, u.email, u.name, u."emailVerified" AS email_verified, u."createdAt" AS created_at,
		u.fraud_count, u.blocked_at::text AS blocked_at, u.failed_logins, u.lock_level, u.locked_until::text AS locked_until,
		p.username, p.full_name, p.whatsapp, p.telegram, p.country, p.state, p.city, p.address, p.zip,
		COUNT(o.id)::int AS orders_total,
		COUNT(o.id) FILTER (WHERE o.status = 'confirmed')::int AS licenses_total
	FROM "user" u
	LEFT JOIN customer_profiles p ON p.user_id = u.id
	LEFT JOIN payment_orders o ON o.user_id = u.id OR lower(o.email) = lower(u.email)`;

/** Every registered customer with their profile and order counts,
 * newest first — the admin Users list. */
export async function listCustomers(connectionString: string): Promise<CustomerRow[]> {
	const res = await withClient(connectionString, (c) =>
		c.query(CUSTOMER_SELECT + ' GROUP BY u.id, p.user_id ORDER BY u."createdAt" DESC'),
	);
	return res.rows as CustomerRow[];
}

/** One customer by account id (the admin user-detail page). */
export async function getCustomerById(connectionString: string, id: string): Promise<CustomerRow | null> {
	const res = await withClient(connectionString, (c) =>
		c.query(CUSTOMER_SELECT + ' WHERE u.id = $1 GROUP BY u.id, p.user_id', [id]),
	);
	return (res.rows[0] as CustomerRow) ?? null;
}

// ---------------------------------------------------------------------------
// Administrators (separate table — see the schema note in SCHEMA_SQL).
// ---------------------------------------------------------------------------

export interface AdminRow {
	id: string;
	email: string;
	name: string;
	password_hash: string;
	created_at: string;
	failed_logins: number;
	lock_level: number;
	lock_day: string | null;
	locked_until: string | null;
}

export async function countAdminUsers(connectionString: string): Promise<number> {
	const res = await withClient(connectionString, (c) => c.query('SELECT COUNT(*)::int AS n FROM admin_users'));
	return res.rows[0]?.n ?? 0;
}

export async function getAdminByEmail(connectionString: string, email: string): Promise<AdminRow | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM admin_users WHERE lower(email) = lower($1)', [email]),
	);
	return (res.rows[0] as AdminRow) ?? null;
}

export async function createAdminUser(
	connectionString: string,
	admin: { email: string; name: string; passwordHash: string },
): Promise<void> {
	const id = `adm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	await withClient(connectionString, (c) =>
		c.query('INSERT INTO admin_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)', [
			id,
			admin.email,
			admin.name,
			admin.passwordHash,
		]),
	);
}

// ---------------------------------------------------------------------------
// Customer profiles (registration details).
// ---------------------------------------------------------------------------

export interface CustomerProfile {
	user_id: string;
	username: string;
	full_name: string;
	country: string;
	state: string;
	city: string;
	address: string;
	zip: string;
	whatsapp: string;
	telegram: string | null;
}

export async function getProfile(connectionString: string, userId: string): Promise<CustomerProfile | null> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM customer_profiles WHERE user_id = $1', [userId]),
	);
	return (res.rows[0] as CustomerProfile) ?? null;
}

export async function createProfile(connectionString: string, p: CustomerProfile): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
			`INSERT INTO customer_profiles
			 (user_id, username, full_name, country, state, city, address, zip, whatsapp, telegram)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			[p.user_id, p.username, p.full_name, p.country, p.state, p.city, p.address, p.zip, p.whatsapp, p.telegram],
		),
	);
}

export async function updateProfile(
	connectionString: string,
	userId: string,
	p: Omit<CustomerProfile, 'user_id' | 'username'>,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
			`UPDATE customer_profiles SET full_name=$2, country=$3, state=$4, city=$5, address=$6,
			 zip=$7, whatsapp=$8, telegram=$9, updated_at=now() WHERE user_id=$1`,
			[userId, p.full_name, p.country, p.state, p.city, p.address, p.zip, p.whatsapp, p.telegram],
		),
	);
}

/** Is a unique profile field already taken? (username/telegram are
 * case-insensitive; whatsapp is stored normalized as +digits.) */
export async function profileFieldTaken(
	connectionString: string,
	field: 'username' | 'whatsapp' | 'telegram',
	value: string,
	exceptUserId?: string,
): Promise<boolean> {
	const insensitive = field !== 'whatsapp';
	const res = await withClient(connectionString, (c) =>
		c.query(
			`SELECT 1 FROM customer_profiles
			 WHERE ${insensitive ? `lower(${field}) = lower($1)` : `${field} = $1`}
			 ${exceptUserId ? 'AND user_id <> $2' : ''} LIMIT 1`,
			exceptUserId ? [value, exceptUserId] : [value],
		),
	);
	return res.rows.length > 0;
}

// ---------------------------------------------------------------------------
// Bot license assignment + priority support requests.
// ---------------------------------------------------------------------------

export async function setOrderLicense(
	connectionString: string,
	orderId: string,
	botUsername: string | null,
	botPassword: string | null,
	markDone: boolean,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query(
			`UPDATE payment_orders
			 SET bot_username = $2, bot_password = $3,
			     fulfilled_at = CASE WHEN $4 THEN COALESCE(fulfilled_at, now()) ELSE fulfilled_at END,
			     updated_at = now()
			 WHERE id = $1`,
			[orderId, botUsername, botPassword, markDone],
		),
	);
}

export async function unfulfillOrder(connectionString: string, orderId: string): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE payment_orders SET fulfilled_at = NULL, updated_at = now() WHERE id = $1', [orderId]),
	);
}

export type SupportStatus = 'new' | 'done';

export interface SupportRequest {
	id: string;
	user_id: string;
	order_id: string | null;
	topic: string;
	message: string;
	status: SupportStatus;
	created_at: string;
}

export async function createSupportRequest(
	connectionString: string,
	r: { userId: string; orderId: string | null; topic: string; message: string },
): Promise<string> {
	const id = `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	await withClient(connectionString, (c) =>
		c.query('INSERT INTO support_requests (id, user_id, order_id, topic, message) VALUES ($1,$2,$3,$4,$5)', [
			id,
			r.userId,
			r.orderId,
			r.topic,
			r.message,
		]),
	);
	return id;
}

export async function listSupportRequests(connectionString: string, limit = 100): Promise<SupportRequest[]> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM support_requests ORDER BY created_at DESC LIMIT $1', [limit]),
	);
	return res.rows as SupportRequest[];
}

export async function listSupportRequestsForUser(
	connectionString: string,
	userId: string,
	limit = 20,
): Promise<SupportRequest[]> {
	const res = await withClient(connectionString, (c) =>
		c.query('SELECT * FROM support_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]),
	);
	return res.rows as SupportRequest[];
}

export async function countNewRequests(connectionString: string): Promise<number> {
	const res = await withClient(connectionString, (c) =>
		c.query("SELECT COUNT(*)::int AS n FROM support_requests WHERE status = 'new'"),
	);
	return res.rows[0]?.n ?? 0;
}

export async function setSupportRequestStatus(
	connectionString: string,
	id: string,
	status: SupportStatus,
): Promise<void> {
	await withClient(connectionString, (c) =>
		c.query('UPDATE support_requests SET status = $2 WHERE id = $1', [id, status]),
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
