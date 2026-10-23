import type { APIRoute } from 'astro';
import { clearCookieHeader } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async () => {
	return new Response(null, {
		status: 303,
		headers: { Location: '/admin', 'Set-Cookie': clearCookieHeader() },
	});
};
