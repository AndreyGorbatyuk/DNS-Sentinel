/**
 * @file tests/reputation-calculator.test.ts
 * @description Unit tests for ReputationMetricCalculator (M3)
 * @uses src/analysis/reputation-calculator.ts
 * @uses types.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReputationMetricCalculator } from '../src/background/analysis/reputation-calculator.js';
import type { Configuration, DomainProfile } from '../src/types/index.js';

vi.mock('../src/background/storage/configuration-store.js', () => ({
	getConfig: vi.fn(),
}));

vi.mock('../src/background/storage/domain-statistics.js', () => ({
	getDomainProfile: vi.fn(),
}));

// Mock chrome.storage.local
const mockChromeStorage = {
	local: {
		get: vi.fn(),
		set: vi.fn(),
	},
};

// Assign to globalThis instead of global, using loose typing to avoid TS type conflicts
	if (typeof globalThis !== 'undefined') {
		(globalThis as any).chrome = mockChromeStorage;
		(globalThis as any).fetch = vi.fn();
		(globalThis as any).console = {
			warn: vi.fn(),
			error: vi.fn(),
		};
	}

type StorageKey = string | string[] | Record<string, unknown> | null;
type ReputationDetailsShape = {
	sources: Array<{ name: string } & Record<string, unknown>>;
};

import { getConfig } from '../src/background/storage/configuration-store.js';
import { getDomainProfile } from '../src/background/storage/domain-statistics.js';

describe('ReputationMetricCalculator', () => {
	let calculator: ReputationMetricCalculator;
	let mockConfig: Configuration;
	let baseTimestamp: number;

	function createTestProfile(domain: string, ageDays = 60): DomainProfile {
		const now = Date.now();
		return {
			domain,
			firstSeen: now - ageDays * 86400000,
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
	}

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
				critical: 0.8,
				high: 0.6,
				medium: 0.4,
			},
			weights: {
				M1: 0.15,
				M2: 0.25,
				M3: 0.4,
				M4: 0.2,
			},
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
				behavior: {
					enabled: true,
					weight: 0.2,
					minHistoryRequests: 5,
					minHistoryDays: 1,
				},
			},
			storage: {
				enabled: true,
				maxProfiles: 10000,
			},
			apiKeys: {
				googleSafeBrowsing: '',
				phishTank: '',
				virusTotal: '',
			},
		};

		vi.mocked(getConfig).mockResolvedValue(mockConfig);

		// Reset mocks
		vi.mocked(mockChromeStorage.local.get).mockReset();
		vi.mocked(mockChromeStorage.local.set).mockReset();
		vi.mocked(fetch).mockReset();
		vi.mocked(console.warn).mockClear();
		vi.mocked(console.error).mockClear();
	});

	describe('Cache behavior', () => {
		it('should use cached reputation data within TTL', async () => {
			const now = baseTimestamp;
			const cachedTimestamp = now - 3600000; // 1 hour ago (within 24h TTL)

			// Mock cache hit
			vi.mocked(mockChromeStorage.local.get).mockImplementation((key: StorageKey) => {
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
			vi.mocked(mockChromeStorage.local.get).mockImplementation((key: StorageKey) => {
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
			const details = result.details as ReputationDetailsShape;
			const ageSource = details.sources.find((source) => source.name === 'Domain Age')!;
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
			const details = result.details as ReputationDetailsShape;
			const ageSource = details.sources.find((source) => source.name === 'Domain Age')!;
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

	describe('API Key Handling', () => {
		beforeEach(() => {
			// Reset to default config with empty keys
			mockConfig.apiKeys = {
				googleSafeBrowsing: '',
				phishTank: '',
				virusTotal: '',
			};
			vi.mocked(getConfig).mockResolvedValue(mockConfig);
		});

		describe('Google Safe Browsing', () => {
			it('should include ?key= parameter in URL when API key is present', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: 'test-api-key-12345',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({}); // No cached entries

				vi.mocked(fetch).mockResolvedValue({
					json: async () => ({ matches: [], malicious: false }),
					ok: true,
				} as Response);

				await calculator.calculate('example.com', profile);

				expect(fetch).toHaveBeenCalled();
				const fetchCall = vi.mocked(fetch).mock.calls.find(
					(call) => (call[0] as string).includes('safebrowsing.googleapis.com'),
				);
				expect(fetchCall).toBeDefined();
				const url = fetchCall![0] as string;

				expect(url).toContain('https://safebrowsing.googleapis.com/v4/threatMatches:find?key=');
				expect(url).toContain(encodeURIComponent('test-api-key-12345'));
			});

			it('should NOT call API when API key is missing', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force check
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				await calculator.calculate('example.com', profile);

				const gsbCalls = vi.mocked(fetch).mock.calls.filter((call) =>
					(call[0] as string).includes('safebrowsing.googleapis.com'),
				);
				expect(gsbCalls).toHaveLength(0);
				expect(console.warn).toHaveBeenCalledWith('Google Safe Browsing skipped: no API key');
			});

			it('should skip when API key is whitespace only', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '   ',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force check
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				await calculator.calculate('example.com', profile);

				const gsbCalls = vi.mocked(fetch).mock.calls.filter((call) =>
					(call[0] as string).includes('safebrowsing.googleapis.com'),
				);
				expect(gsbCalls).toHaveLength(0);
				expect(console.warn).toHaveBeenCalledWith('Google Safe Browsing skipped: no API key');
			});
		});

		describe('PhishTank', () => {
			it('should include app_key in form data when API key is present', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '',
					phishTank: 'phishtank-key-abc123',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				vi.mocked(fetch).mockResolvedValue({
					json: async () => ({ results: { in_database: false, valid: false } }),
					ok: true,
					status: 200,
				} as Response);

				await calculator.calculate('example.com', profile);

				const phishTankCall = vi.mocked(fetch).mock.calls.find(
					(call) => (call[0] as string).includes('phishtank.com'),
				);
				expect(phishTankCall).toBeDefined();
				const options = phishTankCall![1] as RequestInit;
				const body = options.body as string;

				expect(body).toContain('app_key=phishtank-key-abc123');
				expect(body).toContain('url=https%3A%2F%2Fexample.com');
				expect(body).toContain('format=json');
			});

			it('should NOT include app_key when API key is missing', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				vi.mocked(fetch).mockResolvedValue({
					json: async () => ({ results: { in_database: false, valid: false } }),
					ok: true,
					status: 200,
				} as Response);

				await calculator.calculate('example.com', profile);

				const phishTankCall = vi.mocked(fetch).mock.calls.find(
					(call) => (call[0] as string).includes('phishtank.com'),
				);
				expect(phishTankCall).toBeDefined();
				const options = phishTankCall![1] as RequestInit;
				const body = options.body as string;

				expect(body).not.toContain('app_key=');
				expect(body).toContain('url=https%3A%2F%2Fexample.com');
				expect(body).toContain('format=json');
			});

			it('should always include correct User-Agent header', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '',
					phishTank: 'test-key',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				vi.mocked(fetch).mockResolvedValue({
					json: async () => ({ results: { in_database: false, valid: false } }),
					ok: true,
					status: 200,
				} as Response);

				await calculator.calculate('example.com', profile);

				const phishTankCall = vi.mocked(fetch).mock.calls.find(
					(call) => (call[0] as string).includes('phishtank.com'),
				);
				expect(phishTankCall).toBeDefined();
				const options = phishTankCall![1] as RequestInit;
				const headers = options.headers as Record<string, string>;

				expect(headers['User-Agent']).toBe('MyPhishingGuard/1.0 (Chrome Extension)');
				expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
			});

			it('should handle status 509 (rate limit) with warning and fallback', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				vi.mocked(fetch).mockResolvedValue({
					ok: false,
					status: 509,
					json: async () => ({}),
				} as Response);

				const result = await calculator.calculate('example.com', profile);

				expect(console.warn).toHaveBeenCalledWith('PhishTank rate limit reached');
				const phishTankSource = result.details.sources.find((s: any) => s.name === 'PhishTank');
				expect(phishTankSource).toBeDefined();
				expect(phishTankSource?.score).toBe(0.0);
			});
		});

		describe('Error handling', () => {
			it('should log errors with context when Google Safe Browsing fails', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: 'test-key',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				const error = new Error('Network error');
				vi.mocked(fetch).mockRejectedValue(error);

				await calculator.calculate('example.com', profile);

				expect(console.error).toHaveBeenCalledWith(
					'API error:',
					error,
					expect.objectContaining({
						source: 'Google Safe Browsing',
						domain: 'example.com',
					}),
				);
			});

			it('should log errors with context when PhishTank fails', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: '',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				const error = new Error('Request timeout');
				vi.mocked(fetch).mockRejectedValue(error);

				await calculator.calculate('example.com', profile);

				expect(console.error).toHaveBeenCalledWith(
					'API error:',
					error,
					expect.objectContaining({
						source: 'PhishTank',
						domain: 'example.com',
					}),
				);
			});

			it('should return fallback score (0.5) when API error occurs', async () => {
				mockConfig.apiKeys = {
					googleSafeBrowsing: 'test-key',
					phishTank: '',
					virusTotal: '',
				};
				vi.mocked(getConfig).mockResolvedValue(mockConfig);

				// Create profile with no cache to force API call
				const profile = createTestProfile('example.com', 60);
				profile.reputationCache = []; // Empty cache
				vi.mocked(getDomainProfile).mockResolvedValue(profile);
				vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

				vi.mocked(fetch).mockRejectedValue(new Error('API failure'));

				const result = await calculator.calculate('example.com', profile);

				const gsbSource = result.details.sources.find((s: any) => s.name === 'Google Safe Browsing');
				expect(gsbSource).toBeDefined();
				expect(gsbSource?.score).toBe(0.5);
				expect(gsbSource?.confidence).toBe(0.0);
			});
		});
	});
});
