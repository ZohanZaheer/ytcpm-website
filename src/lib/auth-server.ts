// better-auth server instance (email + password) backed by the same
// PostgreSQL database as orders and settings.
//
// A fresh instance (and a single-connection pool) is created per
// request: on Cloudflare Workers a long-lived pool holds sockets that
// go stale when an isolate is suspended — the same lesson the order
// layer learned. `max: 1` keeps each request's footprint minimal.
//
// Tables (user / session / account / verification) live in
// db/schema.sql and are created by the same on-first-use schema step
// as the other tables (see src/lib/db.ts). The admin is simply a user
// whose role is 'admin' (see the bootstrap in /api/admin/login).
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { sendVerificationEmail } from './mail';

export function createAuth(databaseUrl: string, secret: string) {
	return betterAuth({
		database: new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 8000 }),
		secret,
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
		},
		// Registration sends a verification link (delivered when an
		// email provider is configured — see src/lib/mail.ts).
		// Verification is enforced at checkout, not at sign-in, so a
		// customer can always reach their dashboard and resend it.
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				await sendVerificationEmail({ user, url });
			},
		},
		user: {
			additionalFields: {
				role: {
					type: 'string',
					required: false,
					defaultValue: 'user',
					input: false, // role is only ever set by the server (admin bootstrap)
				},
			},
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days, same as the legacy admin session
			updateAge: 60 * 60 * 24,
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;

// Used by the better-auth CLI (`npm run auth:generate`) and as a
// convenience default; request handlers always call createAuth()
// with the current request's configuration.
export const auth = createAuth(process.env.DATABASE_URL ?? '', process.env.BETTER_AUTH_SECRET ?? process.env.ADMIN_SECRET ?? '');
