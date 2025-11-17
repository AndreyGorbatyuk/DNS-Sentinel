/**
 * @file docs/05-implementation/src/utils/url.ts
 * @description
 * Pure URL-related utilities used across analysis and behavior calculators.
 * No external dependencies, no imports at all — works in pure documentation mode.
 * All types are inlined to avoid TS2307.
 */

/// <reference no-default-lib="true"/>
/// <reference lib="es2022" />
/// <reference lib="webworker" />

/**
 * Minimal URL interface – only what we actually use.
 * Prevents "Cannot find module 'url'" error at documentation stage.
 */
interface MinimalURL {
	hostname: string;
	pathname: string;
}

/**
 * Safely parses a string into a minimal URL object.
 * Returns null on invalid input instead of throwing.
 */
export function parseURLSafely(url: string): MinimalURL | null {
	try {
		// The native URL constructor is available in every modern browser/extension
		const u = new URL(url);
		return {
			hostname: u.hostname,
			pathname: u.pathname,
		};
	} catch {
		// Also handle relative URLs that sometimes appear in webRequest
		if (url.startsWith('/')) {
			return { hostname: '', pathname: url };
		}
		return null;
	}
}

/**
 * Checks whether a URL path contains sensitive keywords.
 * Used by BehaviorMetricCalculator (M4).
 */
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

/**
 * Extracts clean hostname from any URL string.
 */
export function extractHostname(url: string): string {
	const parsed = parseURLSafely(url);
	if (!parsed) return '';
	return parsed.hostname.toLowerCase();
}

/**
 * Returns true for data: or blob: URLs.
 */
export function isDataOrBlobUrl(url: string): boolean {
	return /^data:/i.test(url) || /^blob:/i.test(url);
}

/**
 * Simple check for private / local URLs.
 */
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