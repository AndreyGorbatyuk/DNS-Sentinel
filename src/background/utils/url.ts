interface MinimalURL {
	hostname: string;
	pathname: string;
}

export function parseURLSafely(url: string): MinimalURL | null {
	try {
		const u = new URL(url);
		return {
			hostname: u.hostname,
			pathname: u.pathname,
		};
	} catch {
		if (url.startsWith('/')) {
			return { hostname: '', pathname: url };
		}
		return null;
	}
}

export function isSensitivePath(url: string): boolean {
	const parsed = parseURLSafely(url);
	if (!parsed) return false;

	const path = parsed.pathname.toLowerCase();
	const sensitivePatterns = [
		'login', 'signin', 'sign-in', 'auth', 'oauth',
		'password', 'reset', 'account', 'profile',
		'bank', 'payment', 'checkout', 'billing', 'card',
		'secure', 'admin', 'cpanel', 'dashboard'
	];

	return sensitivePatterns.some(p => path.includes(p));
}

export function extractHostname(url: string): string {
	const parsed = parseURLSafely(url);
	if (!parsed) return '';
	return parsed.hostname.toLowerCase();
}

export function isDataOrBlobUrl(url: string): boolean {
	return /^data:/i.test(url) || /^blob:/i.test(url);
}

export function isPrivateUrl(url: string): boolean {
	const hostname = extractHostname(url);
	if (!hostname) return true;

	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname.startsWith('127.') ||
		hostname.startsWith('10.') ||
		hostname.startsWith('192.168.') ||
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
		hostname.endsWith('.local') ||
		hostname.endsWith('.internal')
	);
}

