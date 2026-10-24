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
