import type { MetricResult, Configuration } from '../../types/index.ts';
import { getConfig } from '../storage/configuration-store.ts';

interface EntropyDetails {
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

		const confidence = Math.min(cleanDomain.length / 20, 1.0);

		return {
			id: 'M2',
			value: normalized,
			confidence,
			details,
		};
	}

	private normalizeDomain(domain: string): string {
		return domain
			.toLowerCase()
			.split('.')
			.slice(-2)
			.join('.')
			.replace(/[^a-z]/g, '');
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
		return 1 / (1 + Math.exp(-5 * (ratio - 0.7)));
	}
}

