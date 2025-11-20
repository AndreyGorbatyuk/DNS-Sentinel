const PUBLIC_SUFFIXES = new Set<string>([
	'com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'ai', 'app',
	'ru', 'de', 'uk', 'fr', 'it', 'es', 'jp', 'cn', 'br', 'au',
	'co.uk', 'com.br', 'com.au', 'co.jp', 'ne.jp', 'or.jp',
	'ac.uk', 'gov.uk', 'github.io', 'cloudfront.net', 'vercel.app',
	'pages.dev', 'web.app', 'firebaseapp.com',
]);

export function extractRegistrableDomain(hostname: string): string {
	if (!hostname || typeof hostname !== 'string') return '';

	const lower = hostname.toLowerCase();
	const parts = lower.split('.');

	if (parts.length === 4 && parts.every(p => /^\d+$/.test(p) && +p <= 255)) {
		return lower;
	}
	if (lower === 'localhost' || lower.endsWith('.localhost')) {
		return 'localhost';
	}

	for (let i = parts.length - 1; i > 0; i--) {
		const suffix = parts.slice(i).join('.');
		if (PUBLIC_SUFFIXES.has(suffix)) {
			return parts.slice(Math.max(0, i - 1)).join('.');
		}
	}

	if (parts.length > 2) {
		return parts.slice(-2).join('.');
	}
	return lower;
}

export const extractSLD = extractRegistrableDomain;

export function isSubdomain(candidate: string, parent: string): boolean {
	if (!candidate || !parent) return false;
	const c = candidate.toLowerCase();
	const p = parent.toLowerCase();
	return c === p || c.endsWith('.' + p);
}

