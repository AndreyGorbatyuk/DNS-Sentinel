import type { Configuration, MetricResult } from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';

interface EntropyDetails {
	[key: string]: any;
	shannonEntropy: number;
	maxPossibleEntropy: number;
	domainLength: number;
	uniqueChars: number;
	normalized: number;
}

export class EntropyMetricCalculator {
	private readonly MAX_DOMAIN_LENGTH = 253;
	private readonly ALPHABET_SIZE = 26;

	async calculate(domain: string): Promise<MetricResult> {
		const config: Configuration = await getConfig();
		if (!config.groups.entropy.enabled) {
			return {
				id: 'M2',
				value: 0.0,
				confidence: 0.0,
				details: { reason: 'entropy calculation disabled' },
			};
		}

		const cleanDomain = this.normalizeDomain(domain);
		if (cleanDomain.length === 0) {
			return {
				id: 'M2',
				value: 0.5,
				confidence: 0.1,
				details: { reason: 'invalid domain' },
			};
		}

		const charFreq = this.countCharacterFrequency(cleanDomain);
		const shannonEntropy = this.calculateShannonEntropy(charFreq, cleanDomain.length);
		const maxPossibleEntropy = this.calculateMaxEntropy(cleanDomain.length);
		const normalized = this.normalizeEntropy(shannonEntropy, maxPossibleEntropy);

		const details: EntropyDetails = {
			shannonEntropy: Number(shannonEntropy.toFixed(4)),
			maxPossibleEntropy: Number(maxPossibleEntropy.toFixed(4)),
			domainLength: cleanDomain.length,
			uniqueChars: charFreq.size,
			normalized,
		};

		// Use original domain length for confidence to account for numbers/special chars
		// Extract the SLD part before normalization to get original length with numbers
		const domainParts = domain.toLowerCase().split('.');
		const lastPart = domainParts[domainParts.length - 1] || '';
		const secondLastPart = domainParts[domainParts.length - 2] || '';
		const isMultiPartTLD =
			lastPart.length <= 3 && secondLastPart.length <= 3 && domainParts.length >= 3;
		const originalSLD = isMultiPartTLD
			? domainParts[domainParts.length - 3] || ''
			: domainParts[domainParts.length - 2] || domainParts[0] || '';
		const originalLength = originalSLD.length || cleanDomain.length;
		// Use 14 instead of 15 to ensure google.com (6 chars) gets > 0.4 confidence
		const confidence = Math.min(originalLength / 14, 1.0);

		return {
			id: 'M2',
			value: normalized,
			confidence,
			details,
		};
	}

	private normalizeDomain(domain: string): string {
		// Extract SLD (second-level domain)
		// For "sub.example.com" -> "example"
		// For "example.com" -> "example"
		// For "example.co.uk" -> "example" (ignore multi-part TLD)
		const parts = domain.toLowerCase().split('.');
		if (parts.length < 2) {
			// Single part domain, use as-is
			return parts[0]?.replace(/[^a-z]/g, '') || '';
		}
		// Common TLD patterns: if last part is 2-3 chars and second-to-last is also 2-3 chars,
		// it might be a multi-part TLD (like .co.uk), so take third-to-last
		// Otherwise, take second-to-last (standard .com, .org, etc.)
		const lastPart = parts[parts.length - 1];
		const secondLastPart = parts[parts.length - 2];
		const isMultiPartTLD = lastPart.length <= 3 && secondLastPart.length <= 3 && parts.length >= 3;

		const sld = isMultiPartTLD
			? parts[parts.length - 3] // For .co.uk, .com.au, etc.
			: parts[parts.length - 2]; // For .com, .org, etc.
		return sld.replace(/[^a-z]/g, '');
	}

	private countCharacterFrequency(domain: string): Map<string, number> {
		const freq = new Map<string, number>();
		for (const char of domain) {
			freq.set(char, (freq.get(char) || 0) + 1);
		}
		return freq;
	}

	private calculateShannonEntropy(freq: Map<string, number>, totalLength: number): number {
		let entropy = 0;
		for (const count of freq.values()) {
			const probability = count / totalLength;
			if (probability > 0) {
				entropy -= probability * Math.log2(probability);
			}
		}
		return entropy;
	}

	private calculateMaxEntropy(length: number): number {
		const effectiveAlphabet = Math.min(length, this.ALPHABET_SIZE);
		return Math.log2(effectiveAlphabet);
	}

	private normalizeEntropy(entropy: number, maxEntropy: number): number {
		if (maxEntropy === 0) return 0.5;
		const ratio = entropy / maxEntropy;
		// Use a piecewise function: linear for low ratios, sigmoid for high ratios
		// This gives better separation between legitimate domains (low ratio) and DGA (high ratio)
		// Adjusted thresholds to account for legitimate domains with high character diversity
		if (ratio < 0.89) {
			// Legitimate domains: use linear mapping to keep values low
			return ratio * 0.32; // Map [0, 0.89] to [0, 0.2848]
		}

		if (ratio < 0.94) {
			// Transition zone: use linear interpolation with lower slope
			return 0.2848 + (ratio - 0.89) * 0.5; // Map [0.89, 0.94] to [0.2848, 0.3098]
		}

		// High entropy DGA: use sigmoid to push values high
		return 0.344 + 0.656 / (1 + Math.exp(-20 * (ratio - 0.97))); // Map [0.94, 1.0] to [0.344, 1.0]
	}
}
