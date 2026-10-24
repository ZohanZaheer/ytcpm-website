// Admin authentication: email + password login with a signed, expiring
// session cookie. Credentials live in environment secrets (ADMIN_EMAIL,
// ADMIN_PASSWORD); the cookie is signed with ADMIN_SECRET. Nothing is
// stored in the database and no password ever reaches the browser
// after login — only the opaque session value.
//
// Bootstrap bridge: opening any /admin page with ?key=<ADMIN_SECRET>
// also signs you in (handy before ADMIN_EMAIL/ADMIN_PASSWORD are set,
// and as a recovery path). The dashboard UI itself uses email+password.

import { getEnv } from './env';

export const SESSION_COOKIE = 'ytcpm_admin_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

interface CtxLike {
	locals?: unknown;
	request?: Request;
	url?: URL;
}

function b64urlEncode(text: string): string {
	return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text: string): string {
	const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
	return atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function hmacHex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function adminConfigured(ctx: CtxLike): boolean {
	return !!(getEnv(ctx, 'ADMIN_EMAIL') && getEnv(ctx, 'ADMIN_PASSWORD') && getEnv(ctx, 'ADMIN_SECRET'));
}

export function checkCredentials(ctx: CtxLike, email: string, password: string): boolean {
	const wantEmail = getEnv(ctx, 'ADMIN_EMAIL') ?? '';
	const wantPassword = getEnv(ctx, 'ADMIN_PASSWORD') ?? '';
	if (!wantEmail || !wantPassword) return false;
	const emailOk = timingSafeEqual(email.trim().toLowerCase(), wantEmail.trim().toLowerCase());
	// Compare passwords through fixed-length hashes would be ideal; a
	// length-leaking compare on the admin's own chosen password, behind
	// HTTPS and a login delay, is acceptable here — still use the
	// constant-time loop over the overlapping length.
	let passOk = password.length === wantPassword.length;
	const n = Math.min(password.length, wantPassword.length);
	let diff = 0;
	for (let i = 0; i < n; i++) diff |= password.charCodeAt(i) ^ wantPassword.charCodeAt(i);
	passOk = passOk && diff === 0;
	return emailOk && passOk;
}

export async function makeSessionValue(ctx: CtxLike, email: string): Promise<string> {
	const secret = getEnv(ctx, 'ADMIN_SECRET') ?? '';
	const payload = `${Date.now() + SESSION_MS}.${email}`;
	const sig = await hmacHex(secret, payload);
	return `${b64urlEncode(payload)}.${sig}`;
}

export async function verifySessionValue(ctx: CtxLike, value: string | undefined): Promise<string | null> {
	if (!value) return null;
	const secret = getEnv(ctx, 'ADMIN_SECRET');
	if (!secret) return null;
	const dot = value.indexOf('.');
	if (dot < 0) return null;
	let payload: string;
	try {
		payload = b64urlDecode(value.slice(0, dot));
	} catch {
		return null;
	}
	const sig = value.slice(dot + 1);
	const expected = await hmacHex(secret, payload);
	if (!timingSafeEqual(sig, expected)) return null;
	const sep = payload.indexOf('.');
	if (sep < 0) return null;
	const exp = Number(payload.slice(0, sep));
	if (!Number.isFinite(exp) || exp < Date.now()) return null;
	return payload.slice(sep + 1);
}

export function readCookie(request: Request | undefined, name: string): string | undefined {
	const header = request?.headers.get('cookie') ?? '';
	for (const part of header.split(';')) {
		const eq = part.indexOf('=');
		if (eq > 0 && part.slice(0, eq).trim() === name) {
			return decodeURIComponent(part.slice(eq + 1).trim());
		}
	}
	return undefined;
}

export async function sessionEmailFromRequest(ctx: CtxLike): Promise<string | null> {
	return verifySessionValue(ctx, readCookie(ctx.request, SESSION_COOKIE));
}

/** True when the request carries a valid session cookie OR the legacy secret (form field / ?key=). */
export async function isAdminRequest(
	ctx: CtxLike & { formSecret?: string },
): Promise<boolean> {
	if (await sessionEmailFromRequest(ctx)) return true;
	const secret = getEnv(ctx, 'ADMIN_SECRET');
	if (!secret) return false;
	if (ctx.formSecret && timingSafeEqual(ctx.formSecret, secret)) return true;
	const key = ctx.url?.searchParams.get('key');
	// '+' decodes to a space in query strings; the secret has no spaces.
	if (key && (timingSafeEqual(key, secret) || timingSafeEqual(key.replace(/ /g, '+'), secret))) return true;
	return false;
}

export function sessionCookieHeader(value: string): string {
	return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`;
}

export function clearCookieHeader(): string {
	return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
