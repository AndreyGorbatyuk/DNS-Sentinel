/**
 * @file tests/rate-calculator.test.ts
 * @description Unit tests for RateMetricCalculator (M1)
 * @uses src/analysis/rate-calculator.ts
 * @uses types.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateMetricCalculator } from '../src/analysis/rate-calculator.ts';
import type { Configuration, RequestContext, DomainProfile } from '../../types.ts';

// Mock dependencies
vi.mock('../src/storage/configuration-store.ts', () => ({
	getConfig: vi.fn(),
}));

vi.mock('../src/storage/domain-statistics.ts', () => ({
	getDomainProfile: vi.fn(),
	updateDomainProfile: vi.fn(),
}));

vi.mock('../src/utils/normalization.ts', () => ({
	sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
	varianceFromM2: (stats: { count: number; M2: number }) =>
		stats.count > 1 ? stats.M2 / (stats.count - 1) : 0,
	computeZScore: (value: number, mean: number, variance: number) =>
		variance > 0 ? (value - mean) / Math.sqrt(variance) : 0,
}));

import { getConfig } from '../src/storage/configuration-store.ts';
import { getDomainProfile, updateDomainProfile } from '../src/storage/domain-statistics.ts';

describe('RateMetricCalculator', () => {
	let calculator: RateMetricCalculator;
	let mockConfig: Configuration;
	let baseTimestamp: number;

	beforeEach(() => {
		calculator = new RateMetricCalculator();
		baseTimestamp = Date.now();

		// Default configuration with rate enabled
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
		vi.mocked(updateDomainProfile).mockResolvedValue(undefined);
	});

	describe('First encounter (no profile)', () => {
		it('should create initial profile for new domain', async () => {
			vi.mocked(getDomainProfile).mockResolvedValue(null);

			const context: RequestContext = {
				url: 'https://example.com/page',
				timestamp: baseTimestamp,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeGreaterThanOrEqual(0);
			expect(result.value).toBeLessThanOrEqual(1);
			expect(result.confidence).toBeLessThan(0.5); // Low confidence for new domain
			expect(result.details).toHaveProperty('oneMinute');
			expect(result.details).toHaveProperty('fiveMinute');
			expect(result.details).toHaveProperty('fifteenMinute');

			// Verify updateDomainProfile was called
			expect(updateDomainProfile).toHaveBeenCalledWith(
				'example.com',
				expect.objectContaining({
					domain: 'example.com',
					requestCount: 1,
				})
			);
		});
	});

	describe('Normal traffic patterns', () => {
		it('should return low risk for steady low-rate traffic', async () => {
			const profile: DomainProfile = {
				domain: 'example.com',
				firstSeen: baseTimestamp - 3600000, // 1 hour ago
				lastSeen: baseTimestamp - 60000, // 1 minute ago
				requestCount: 10,
				timeSeries: {
					minutely: [baseTimestamp - 120000], // 1 request 2 minutes ago
					fiveMinute: [baseTimestamp - 120000],
					fifteenMinute: [baseTimestamp - 120000],
				},
				stats: {
					rate: {
						oneMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 10, mean: 1.0, M2: 0.5 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://example.com/page',
				timestamp: baseTimestamp,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeLessThan(0.5); // Normal traffic
			expect(result.confidence).toBeGreaterThan(0.1);
		});

		it('should handle gradual traffic increase', async () => {
			const now = baseTimestamp;
			const timestamps = Array.from({ length: 5 }, (_, i) => now - (5 - i) * 60000);

			const profile: DomainProfile = {
				domain: 'example.com',
				firstSeen: now - 3600000,
				lastSeen: now - 60000,
				requestCount: 20,
				timeSeries: {
					minutely: timestamps.slice(-2),
					fiveMinute: timestamps,
					fifteenMinute: timestamps,
				},
				stats: {
					rate: {
						oneMinute: { count: 20, mean: 2.0, M2: 1.0 },
						fiveMinute: { count: 20, mean: 2.0, M2: 1.0 },
						fifteenMinute: { count: 20, mean: 2.0, M2: 1.0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://example.com/api',
				timestamp: now,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeLessThan(0.6);
		});
	});

	describe('Rate anomalies (burst traffic)', () => {
		it('should detect sudden burst in 1-minute window', async () => {
			const now = baseTimestamp;
			const burstTimestamps = Array.from({ length: 50 }, (_, i) => now - i * 1000); // 50 requests in 50 seconds

			const profile: DomainProfile = {
				domain: 'malicious.com',
				firstSeen: now - 3600000,
				lastSeen: now - 60000,
				requestCount: 60,
				timeSeries: {
					minutely: burstTimestamps,
					fiveMinute: burstTimestamps,
					fifteenMinute: burstTimestamps,
				},
				stats: {
					rate: {
						oneMinute: { count: 60, mean: 5.0, M2: 10.0 },
						fiveMinute: { count: 60, mean: 5.0, M2: 10.0 },
						fifteenMinute: { count: 60, mean: 5.0, M2: 10.0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://malicious.com/track',
				timestamp: now,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('malicious.com', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeGreaterThan(0.6); // High anomaly score
			expect(result.details.oneMinute.count).toBeGreaterThan(10);
		});

		it('should detect sustained high-rate traffic over 5 minutes', async () => {
			const now = baseTimestamp;
			const timestamps = Array.from({ length: 100 }, (_, i) => now - i * 3000); // 100 requests over 5 minutes

			const profile: DomainProfile = {
				domain: 'suspicious.net',
				firstSeen: now - 7200000,
				lastSeen: now - 300000,
				requestCount: 150,
				timeSeries: {
					minutely: timestamps.slice(0, 20),
					fiveMinute: timestamps,
					fifteenMinute: timestamps,
				},
				stats: {
					rate: {
						oneMinute: { count: 150, mean: 3.0, M2: 5.0 },
						fiveMinute: { count: 150, mean: 3.0, M2: 5.0 },
						fifteenMinute: { count: 150, mean: 3.0, M2: 5.0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://suspicious.net/beacon',
				timestamp: now,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('suspicious.net', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeGreaterThan(0.5);
			expect(result.details.fiveMinute.count).toBeGreaterThan(50);
		});

		it('should handle extreme burst (100+ requests per minute)', async () => {
			const now = baseTimestamp;
			const extremeBurst = Array.from({ length: 120 }, (_, i) => now - i * 500); // 120 requests in 60 seconds

			const profile: DomainProfile = {
				domain: 'attacker.xyz',
				firstSeen: now - 3600000,
				lastSeen: now - 60000,
				requestCount: 200,
				timeSeries: {
					minutely: extremeBurst,
					fiveMinute: extremeBurst,
					fifteenMinute: extremeBurst,
				},
				stats: {
					rate: {
						oneMinute: { count: 200, mean: 10.0, M2: 50.0 },
						fiveMinute: { count: 200, mean: 10.0, M2: 50.0 },
						fifteenMinute: { count: 200, mean: 10.0, M2: 50.0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://attacker.xyz/payload',
				timestamp: now,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('attacker.xyz', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeGreaterThan(0.7); // Very high risk
			expect(result.confidence).toBeGreaterThan(0.5);
		});
	});

	describe('Edge cases', () => {
		it('should handle profile with empty time series', async () => {
			const profile: DomainProfile = {
				domain: 'empty.com',
				firstSeen: baseTimestamp - 3600000,
				lastSeen: baseTimestamp - 60000,
				requestCount: 0,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 0, mean: 0, M2: 0 },
						fiveMinute: { count: 0, mean: 0, M2: 0 },
						fifteenMinute: { count: 0, mean: 0, M2: 0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://empty.com/page',
				timestamp: baseTimestamp,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('empty.com', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBeGreaterThanOrEqual(0);
			expect(result.value).toBeLessThanOrEqual(1);
		});

		it('should handle very old timestamps (stale profile)', async () => {
			const now = baseTimestamp;
			const oldTimestamps = [now - 86400000]; // 1 day old

			const profile: DomainProfile = {
				domain: 'stale.org',
				firstSeen: now - 172800000, // 2 days ago
				lastSeen: now - 86400000, // 1 day ago
				requestCount: 5,
				timeSeries: {
					minutely: oldTimestamps,
					fiveMinute: oldTimestamps,
					fifteenMinute: oldTimestamps,
				},
				stats: {
					rate: {
						oneMinute: { count: 5, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 5, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 5, mean: 1.0, M2: 0.5 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://stale.org/page',
				timestamp: now,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('stale.org', context);

			expect(result.id).toBe('M1');
			expect(result.details.oneMinute.count).toBe(0); // No requests in recent windows
		});
	});

	describe('Configuration handling', () => {
		it('should return zero score when rate calculation disabled', async () => {
			mockConfig.groups.rate.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const context: RequestContext = {
				url: 'https://example.com/page',
				timestamp: baseTimestamp,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M1');
			expect(result.value).toBe(0.0);
			expect(result.confidence).toBe(0.0);
			expect(result.details.reason).toBe('rate calculation disabled');
		});
	});
});