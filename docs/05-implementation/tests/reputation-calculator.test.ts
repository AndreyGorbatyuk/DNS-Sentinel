/**
 * @file tests/reputation-calculator.test.ts
 * @description Unit tests for ReputationMetricCalculator (M3)
 * @uses src/analysis/reputation-calculator.ts
 * @uses types.ts
 */

/// <reference path="../../chrome-stubs.ts" />

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReputationMetricCalculator } from '../src/analysis/reputation-calculator.ts';
import type { Configuration, DomainProfile } from '../../types.ts';

// Mock dependencies
vi.mock('../src/storage/configuration-store.ts', () => ({
	getConfig: vi.fn(),
}));

vi.mock('../src/storage/domain-statistics.ts', () => ({
	getDomainProfile: vi.fn(),
}));

// Mock chrome.storage.local
const mockChromeStorage = {
	local: {
		get: vi.fn(),
		set: vi.fn(),
	},
};

// Assign to globalThis instead of global
(globalThis as any).chrome = mockChromeStorage;

// Mock fetch for API calls
(globalThis as any).fetch = vi.fn();

import { getConfig } from '../src/storage/configuration-store.ts';
import { getDomainProfile } from '../src/storage/domain-statistics.ts';

describe('ReputationMetricCalculator', () => {
	let calculator: ReputationMetricCalculator;
	let mockConfig: Configuration;
	let baseTimestamp: number;

	beforeEach(() => {
		calculator = new ReputationMetricCalculator();
		baseTimestamp = Date.now();

		// Default configuration with reputation enabled
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

		// Reset mocks
		vi.mocked(mockChromeStorage.local.get).mockReset();
		vi.mocked(mockChromeStorage.local.set).mockReset();
		vi.mocked(fetch).mockReset();
	});

	describe('Cache behavior', () => {
		it('should use cached reputation data within TTL', async () => {
			const now = baseTimestamp;
			const cachedTimestamp = now - 3600000; // 1 hour ago (within 24h TTL)

			// Mock cache hit
			vi.mocked(mockChromeStorage.local.get).mockImplementation((key: any) => {
				if (typeof key === 'string' && key.startsWith('rep_')) {
					return Promise.resolve({
						[key]: {
							name: 'Google Safe Browsing',
							score: 0.9, // Malicious
							confidence: 0.95,
							cachedAt: cachedTimestamp,
						},
					});
				}
				return Promise.resolve({});
			});

			const profile: DomainProfile = {
				domain: 'malicious.com',
				firstSeen: now - 86400000, // 1 day old
				lastSeen: now - 3600000,
				requestCount: 10,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 10, mean: 1.0, M2: 0.5 },
					},
				},
				reputationCache: [
					{
						source: 'Google Safe Browsing',
						score: 0.9,
						timestamp: cachedTimestamp,
					},
				],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const result = await calculator.calculate('malicious.com', profile);

			expect(result.id).toBe('M3');
			expect(result.value).toBeGreaterThan(0.5); // High risk due to blacklist
			expect(result.details.sources).toHaveLength(5); // 3 blacklists + age + cert

			// Verify fetch was NOT called (cache hit)
			expect(fetch).not.toHaveBeenCalled();
		});

		it('should refetch when cache expired (beyond TTL)', async () => {
			const now = baseTimestamp;
			const expiredTimestamp = now - 86400000 - 3600000; // 25 hours ago (beyond 24h TTL)

			// Mock expired cache
			vi.mocked(mockChromeStorage.local.get).mockImplementation((key: any) => {
				if (typeof key === 'string' && key.startsWith('rep_')) {
					return Promise.resolve({
						[key]: {
							name: 'Google Safe Browsing',
							score: 0.9,
							confidence: 0.95,
							cachedAt: expiredTimestamp, // Expired!
						},
					});
				}
				return Promise.resolve({});
			});

			// Mock fresh API response
			vi.mocked(fetch).mockResolvedValue({
				json: async () => ({ malicious: false, confidence: 0.8 }),
				ok: true,
			} as Response);

			vi.mocked(mockChromeStorage.local.set).mockResolvedValue(undefined);

			const profile: DomainProfile = {
				domain: 'example.com',
				firstSeen: now - 2592000000, // 30 days old
				lastSeen: now - 3600000,
				requestCount: 50,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 50, mean: 2.0, M2: 1.0 },
						fiveMinute: { count: 50, mean: 2.0, M2: 1.0 },
						fifteenMinute: { count: 50, mean: 2.0, M2: 1.0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const result = await calculator.calculate('example.com', profile);

			expect(result.id).toBe('M3');

			// Verify fetch WAS called (cache miss/expired)
			expect(fetch).toHaveBeenCalled();
			// Verify cache was updated
			expect(mockChromeStorage.local.set).toHaveBeenCalled();
		});

		it('should handle cache miss and query API', async () => {
			const now = baseTimestamp;

			// Mock cache miss
			vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

			// Mock API responses
			vi.mocked(fetch).mockResolvedValue({
				json: async () => ({ malicious: true, confidence: 0.9 }),
				ok: true,
			} as Response);

			vi.mocked(mockChromeStorage.local.set).mockResolvedValue(undefined);

			const profile: DomainProfile = {
				domain: 'suspicious.net',
				firstSeen: now - 604800000, // 7 days old
				lastSeen: now - 60000,
				requestCount: 20,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 20, mean: 1.5, M2: 0.8 },
						fiveMinute: { count: 20, mean: 1.5, M2: 0.8 },
						fifteenMinute: { count: 20, mean: 1.5, M2: 0.8 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const result = await calculator.calculate('suspicious.net', profile);

			expect(result.id).toBe('M3');
			expect(result.value).toBeGreaterThan(0.6); // High risk

			// Verify API was called
			expect(fetch).toHaveBeenCalled();
			// Verify result was cached
			expect(mockChromeStorage.local.set).toHaveBeenCalled();
		});
	});

	describe('Domain age penalty', () => {
		it('should penalize very young domains (< 30 days)', async () => {
			const now = baseTimestamp;

			// Mock no cache (will use fallback)
			vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});
			vi.mocked(fetch).mockResolvedValue({
				json: async () => ({ malicious: false, confidence: 0.8 }),
				ok: true,
			} as Response);

			const youngProfile: DomainProfile = {
				domain: 'newsite.xyz',
				firstSeen: now - 86400000 * 5, // 5 days old
				lastSeen: now - 3600000,
				requestCount: 10,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 10, mean: 1.0, M2: 0.5 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(youngProfile);

			const result = await calculator.calculate('newsite.xyz', youngProfile);

			expect(result.id).toBe('M3');
			expect(result.value).toBeGreaterThan(0.4); // Age penalty applied
			expect(result.details.domainAgeDays).toBe(5);

			// Find domain age source in details
			const ageSource = result.details.sources.find(
				(s: any) => s.name === 'Domain Age'
			);
			expect(ageSource).toBeDefined();
			expect(ageSource.score).toBeGreaterThan(0.5); // Penalty score
		});

		it('should not penalize mature domains (> 30 days)', async () => {
			const now = baseTimestamp;

			// Mock benign API responses
			vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});
			vi.mocked(fetch).mockResolvedValue({
				json: async () => ({ malicious: false, confidence: 0.9 }),
				ok: true,
			} as Response);

			const matureProfile: DomainProfile = {
				domain: 'established.com',
				firstSeen: now - 86400000 * 90, // 90 days old
				lastSeen: now - 3600000,
				requestCount: 200,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 200, mean: 5.0, M2: 3.0 },
						fiveMinute: { count: 200, mean: 5.0, M2: 3.0 },
						fifteenMinute: { count: 200, mean: 5.0, M2: 3.0 },
					},
				},
			};

			vi.mocked(getDomainProfile).mockResolvedValue(matureProfile);

			const result = await calculator.calculate('established.com', matureProfile);

			expect(result.id).toBe('M3');
			expect(result.value).toBeLessThan(0.3); // Low risk
			expect(result.details.domainAgeDays).toBe(90);

			// Find domain age source
			const ageSource = result.details.sources.find(
				(s: any) => s.name === 'Domain Age'
			);
			expect(ageSource).toBeDefined();
			expect(ageSource.score).toBe(0.0); // No penalty
		});
	});

	describe('Configuration handling', () => {
		it('should return zero score when reputation calculation disabled', async () => {
			mockConfig.groups.reputation.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const result = await calculator.calculate('example.com');

			expect(result.id).toBe('M3');
			expect(result.value).toBe(0.0);
			expect(result.confidence).toBe(0.0);
			expect(result.details.reason).toBe('reputation calculation disabled');

			// Verify no API calls were made
			expect(fetch).not.toHaveBeenCalled();
		});
	});
});