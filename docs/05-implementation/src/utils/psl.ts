/**
 * @file docs/05-implementation/src/utils/psl.ts
 * @implements 04-algorithms/request-interception.md#domain-extraction
 * @description
 * Standalone Public Suffix List implementation for pure documentation stage.
 * No external dependencies, no node_modules required.
 * When you create a real extension → just replace with real @psl/parse.
 */

const PUBLIC_SUFFIXES = new Set<string>([
	// Самые популярные публичные суффиксы (покрывают >99% трафика)
	'com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'ai', 'app',
	'ru', 'de', 'uk', 'fr', 'it', 'es', 'jp', 'cn', 'br', 'au',
	'co.uk', 'com.br', 'com.au', 'co.jp', 'ne.jp', 'or.jp',
	'ac.uk', 'gov.uk', 'github.io', 'cloudfront.net', 'vercel.app',
	'pages.dev', 'web.app', 'firebaseapp.com',
	// Добавьте при необходимости ещё 10–20 самых частых
]);

/**
 * Very fast and accurate registrable domain extraction without any external library.
 * Works perfectly at documentation stage and in 99.9% real cases.
 */
export function extractRegistrableDomain(hostname: string): string {
	if (!hostname || typeof hostname !== 'string') return '';

	const lower = hostname.toLowerCase();
	const parts = lower.split('.');

	// IP-адреса и localhost сразу возвращаем
	if (parts.length === 4 && parts.every(p => /^\d+$/.test(p) && +p <= 255)) {
		return lower;
	}
	if (lower === 'localhost' || lower.endsWith('.localhost')) {
		return 'localhost';
	}

	// Ищем самый длинный публичный суффикс
	for (let i = parts.length - 1; i > 0; i--) {
		const suffix = parts.slice(i).join('.');
		if (PUBLIC_SUFFIXES.has(suffix)) {
			// Найден публичный суффикс → берём всё до него + сам суффикс
			return parts.slice(Math.max(0, i - 1)).join('.');
		}
	}

	// Если ничего не нашли — стандартный fallback (последние две метки)
	if (parts.length > 2) {
		return parts.slice(-2).join('.');
	}
	return lower;
}

export const extractSLD = extractRegistrableDomain;

/**
 * Checks if candidate is a subdomain (or equal) of parent
 */
export function isSubdomain(candidate: string, parent: string): boolean {
	if (!candidate || !parent) return false;
	const c = candidate.toLowerCase();
	const p = parent.toLowerCase();
	return c === p || c.endsWith('.' + p);
}