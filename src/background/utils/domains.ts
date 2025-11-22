import { extractRegistrableDomain, isSubdomain } from './psl.js';

export function normalizeDomain(input: string): string {
	if (!input || typeof input !== 'string') {
		return '';
	}

	try {
		const url = input.startsWith('http://') || input.startsWith('https://')
			? new URL(input)
			: new URL('https://' + input);

		const hostname = url.hostname;

		if (/^(?:\d+\.){3}\d+$/.test(hostname) || hostname.includes(':')) {
			return hostname.toLowerCase();
		}

		return extractRegistrableDomain(hostname);
	} catch {
		return extractRegistrableDomain(input.split('/')[0].split(':')[0]);
	}
}

export function isValidDomain(domain: string): boolean {
	if (!domain || typeof domain !== 'string') return false;
	return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || /^(?:\d+\.){3}\d+$/.test(domain);
}

export function sameEntity(a: string, b: string): boolean {
	if (!a || !b) return false;
	const domainA = normalizeDomain(a);
	const domainB = normalizeDomain(b);
	return domainA === domainB && domainA !== '';
}

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

