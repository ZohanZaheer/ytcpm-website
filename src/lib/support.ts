// Priority support requests (from customers with an active
// license, inside their dashboard): the topics a customer can pick
// in the "How can we help?" dropdown.
export const SUPPORT_TOPICS: Record<string, string> = {
	'username-password-change': 'License username / password change',
	'device-reset': 'Reset my devices',
	other: 'Other',
};

export function supportTopicLabel(topic: string): string {
	return SUPPORT_TOPICS[topic] ?? topic;
}
