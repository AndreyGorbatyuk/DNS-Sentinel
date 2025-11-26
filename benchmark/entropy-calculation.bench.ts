/**
 * @file benchmarks/entropy-calculation.bench.ts
 * @description Performance benchmarks for EntropyMetricCalculator (M2)
 * Focus on hotspot operations: Shannon entropy, character frequency, normalization
 * @uses src/analysis/entropy-calculator.ts
 * @uses types.ts
 */

import { beforeEach, bench, describe } from 'vitest';
import { EntropyMetricCalculator } from '../src/background/analysis/entropy-calculator.js';
import type { MetricResult } from '../src/types/index.js';

// Mock chrome.storage.local (minimal for entropy calculator)
type StorageRecord = Record<string, unknown>;

const mockChromeStorage = {
	local: {
		get: async (key: string) => ({}),
		set: async (items: StorageRecord) => {},
	},
};

(globalThis as any).chrome = mockChromeStorage;

// Mock configuration-store
const mockGetConfig = async () => ({
	enabled: true,
	sensitivity: 'balanced' as const,
	privacy: { collectStatistics: false, allowTelemetry: false },
	thresholds: { critical: 0.8, high: 0.6, medium: 0.4 },
	weights: { M1: 0.15, M2: 0.25, M3: 0.4, M4: 0.2 },
	groups: {
		rate: { enabled: true, weight: 0.15 },
		entropy: { enabled: true, weight: 0.25 },
		reputation: {
			enabled: true,
			weight: 0.4,
			cacheTTL: 24,
			sources: [
				{ name: 'Google Safe Browsing', enabled: true, weight: 0.4 },
				{ name: 'PhishTank', enabled: true, weight: 0.3 },
				{ name: 'OpenPhish', enabled: true, weight: 0.2 },
				{ name: 'CERT Validity', enabled: true, weight: 0.1 },
			],
		},
		behavior: { enabled: true, weight: 0.2, minHistoryRequests: 5, minHistoryDays: 1 },
	},
	storage: { enabled: true, maxProfiles: 10000 },
});

// Helper: Generate random domain names
function generateRandomDomain(length: number, entropy: 'low' | 'medium' | 'high'): string {
	const lowEntropyChars =
		'aaaaabbbcccdddeeefffggghhhiiijjjkkklllmmmnnnooopppqqqrrrssstttuuuvvvwwwxxxyyyzzz';
	const mediumEntropyChars = 'abcdefghijklmnopqrstuvwxyz';
	const highEntropyChars = 'abcdefghijklmnopqrstuvwxyz0123456789';

	let chars: string;
	switch (entropy) {
		case 'low':
			chars = lowEntropyChars;
			break;
		case 'medium':
			chars = mediumEntropyChars;
			break;
		case 'high':
			chars = highEntropyChars;
			break;
	}

	let domain = '';
	for (let i = 0; i < length; i++) {
		domain += chars[Math.floor(Math.random() * chars.length)];
	}
	return `${domain}.com`;
}

describe('EntropyMetricCalculator Benchmarks', () => {
	let calculator: EntropyMetricCalculator;

	beforeEach(() => {
		calculator = new EntropyMetricCalculator();
	});

	describe('HOTSPOT: Domain Normalization', () => {
		bench('normalize short domain (google.com)', () => {
			const domain = 'google.com';
			const normalized = domain
				.toLowerCase()
				.split('.')
				.slice(-2)
				.join('.')
				.replace(/[^a-z]/g, '');
		});

		bench('normalize medium domain (subdomain.example.co.uk)', () => {
			const domain = 'subdomain.example.co.uk';
			const normalized = domain
				.toLowerCase()
				.split('.')
				.slice(-2)
				.join('.')
				.replace(/[^a-z]/g, '');
		});

		bench('normalize long domain (very-long-subdomain-name.example.com)', () => {
			const domain = 'very-long-subdomain-name.example.com';
			const normalized = domain
				.toLowerCase()
				.split('.')
				.slice(-2)
				.join('.')
				.replace(/[^a-z]/g, '');
		});

		bench('normalize with numbers and hyphens (test-123-abc.com)', () => {
			const domain = 'test-123-abc.com';
			const normalized = domain
				.toLowerCase()
				.split('.')
				.slice(-2)
				.join('.')
				.replace(/[^a-z]/g, '');
		});

		bench('normalize batch (10 domains)', () => {
			const domains = [
				'google.com',
				'facebook.com',
				'amazon.com',
				'twitter.com',
				'linkedin.com',
				'github.com',
				'stackoverflow.com',
				'reddit.com',
				'youtube.com',
				'wikipedia.org',
			];
			domains.map((domain) =>
				domain
					.toLowerCase()
					.split('.')
					.slice(-2)
					.join('.')
					.replace(/[^a-z]/g, ''),
			);
		});
	});

	describe('HOTSPOT: Character Frequency Counting', () => {
		bench('frequency map for short string (10 chars)', () => {
			const str = 'googlecom';
			const freq = new Map<string, number>();
			for (const char of str) {
				freq.set(char, (freq.get(char) || 0) + 1);
			}
		});

		bench('frequency map for medium string (20 chars)', () => {
			const str = 'verylongdomainname';
			const freq = new Map<string, number>();
			for (const char of str) {
				freq.set(char, (freq.get(char) || 0) + 1);
			}
		});

		bench('frequency map for long string (50 chars)', () => {
			const str = 'a'.repeat(25) + 'b'.repeat(25); // Low entropy
			const freq = new Map<string, number>();
			for (const char of str) {
				freq.set(char, (freq.get(char) || 0) + 1);
			}
		});

		bench('frequency map for high entropy (26 unique chars)', () => {
			const str = 'abcdefghijklmnopqrstuvwxyz';
			const freq = new Map<string, number>();
			for (const char of str) {
				freq.set(char, (freq.get(char) || 0) + 1);
			}
		});

		bench('frequency map batch (10 strings)', () => {
			const strings = [
				'google',
				'facebook',
				'amazon',
				'twitter',
				'linkedin',
				'github',
				'stackoverflow',
				'reddit',
				'youtube',
				'wikipedia',
			];
			strings.map((str) => {
				const freq = new Map<string, number>();
				for (const char of str) {
					freq.set(char, (freq.get(char) || 0) + 1);
				}
			});
		});
	});

	describe('HOTSPOT: Shannon Entropy Calculation', () => {
		bench('Shannon entropy for uniform distribution (all chars equal)', () => {
			const freq = new Map([
				['a', 10],
				['b', 10],
				['c', 10],
				['d', 10],
			]);
			const totalLength = 40;
			let entropy = 0;
			for (const count of freq.values()) {
				const probability = count / totalLength;
				if (probability > 0) {
					entropy -= probability * Math.log2(probability);
				}
			}
		});

		bench('Shannon entropy for skewed distribution (low entropy)', () => {
			const freq = new Map([
				['a', 35],
				['b', 3],
				['c', 1],
				['d', 1],
			]);
			const totalLength = 40;
			let entropy = 0;
			for (const count of freq.values()) {
				const probability = count / totalLength;
				if (probability > 0) {
					entropy -= probability * Math.log2(probability);
				}
			}
		});

		bench('Shannon entropy for random distribution (medium entropy)', () => {
			const freq = new Map([
				['a', 12],
				['b', 8],
				['c', 10],
				['d', 10],
			]);
			const totalLength = 40;
			let entropy = 0;
			for (const count of freq.values()) {
				const probability = count / totalLength;
				if (probability > 0) {
					entropy -= probability * Math.log2(probability);
				}
			}
		});

		bench('Shannon entropy batch (10 distributions)', () => {
			const distributions = Array.from({ length: 10 }, (_, i) => {
				return new Map([
					['a', 10 + i],
					['b', 10 - i],
					['c', 10],
					['d', 10],
				]);
			});

			distributions.map((freq) => {
				const totalLength = 40;
				let entropy = 0;
				for (const count of freq.values()) {
					const probability = count / totalLength;
					if (probability > 0) {
						entropy -= probability * Math.log2(probability);
					}
				}
			});
		});
	});

	describe('HOTSPOT: Max Entropy Calculation', () => {
		bench('max entropy for short domain (L=10)', () => {
			const length = 10;
			const alphabetSize = 26;
			const effectiveAlphabet = Math.min(length, alphabetSize);
			const maxEntropy = Math.log2(effectiveAlphabet);
		});

		bench('max entropy for medium domain (L=20)', () => {
			const length = 20;
			const alphabetSize = 26;
			const effectiveAlphabet = Math.min(length, alphabetSize);
			const maxEntropy = Math.log2(effectiveAlphabet);
		});

		bench('max entropy for long domain (L=50)', () => {
			const length = 50;
			const alphabetSize = 26;
			const effectiveAlphabet = Math.min(length, alphabetSize);
			const maxEntropy = Math.log2(effectiveAlphabet);
		});

		bench('max entropy batch (10 lengths)', () => {
			const lengths = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
			const alphabetSize = 26;
			lengths.map((length) => {
				const effectiveAlphabet = Math.min(length, alphabetSize);
				return Math.log2(effectiveAlphabet);
			});
		});
	});

	describe('HOTSPOT: Sigmoid Normalization', () => {
		bench('sigmoid normalization (low entropy ratio)', () => {
			const entropy = 2.0;
			const maxEntropy = 4.0;
			const ratio = entropy / maxEntropy;
			const normalized = 1 / (1 + Math.exp(-5 * (ratio - 0.7)));
		});

		bench('sigmoid normalization (medium entropy ratio)', () => {
			const entropy = 3.0;
			const maxEntropy = 4.0;
			const ratio = entropy / maxEntropy;
			const normalized = 1 / (1 + Math.exp(-5 * (ratio - 0.7)));
		});

		bench('sigmoid normalization (high entropy ratio)', () => {
			const entropy = 3.8;
			const maxEntropy = 4.0;
			const ratio = entropy / maxEntropy;
			const normalized = 1 / (1 + Math.exp(-5 * (ratio - 0.7)));
		});

		bench('sigmoid batch (10 ratios)', () => {
			const ratios = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
			ratios.map((ratio) => 1 / (1 + Math.exp(-5 * (ratio - 0.7))));
		});
	});

	describe('End-to-End: M2 Calculation', () => {
		bench('M2: legitimate domain (google.com)', async () => {
			await calculator.calculate('google.com');
		});

		bench('M2: legitimate domain (wikipedia.org)', async () => {
			await calculator.calculate('wikipedia.org');
		});

		bench('M2: DGA domain (short, xj8k2p9qw4tz.com)', async () => {
			await calculator.calculate('xj8k2p9qw4tz.com');
		});

		bench('M2: DGA domain (long, a8b2c9d4e7f1g3h5i6j0k.net)', async () => {
			await calculator.calculate('a8b2c9d4e7f1g3h5i6j0k.net');
		});

		bench('M2: very short domain (a.io)', async () => {
			await calculator.calculate('a.io');
		});

		bench('M2: very long domain (240 chars)', async () => {
			const longDomain = `${'a'.repeat(240)}.com`;
			await calculator.calculate(longDomain);
		});

		bench('M2: subdomain (sub.example.com)', async () => {
			await calculator.calculate('sub.example.com');
		});

		bench('M2: domain with numbers (test-123.com)', async () => {
			await calculator.calculate('test-123.com');
		});
	});

	describe('Performance Regression: Domain Length', () => {
		bench('M2: length=5', async () => {
			const domain = `${'a'.repeat(5)}.com`;
			await calculator.calculate(domain);
		});

		bench('M2: length=10', async () => {
			const domain = `${'a'.repeat(10)}.com`;
			await calculator.calculate(domain);
		});

		bench('M2: length=20', async () => {
			const domain = `${'a'.repeat(20)}.com`;
			await calculator.calculate(domain);
		});

		bench('M2: length=50', async () => {
			const domain = `${'a'.repeat(50)}.com`;
			await calculator.calculate(domain);
		});

		bench('M2: length=100', async () => {
			const domain = `${'a'.repeat(100)}.com`;
			await calculator.calculate(domain);
		});

		bench('M2: length=200', async () => {
			const domain = `${'a'.repeat(200)}.com`;
			await calculator.calculate(domain);
		});
	});

	describe('String Operations Performance', () => {
		bench('toLowerCase (10 chars)', () => {
			const str = 'GoogleCom';
			str.toLowerCase();
		});

		bench('toLowerCase (50 chars)', () => {
			const str = 'VeryLongDomainNameWithMixedCaseLettersForBenchmark';
			str.toLowerCase();
		});

		bench('split + slice + join (google.com)', () => {
			const domain = 'google.com';
			domain.split('.').slice(-2).join('.');
		});

		bench('split + slice + join (sub.example.co.uk)', () => {
			const domain = 'sub.example.co.uk';
			domain.split('.').slice(-2).join('.');
		});

		bench('replace regex /[^a-z]/g (10 chars)', () => {
			const str = 'test-123-abc';
			str.replace(/[^a-z]/g, '');
		});

		bench('replace regex /[^a-z]/g (50 chars)', () => {
			const str = 'very-long-domain-name-123-with-456-numbers-789-end';
			str.replace(/[^a-z]/g, '');
		});
	});

	describe('Math Operations Performance', () => {
		bench('Math.log2 (single)', () => {
			Math.log2(26);
		});

		bench('Math.log2 (batch 10)', () => {
			const values = [2, 4, 8, 16, 26, 32, 64, 100, 128, 256];
			values.map((v) => Math.log2(v));
		});

		bench('Math.exp (single)', () => {
			Math.exp(-2.5);
		});

		bench('Math.exp (batch 10)', () => {
			const values = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4];
			values.map((v) => Math.exp(v));
		});

		bench('Math.log2 vs Math.exp (combined)', () => {
			const x = 2.5;
			const log = Math.log2(x);
			const exp = Math.exp(-x);
			const combined = log + exp;
			void combined;
		});
	});

	describe('Batch Processing: Multiple Domains', () => {
		bench('M2: batch 10 legitimate domains', async () => {
			const domains = [
				'google.com',
				'facebook.com',
				'amazon.com',
				'twitter.com',
				'linkedin.com',
				'github.com',
				'stackoverflow.com',
				'reddit.com',
				'youtube.com',
				'wikipedia.org',
			];
			const results: MetricResult[] = [];
			for (const domain of domains) {
				results.push(await calculator.calculate(domain));
			}
		});

		bench('M2: batch 10 DGA domains', async () => {
			const domains = Array.from({ length: 10 }, () => generateRandomDomain(15, 'high'));
			const results: MetricResult[] = [];
			for (const domain of domains) {
				results.push(await calculator.calculate(domain));
			}
		});

		bench('M2: batch 10 mixed domains', async () => {
			const domains = [
				'google.com',
				'xj8k2p9qw4tz.com',
				'facebook.com',
				'a8b2c9d4e7f1.net',
				'amazon.com',
				'qwertyuiop.org',
				'twitter.com',
				'zxcvbnm123.com',
				'linkedin.com',
				'abcdefghij.io',
			];
			const results: MetricResult[] = [];
			for (const domain of domains) {
				results.push(await calculator.calculate(domain));
			}
		});
	});
});
