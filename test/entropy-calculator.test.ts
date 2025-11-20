/**
 * @file tests/entropy-calculator.test.ts
 * @description Unit tests for EntropyMetricCalculator (M2)
 * @uses src/analysis/entropy-calculator.ts
 * @uses types.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntropyMetricCalculator } from '../src/background/analysis/entropy-calculator.ts';
import type { Configuration } from '../src/types/index.ts';

vi.mock('../src/background/storage/configuration-store.ts', () => ({
	getConfig: vi.fn(),
}));

import { getConfig } from '../src/background/storage/configuration-store.ts';

describe('EntropyMetricCalculator', () => {
	let calculator: EntropyMetricCalculator;
	let mockConfig: Configuration;

	beforeEach(() => {
		calculator = new EntropyMetricCalculator();

		// Default configuration with entropy enabled
		mockConfig = {
			enabled: true,
			sensitivity: 'balanced',
			privacy: {
				collectStatistics: false,
				allowTelemetry: false,
			},
			thresholds: {
				critical: 0.80,
				high: 0.60,
				medium: 0.40,
			},
			weights: {
				M1: 0.15,
				M2: 0.25,
				M3: 0.40,
				M4: 0.20,
			},
			groups: {
				rate: { enabled: true, weight: 0.15 },
				entropy: { enabled: true, weight: 0.25 },
				reputation: {
					enabled: true,
					weight: 0.40,
					cacheTTL: 24,
					sources: [
						{ name: 'Google Safe Browsing', enabled: true, weight: 0.4 },
						{ name: 'PhishTank', enabled: true, weight: 0.3 },
						{ name: 'OpenPhish', enabled: true, weight: 0.2 },
						{ name: 'CERT Validity', enabled: true, weight: 0.1 },
					],
				},
				behavior: {
					enabled: true,
					weight: 0.20,
					minHistoryRequests: 5,
					minHistoryDays: 1,
				},
			},
			storage: {
				enabled: true,
				maxProfiles: 10000,
			},
		};

		vi.mocked(getConfig).mockResolvedValue(mockConfig);
	});

	describe('Legitimate domains (low entropy)', () => {
		it('should return low entropy for google.com', async () => {
			const result = await calculator.calculate('google.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBeLessThan(0.3);
			expect(result.confidence).toBeGreaterThan(0.4);
			expect(result.details).toHaveProperty('shannonEntropy');
			expect(result.details).toHaveProperty('normalized');
		});

		it('should return low entropy for facebook.com', async () => {
			const result = await calculator.calculate('facebook.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBeLessThan(0.3);
			expect(result.details.domainLength).toBeGreaterThan(0);
		});

		it('should return low entropy for amazon.co.uk', async () => {
			const result = await calculator.calculate('amazon.co.uk');

			expect(result.id).toBe('M2');
			expect(result.value).toBeLessThan(0.3);
			expect(result.confidence).toBeGreaterThan(0.3);
		});

		it('should return low entropy for wikipedia.org', async () => {
			const result = await calculator.calculate('wikipedia.org');

			expect(result.id).toBe('M2');
			expect(result.value).toBeLessThan(0.4);
			expect(result.details.uniqueChars).toBeGreaterThan(5);
		});
	});

	describe('DGA domains (high entropy)', () => {
		it('should return high entropy for random DGA domain', async () => {
			const result = await calculator.calculate('xj8k2p9qw4tz.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThan(0.6);
			expect(result.confidence).toBeGreaterThan(0.5);
			expect(result.details.shannonEntropy).toBeGreaterThan(2.5);
		});

		it('should return high entropy for long random DGA', async () => {
			const result = await calculator.calculate('a8b2c9d4e7f1g3h5i6j0k.net');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThan(0.7);
			expect(result.confidence).toBeGreaterThan(0.8);
		});

		it('should return high entropy for mixed-case normalized DGA', async () => {
			const result = await calculator.calculate('QwErTy123ZxC.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThan(0.5);
			expect(result.details.domainLength).toBeGreaterThan(0);
		});

		it('should return high entropy for all-unique-chars domain', async () => {
			const result = await calculator.calculate('abcdefghijk.org');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThan(0.6);
			expect(result.details.uniqueChars).toBe(11);
		});
	});

	describe('Edge cases', () => {
		it('should handle very short domain', async () => {
			const result = await calculator.calculate('a.io');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThanOrEqual(0);
			expect(result.value).toBeLessThanOrEqual(1);
			expect(result.confidence).toBeLessThan(0.2);
		});

		it('should handle very long domain (near RFC limit)', async () => {
			const longDomain = 'a'.repeat(240) + '.com';
			const result = await calculator.calculate(longDomain);

			expect(result.id).toBe('M2');
			expect(result.value).toBeLessThan(0.3); // Low entropy (all same char)
			expect(result.confidence).toBe(1.0); // Max confidence due to length
		});

		it('should handle domain with numbers and hyphens', async () => {
			const result = await calculator.calculate('test-123-domain.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThanOrEqual(0);
			expect(result.details.domainLength).toBeGreaterThan(0);
		});

		it('should handle subdomain (should keep only last 2 labels)', async () => {
			const result = await calculator.calculate('sub.example.com');

			expect(result.id).toBe('M2');
			expect(result.details.domainLength).toBeLessThan(15); // Only "examplecom"
		});

		it('should handle empty string gracefully', async () => {
			const result = await calculator.calculate('');

			expect(result.id).toBe('M2');
			expect(result.value).toBe(0.5);
			expect(result.confidence).toBe(0.1);
			expect(result.details.reason).toBe('invalid domain');
		});

		it('should handle domain with only special characters', async () => {
			const result = await calculator.calculate('---...@@@.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBeGreaterThanOrEqual(0);
			expect(result.value).toBeLessThanOrEqual(1);
		});
	});

	describe('Configuration handling', () => {
		it('should return zero score when entropy calculation disabled', async () => {
			mockConfig.groups.entropy.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const result = await calculator.calculate('google.com');

			expect(result.id).toBe('M2');
			expect(result.value).toBe(0.0);
			expect(result.confidence).toBe(0.0);
			expect(result.details.reason).toBe('entropy calculation disabled');
		});
	});
});