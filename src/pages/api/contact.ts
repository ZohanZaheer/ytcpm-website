import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../lib/env';
import { createContactMessage } from '../../lib/db';

export const prerender = false;

export const CONTACT_TOPICS = [
	'Sales question',
	'Payment help',
	'License & activation',
	'Technical support',
	'Something else',
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function back(params: Record<string, string>): Response {
	const qs = new URLSearchParams(params).toString();
	return new Response(null, { status: 303, headers: { Location: `/contact?${qs}` } });
}

// Public contact form handler. Messages are stored in the database and
// read from the admin dashboard — the site sends no email itself.
// A hidden "website" field acts as a spam honeypot: real visitors
// never fill it in, bots do.
export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	if (!form) return back({ error: 'form' });

	if (String(form.get('website') ?? '') !== '') {
		// Pretend success so bots learn nothing.
		return back({ sent: '1' });
	}

	const name = String(form.get('name') ?? '').trim();
	const email = String(form.get('email') ?? '').trim();
	const topic = String(form.get('topic') ?? '');
	const message = String(form.get('message') ?? '').trim();

	if (name.length < 2 || name.length > 80) return back({ error: 'name' });
	if (!EMAIL_RE.test(email) || email.length > 160) return back({ error: 'email' });
	if (!(CONTACT_TOPICS as readonly string[]).includes(topic)) return back({ error: 'topic' });
	if (message.length < 10 || message.length > 4000) return back({ error: 'message' });

	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return back({ error: 'server' });
	try {
		await createContactMessage(dbUrl, { name, email, topic, message });
	} catch {
		return back({ error: 'server' });
	}
	return back({ sent: '1' });
};
