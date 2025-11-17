/**
 * @file docs/05-implementation/src/utils/domain.ts
 * @description
 * Domain-related pure utilities.
 * No side effects, no chrome.* API usage.
 * Used across analysis, storage and interceptors.
 */

import { extractRegistrableDomain, isSubdomain } from './psl.ts';

/**
 * Normalizes a full URL or hostname to a clean registrable domain.
 *
 * @param input - full URL, hostname or IP address
 * @returns registrable domain in lowercase or empty string on failure
 */
export function normalizeDomain(input: string): string {
	if (!input || typeof input !== 'string') {
		return '';
	}

	try {
		// If it looks like a full URL – extract hostname first
		const url = input.startsWith('http://') || input.startsWith('https://')
			? new URL(input)
			: new URL('https://' + input);

		const hostname = url.hostname;

		// Handle IP addresses directly
		if (/^(?:\d+\.){3}\d+$/.test(hostname) || hostname.includes(':')) {
			return hostname.toLowerCase();
		}

		return extractRegistrableDomain(hostname);
	} catch {
		// Last resort – try direct hostname parsing
		return extractRegistrableDomain(input.split('/')[0].split(':')[0]);
	}
}

/**
 * Simple validation of a domain string.
 * Does NOT guarantee RFC compliance, only filters obvious garbage.
 */
export function isValidDomain(domain: string): boolean {
	if (!domain || typeof domain !== 'string') return false;
	return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || /^(?:\d+\.){3}\d+$/.test(domain);
}

/**
 * Checks whether two domains belong to the same registrable entity.
 *
 * @example
 *   sameEntity("shop.example.com", "blog.example.com") → true
 *   sameEntity("example.co.uk", "example.com")          → false
 */
export function sameEntity(a: string, b: string): boolean {
	if (!a || !b) return false;
	const domainA = normalizeDomain(a);
	const domainB = normalizeDomain(b);
	return domainA === domainB && domainA !== '';
}

/**
 * Returns true for private/local addresses that should never be sent to external APIs.
 */
export function isPrivateHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	return (
		lower === 'localhost' ||
		lower.endsWith('.localhost') ||
		lower.startsWith('127.') ||
		lower.startsWith('10.') ||
		lower.startsWith('192.168.') ||
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower) ||
		lower.endsWith('.local') ||
		lower.endsWith('.internal')
	);
}

export {
	extractRegistrableDomain as extractSLD,
	isSubdomain,
};