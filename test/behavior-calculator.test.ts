/**
 * @file tests/behavior-calculator.test.ts
 * @description Unit tests for BehaviorMetricCalculator (M4)
 * @uses src/analysis/behavior-calculator.ts
 * @uses types.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorMetricCalculator } from '../src/background/analysis/behavior-calculator.js';
import type { Configuration, DomainProfile, RequestContext } from '../src/types/index.js';

vi.mock('../src/background/storage/configuration-store.js', () => ({
	getConfig: vi.fn(),
}));

vi.mock('../src/background/storage/domain-statistics.js', () => ({
	getDomainProfile: vi.fn(),
	updateDomainProfile: vi.fn(),
}));

vi.mock('../src/background/utils/normalization.js', () => ({
	sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
	varianceFromM2: (stats: { count: number; M2: number }) =>
		stats.count > 1 ? stats.M2 / (stats.count - 1) : 0,
	computeZScore: (value: number, mean: number, variance: number) =>
		variance > 0 ? (value - mean) / Math.sqrt(variance) : 0,
}));

import { getConfig } from '../src/background/storage/configuration-store.js';
import {
	getDomainProfile,
	updateDomainProfile,
} from '../src/background/storage/domain-statistics.js';

describe('BehaviorMetricCalculator', () => {
	let calculator: BehaviorMetricCalculator;
	let mockConfig: Configuration;

	beforeEach(() => {
		calculator = new BehaviorMetricCalculator();

		// Default configuration with behavior enabled
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
		};

		vi.mocked(getConfig).mockResolvedValue(mockConfig);
		vi.mocked(updateDomainProfile).mockResolvedValue(undefined);
	});

	describe('Insufficient history', () => {
		it('should return medium risk with low confidence for new domain', async () => {
			vi.mocked(getDomainProfile).mockResolvedValue(null);

			const context: RequestContext = {
				url: 'https://example.com/page',
				timestamp: Date.now(),
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBe(0.5);
			expect(result.confidence).toBe(0.1);
			expect(result.details.reason).toBe('insufficient history');
		});

		it('should return medium risk when request count below minimum', async () => {
			const profile: DomainProfile = {
				domain: 'example.com',
				firstSeen: Date.now() - 86400000,
				lastSeen: Date.now() - 3600000,
				requestCount: 3, // Below MIN_HISTORY (5)
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 3, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 3, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 3, mean: 1.0, M2: 0.5 },
					},
					interArrival: { count: 3, mean: 3600, M2: 1000 },
				},
				accessHours: Array(24).fill(0),
				dayFrequencies: Array(7).fill(0),
				typicalReferrers: [],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://example.com/page',
				timestamp: Date.now(),
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBe(0.5);
			expect(result.confidence).toBe(0.1);
			expect(result.details.requestCount).toBe(3);
		});
	});

	describe('Normal behavior patterns', () => {
		it('should return low risk for consistent daytime access pattern', async () => {
			const now = new Date();
			now.setHours(14, 0, 0, 0); // 2 PM
			const timestamp = now.getTime();

			const accessHours = Array(24).fill(0);
			accessHours[13] = 5; // 1 PM
			accessHours[14] = 10; // 2 PM (current)
			accessHours[15] = 5; // 3 PM

			const profile: DomainProfile = {
				domain: 'work.com',
				firstSeen: timestamp - 2592000000, // 30 days ago
				lastSeen: timestamp - 3600000, // 1 hour ago
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
					interArrival: { count: 50, mean: 3600, M2: 500000 },
				},
				accessHours,
				dayFrequencies: [10, 10, 10, 10, 10, 5, 5], // Weekday pattern
				typicalReferrers: ['https://google.com', 'https://google.com'],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://work.com/dashboard',
				timestamp,
				referrer: 'https://google.com',
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('work.com', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBeLessThan(0.4);
			expect(result.confidence).toBeGreaterThan(0.8);
			expect(result.details.timeOfDayDeviation).toBeLessThan(0.6);
		});

		it('should handle weekend access pattern correctly', async () => {
			const now = new Date();
			now.setHours(10, 0, 0, 0);
			// Set to Sunday (day = 0)
			now.setDate(now.getDate() - now.getDay());
			const timestamp = now.getTime();

			const profile: DomainProfile = {
				domain: 'social.net',
				firstSeen: timestamp - 2592000000,
				lastSeen: timestamp - 7200000,
				requestCount: 60,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 60, mean: 3.0, M2: 2.0 },
						fiveMinute: { count: 60, mean: 3.0, M2: 2.0 },
						fifteenMinute: { count: 60, mean: 3.0, M2: 2.0 },
					},
					interArrival: { count: 60, mean: 7200, M2: 1000000 },
				},
				accessHours: Array(24)
					.fill(2)
					.map((v, i) => (i >= 9 && i <= 22 ? 5 : v)),
				dayFrequencies: [15, 2, 2, 2, 2, 2, 15], // Weekend heavy (Sun=0, Sat=6)
				typicalReferrers: ['https://twitter.com'],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://social.net/feed',
				timestamp,
				referrer: 'https://twitter.com',
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('social.net', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBeLessThan(0.5);
			expect(result.details.dayOfWeekDeviation).toBeLessThan(0.5);
		});
	});

	describe('Behavioral anomalies', () => {
		it('should detect unusual nighttime access (3 AM)', async () => {
			const now = new Date();
			now.setHours(3, 0, 0, 0); // 3 AM
			const timestamp = now.getTime();

			const accessHours = Array(24).fill(0);
			accessHours[9] = 10; // 9 AM - typical
			accessHours[14] = 15; // 2 PM - typical
			accessHours[3] = 1; // 3 AM - rare

			const profile: DomainProfile = {
				domain: 'banking.com',
				firstSeen: timestamp - 7776000000, // 90 days ago
				lastSeen: timestamp - 43200000, // 12 hours ago
				requestCount: 80,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 80, mean: 2.0, M2: 1.0 },
						fiveMinute: { count: 80, mean: 2.0, M2: 1.0 },
						fifteenMinute: { count: 80, mean: 2.0, M2: 1.0 },
					},
					interArrival: { count: 80, mean: 43200, M2: 5000000 },
				},
				accessHours,
				dayFrequencies: [12, 15, 15, 15, 15, 8, 0],
				typicalReferrers: ['https://google.com'],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://banking.com/transfer',
				timestamp,
				referrer: 'https://google.com',
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('banking.com', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBeGreaterThan(0.5);
			expect(result.details.timeOfDayDeviation).toBeGreaterThan(0.8);
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		it('should detect referrer mismatch', async () => {
			const now = Date.now();

			const profile: DomainProfile = {
				domain: 'company.com',
				firstSeen: now - 5184000000, // 60 days ago
				lastSeen: now - 86400000, // 1 day ago
				requestCount: 100,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 100, mean: 3.0, M2: 2.0 },
						fiveMinute: { count: 100, mean: 3.0, M2: 2.0 },
						fifteenMinute: { count: 100, mean: 3.0, M2: 2.0 },
					},
					interArrival: { count: 100, mean: 86400, M2: 10000000 },
				},
				accessHours: Array(24).fill(4),
				dayFrequencies: Array(7).fill(14),
				typicalReferrers: [
					'https://intranet.company.com',
					'https://intranet.company.com',
					'https://mail.company.com',
				],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://company.com/admin',
				timestamp: now,
				referrer: 'https://suspicious-phishing-site.xyz', // Unusual referrer
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('company.com', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBeGreaterThan(0.4);
			expect(result.details.referrerMismatch).toBe(true);
		});

		it('should detect direct access to sensitive path', async () => {
			const now = Date.now();

			const profile: DomainProfile = {
				domain: 'bank.com',
				firstSeen: now - 2592000000,
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
					interArrival: { count: 50, mean: 7200, M2: 1000000 },
				},
				accessHours: Array(24).fill(2),
				dayFrequencies: Array(7).fill(7),
				typicalReferrers: ['https://bank.com'],
				directAccessToSensitive: true,
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://bank.com/login', // Sensitive path
				timestamp: now,
				userAgent: 'Mozilla/5.0',
				resourceType: 'main_frame',
			};

			const result = await calculator.calculate('bank.com', context);

			expect(result.id).toBe('M4');
			expect(result.details.navigationPathScore).toBeGreaterThan(0.5);
		});

		it('should detect unusual inter-arrival time (Z-score)', async () => {
			const now = Date.now();

			const profile: DomainProfile = {
				domain: 'api.service.io',
				firstSeen: now - 7776000000, // 90 days
				lastSeen: now - 10000, // 10 seconds ago (very recent!)
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
					interArrival: { count: 200, mean: 3600, M2: 500000 }, // Usually 1 hour apart
				},
				accessHours: Array(24).fill(8),
				dayFrequencies: Array(7).fill(28),
				typicalReferrers: [],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://api.service.io/endpoint',
				timestamp: now, // Only 10 seconds since last request!
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('api.service.io', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBeGreaterThan(0.3);
			expect(result.details.zScore).not.toBe(0);
		});

		it('should detect unusual weekday access (active on Sunday)', async () => {
			const now = new Date();
			now.setHours(10, 0, 0, 0);
			// Set to Sunday
			now.setDate(now.getDate() - now.getDay());
			const timestamp = now.getTime();

			const profile: DomainProfile = {
				domain: 'corporate.net',
				firstSeen: timestamp - 5184000000,
				lastSeen: timestamp - 604800000, // 1 week ago
				requestCount: 120,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 120, mean: 4.0, M2: 2.0 },
						fiveMinute: { count: 120, mean: 4.0, M2: 2.0 },
						fifteenMinute: { count: 120, mean: 4.0, M2: 2.0 },
					},
					interArrival: { count: 120, mean: 86400, M2: 20000000 },
				},
				accessHours: Array(24).fill(5),
				dayFrequencies: [1, 25, 25, 25, 25, 25, 1], // Mon-Fri only (Sun=0, Sat=6)
				typicalReferrers: ['https://vpn.corporate.net'],
			};

			vi.mocked(getDomainProfile).mockResolvedValue(profile);

			const context: RequestContext = {
				url: 'https://corporate.net/files',
				timestamp,
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('corporate.net', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBeGreaterThan(0.4);
			expect(result.details.dayOfWeekDeviation).toBeGreaterThan(0.8);
		});
	});

	describe('Configuration handling', () => {
		it('should return zero score when behavior calculation disabled', async () => {
			mockConfig.groups.behavior.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const context: RequestContext = {
				url: 'https://example.com/page',
				timestamp: Date.now(),
				userAgent: 'Mozilla/5.0',
			};

			const result = await calculator.calculate('example.com', context);

			expect(result.id).toBe('M4');
			expect(result.value).toBe(0.0);
			expect(result.confidence).toBe(0.0);
			expect(result.details.reason).toBe('behavior calculation disabled');
		});
	});
});
