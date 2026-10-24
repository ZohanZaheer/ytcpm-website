-- Payment orders for the YTCPM Bot pricing/checkout flow.
-- The app also creates this table automatically on first use
-- (CREATE TABLE IF NOT EXISTS), so running this file is optional.

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
	status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders (created_at DESC);

-- Site settings edited from the admin dashboard (single JSON document
-- stored under key 'site': packages, payment addresses, download info).
CREATE TABLE IF NOT EXISTS site_settings (
	key TEXT PRIMARY KEY,
	value JSONB NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages sent from the public /contact form; read in the admin dashboard.
CREATE TABLE IF NOT EXISTS contact_messages (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	topic TEXT NOT NULL,
	message TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'new', -- new | read
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages (created_at DESC);

-- License packages (edited from the admin dashboard; the settings JSON
-- no longer stores them). duration_days NULL means lifetime.
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

-- Orders placed while signed in carry the customer's account id.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders (user_id);

-- better-auth account tables (customers + admin; role = 'admin' is the
-- administrator). Column names keep better-auth's camelCase for the
-- timestamp/token fields because the library maps fields to columns
-- verbatim.
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
CREATE INDEX IF NOT EXISTS idx_session_user ON "session" ("userId");
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
CREATE INDEX IF NOT EXISTS idx_account_user ON "account" ("userId");
CREATE TABLE IF NOT EXISTS "verification" (
	id TEXT PRIMARY KEY,
	identifier TEXT NOT NULL,
	value TEXT NOT NULL,
	"expiresAt" TIMESTAMPTZ NOT NULL,
	"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
