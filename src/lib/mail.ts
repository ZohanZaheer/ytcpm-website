// Transactional email sending for the website itself (account
// verification). Uses the Resend HTTPS API when configured:
//   RESEND_API_KEY  — the provider key
//   EMAIL_FROM      — e.g. "YTCPM <noreply@ytcpm.cyou>"
// Without a provider key nothing can be delivered; the purchase
// gate in the checkout checks isMailConfigured() so the store is
// never blocked by an email service that isn't set up yet, and
// starts enforcing verification automatically once it is.

export function isMailConfigured(): boolean {
	return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendVerificationEmail(params: {
	user: { email: string; name?: string | null };
	url: string;
}): Promise<void> {
	const { user, url } = params;
	if (!isMailConfigured()) {
		// Nowhere to send from yet — the account simply stays
		// unverified and the dashboard offers a resend once a
		// provider is configured.
		console.warn(`[mail] verification email for ${user.email} not sent: no email provider configured`);
		return;
	}
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: process.env.EMAIL_FROM,
			to: [user.email],
			subject: 'Verify your email — YTCPM',
			html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#292018">
<h2 style="color:#9a3412">Verify your email address</h2>
<p>Hi ${user.name ?? 'there'},</p>
<p>Thanks for creating your YTCPM account. Please confirm this email address to finish setting up your account — you will need a verified email before your first purchase:</p>
<p style="margin:28px 0"><a href="${url}" style="background:#ea580c;color:#ffffff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:bold">Verify my email</a></p>
<p style="color:#78716c;font-size:13px">If the button doesn't work, copy this link into your browser:<br/>${url}</p>
<p style="color:#78716c;font-size:13px">If you didn't create this account, you can ignore this email.</p>
</div>`,
		}),
	});
	if (!res.ok) {
		console.error('[mail] Resend send failed:', res.status, await res.text().catch(() => ''));
	}
}
