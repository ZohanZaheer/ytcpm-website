// Registration / profile field validation and normalization.
// Shared by the sign-up endpoint and the profile-update endpoint so
// both enforce exactly the same rules.

export interface RegistrationValues {
	username: string;
	email: string;
	password: string;
	fullName: string;
	country: string;
	state: string;
	city: string;
	address: string;
	zip: string;
	whatsapp: string;
	telegram: string | null;
}

/* Username rules (owner-set): 8–15 characters, letters and digits
 * only, and it must start with a letter. Reserved words (admin,
 * owner, …) are blocked so nobody can impersonate the team. */
const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9]{7,14}$/;
export const RESERVED_USERNAMES = [
	'admin',
	'administrator',
	'owner',
	'root',
	'support',
	'staff',
	'moderator',
	'official',
	'system',
	'webmaster',
	'ytcpm',
	'billing',
	'security',
	'helpdesk',
	'manager',
];
export function isReservedUsername(username: string): boolean {
	const low = username.toLowerCase();
	return RESERVED_USERNAMES.some((w) => low.includes(w));
}

/* Password rules (owner-set): at least 8 characters with at least
 * one letter, one digit and one special character. */
export function isStrongPassword(pw: string): boolean {
	return (
		pw.length >= 8 &&
		pw.length <= 128 &&
		/[a-zA-Z]/.test(pw) &&
		/[0-9]/.test(pw) &&
		/[^a-zA-Z0-9]/.test(pw)
	);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLACE_RE = /^[\p{L}][\p{L} .'-]{1,59}$/u;
const ZIP_RE = /^[a-zA-Z0-9][a-zA-Z0-9 -]{2,11}$/;
const TELEGRAM_RE = /^[a-zA-Z0-9_]{5,32}$/;

/** Normalize a WhatsApp number to +<digits>, or null when invalid. */
export function normalizeWhatsapp(raw: string): string | null {
	const digits = raw.replace(/\D/g, '');
	if (digits.length < 7 || digits.length > 15) return null;
	return '+' + digits;
}

/** Normalize a Telegram handle (no @), or null when invalid. */
export function normalizeTelegram(raw: string): string | null {
	const handle = raw.trim().replace(/^@+/, '');
	if (!TELEGRAM_RE.test(handle)) return null;
	return handle;
}

export function validateRegistration(input: Record<string, string>): {
	values: RegistrationValues | null;
	error: string | null;
} {
	const v: RegistrationValues = {
		username: (input.username ?? '').trim(),
		email: (input.email ?? '').trim(),
		password: input.password ?? '',
		fullName: (input.fullName ?? '').trim().replace(/\s+/g, ' '),
		country: (input.country ?? '').trim(),
		state: (input.state ?? '').trim(),
		city: (input.city ?? '').trim(),
		address: (input.address ?? '').trim().replace(/\s+/g, ' '),
		zip: (input.zip ?? '').trim(),
		whatsapp: (input.whatsapp ?? '').trim(),
		telegram: null,
	};
	if (!USERNAME_RE.test(v.username)) return { values: null, error: 'username' };
	if (isReservedUsername(v.username)) return { values: null, error: 'username-reserved' };
	if (!EMAIL_RE.test(v.email) || v.email.length > 160) return { values: null, error: 'email' };
	if (!isStrongPassword(v.password)) return { values: null, error: 'password' };
	if (v.fullName.length < 2 || v.fullName.length > 80) return { values: null, error: 'fullname' };
	if (!PLACE_RE.test(v.country)) return { values: null, error: 'country' };
	if (!PLACE_RE.test(v.state)) return { values: null, error: 'state' };
	if (!PLACE_RE.test(v.city)) return { values: null, error: 'city' };
	if (v.address.length < 5 || v.address.length > 160) return { values: null, error: 'address' };
	if (!ZIP_RE.test(v.zip)) return { values: null, error: 'zip' };
	const wa = normalizeWhatsapp(v.whatsapp);
	if (!wa) return { values: null, error: 'whatsapp' };
	v.whatsapp = wa;
	const tgRaw = (input.telegram ?? '').trim();
	if (tgRaw) {
		const tg = normalizeTelegram(tgRaw);
		if (!tg) return { values: null, error: 'telegram' };
		v.telegram = tg;
	}
	return { values: v, error: null };
}

/** The profile fields a customer may edit later (username and email
 * are fixed at registration). */
export function validateProfileUpdate(input: Record<string, string>): {
	values: Omit<RegistrationValues, 'username' | 'email' | 'password'> | null;
	error: string | null;
} {
	const merged: Record<string, string> = {
		username: 'validname1', // placeholders for the shared validator
		email: 'valid@example.com',
		password: 'Passw0rd!',
		...input,
	};
	const { values, error } = validateRegistration(merged);
	if (!values) return { values: null, error };
	const { username: _u, email: _e, password: _p, ...rest } = values;
	return { values: rest, error: null };
}
