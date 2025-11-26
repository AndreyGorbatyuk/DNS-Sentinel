/**
 * @file benchmarks/rate-calculation.bench.ts
 * @description Performance benchmarks for RateMetricCalculator (M1)
 * Focus on hotspot operations: time window calculations, Welford updates
 * @uses src/analysis/rate-calculator.ts
 * @uses types.ts
 */

import { beforeEach, bench, describe } from 'vitest';
import { RateMetricCalculator } from '../src/background/analysis/rate-calculator.js';
import type { DomainProfile, RequestContext } from '../src/types/index.js';

// Mock chrome.storage.local
type StorageRecord = Record<string, unknown>;

const mockChromeStorage = {
	local: {
		get: async (key: string): Promise<StorageRecord> => {
			// Fast mock without actual storage
			return {};
		},
		set: async (items: StorageRecord): Promise<void> => {
			// No-op for benchmarks
		},
	},
};

(globalThis as any).chrome = { storage: mockChromeStorage };

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

// Mock domain-statistics
const mockProfiles = new Map<string, DomainProfile>();

const mockGetDomainProfile = async (domain: string): Promise<DomainProfile | null> => {
	return mockProfiles.get(domain) || null;
};

const mockUpdateDomainProfile = async (domain: string, profile: DomainProfile): Promise<void> => {
	mockProfiles.set(domain, profile);
};

// Helper: Generate profile with varying history sizes
function generateProfile(domain: string, historySize: number): DomainProfile {
	const now = Date.now();
	const timestamps = Array.from({ length: historySize }, (_, i) => now - i * 1000);

	return {
		domain,
		firstSeen: now - historySize * 1000,
		lastSeen: now - 1000,
		requestCount: historySize,
		timeSeries: {
			minutely: timestamps.slice(0, Math.min(60, historySize)),
			fiveMinute: timestamps.slice(0, Math.min(300, historySize)),
			fifteenMinute: timestamps.slice(0, Math.min(900, historySize)),
		},
		stats: {
			rate: {
				oneMinute: { count: historySize, mean: 1.0, M2: 0.5 },
				fiveMinute: { count: historySize, mean: 1.0, M2: 0.5 },
				fifteenMinute: { count: historySize, mean: 1.0, M2: 0.5 },
			},
		},
	};
}

// Helper: Generate context
function generateContext(timestamp: number = Date.now()): RequestContext {
	return {
		url: 'https://example.com/page',
		timestamp,
		userAgent: 'Mozilla/5.0',
	};
}

describe('RateMetricCalculator Benchmarks', () => {
	let calculator: RateMetricCalculator;

	beforeEach(() => {
		calculator = new RateMetricCalculator();
		mockProfiles.clear();
	});

	describe('HOTSPOT: Time Window Filtering', () => {
		bench('filter 60 timestamps (1-minute window)', () => {
			const now = Date.now();
			const timestamps = Array.from({ length: 60 }, (_, i) => now - i * 1000);
			const cutoff = now - 60000;
			const filtered = timestamps.filter((ts) => ts >= cutoff);
		});

		bench('filter 300 timestamps (5-minute window)', () => {
			const now = Date.now();
			const timestamps = Array.from({ length: 300 }, (_, i) => now - i * 1000);
			const cutoff = now - 300000;
			const filtered = timestamps.filter((ts) => ts >= cutoff);
		});

		bench('filter 900 timestamps (15-minute window)', () => {
			const now = Date.now();
			const timestamps = Array.from({ length: 900 }, (_, i) => now - i * 1000);
			const cutoff = now - 900000;
			const filtered = timestamps.filter((ts) => ts >= cutoff);
		});

		bench('filter 120 timestamps (max capacity, 1-min)', () => {
			const now = Date.now();
			const timestamps = Array.from({ length: 120 }, (_, i) => now - i * 500);
			const cutoff = now - 60000;
			const filtered = timestamps.filter((ts) => ts >= cutoff);
		});
	});

	describe('HOTSPOT: Welford Incremental Stats Update', () => {
		bench('single Welford update (cold start)', () => {
			const stats = { count: 0, mean: 0, M2: 0 };
			const value = 1;
			stats.count += 1;
			const delta = value - stats.mean;
			stats.mean += delta / stats.count;
			const delta2 = value - stats.mean;
			stats.M2 += delta * delta2;
		});

		bench('single Welford update (100 samples)', () => {
			const stats = { count: 100, mean: 5.0, M2: 50.0 };
			const value = 6;
			stats.count += 1;
			const delta = value - stats.mean;
			stats.mean += delta / stats.count;
			const delta2 = value - stats.mean;
			stats.M2 += delta * delta2;
		});

		bench('batch Welford update (10 values)', () => {
			const stats = { count: 0, mean: 0, M2: 0 };
			const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			for (const value of values) {
				stats.count += 1;
				const delta = value - stats.mean;
				stats.mean += delta / stats.count;
				const delta2 = value - stats.mean;
				stats.M2 += delta * delta2;
			}
		});

		bench('batch Welford update (100 values)', () => {
			const stats = { count: 0, mean: 0, M2: 0 };
			const values = Array.from({ length: 100 }, (_, i) => i + 1);
			for (const value of values) {
				stats.count += 1;
				const delta = value - stats.mean;
				stats.mean += delta / stats.count;
				const delta2 = value - stats.mean;
				stats.M2 += delta * delta2;
			}
		});
	});

	describe('HOTSPOT: Z-Score Calculation', () => {
		bench('Z-score with typical variance', () => {
			const value = 10;
			const mean = 5;
			const variance = 4; // std = 2
			const zScore = variance > 0 ? (value - mean) / Math.sqrt(variance) : 0;
		});

		bench('Z-score with zero variance (edge case)', () => {
			const value = 10;
			const mean = 5;
			const variance = 0;
			const zScore = variance > 0 ? (value - mean) / Math.sqrt(variance) : 0;
		});

		bench('Z-score batch (10 calculations)', () => {
			const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const mean = 5.5;
			const variance = 8.25;
			const results = values.map((value) =>
				variance > 0 ? (value - mean) / Math.sqrt(variance) : 0,
			);
		});
	});

	describe('HOTSPOT: Sigmoid Normalization', () => {
		bench('sigmoid single value', () => {
			const x = 2.5;
			const result = 1 / (1 + Math.exp(-x));
		});

		bench('sigmoid batch (10 values)', () => {
			const values = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
			const results = values.map((x) => 1 / (1 + Math.exp(-x)));
		});

		bench('sigmoid with scaling (x * 2)', () => {
			const x = 1.5;
			const scaled = x * 2;
			const result = 1 / (1 + Math.exp(-scaled));
		});
	});

	describe('End-to-End: M1 Calculation', () => {
		bench('M1: new domain (no profile)', async () => {
			mockProfiles.clear();
			const context = generateContext();
			await calculator.calculate('new-domain.com', context);
		});

		bench('M1: small history (10 requests)', async () => {
			const profile = generateProfile('small.com', 10);
			mockProfiles.set('small.com', profile);
			const context = generateContext();
			await calculator.calculate('small.com', context);
		});

		bench('M1: medium history (100 requests)', async () => {
			const profile = generateProfile('medium.com', 100);
			mockProfiles.set('medium.com', profile);
			const context = generateContext();
			await calculator.calculate('medium.com', context);
		});

		bench('M1: large history (500 requests)', async () => {
			const profile = generateProfile('large.com', 500);
			mockProfiles.set('large.com', profile);
			const context = generateContext();
			await calculator.calculate('large.com', context);
		});

		bench('M1: burst scenario (120 requests in 1 min)', async () => {
			const now = Date.now();
			const burstTimestamps = Array.from({ length: 120 }, (_, i) => now - i * 500);
			const profile: DomainProfile = {
				domain: 'burst.com',
				firstSeen: now - 60000,
				lastSeen: now - 500,
				requestCount: 120,
				timeSeries: {
					minutely: burstTimestamps,
					fiveMinute: burstTimestamps,
					fifteenMinute: burstTimestamps,
				},
				stats: {
					rate: {
						oneMinute: { count: 120, mean: 2.0, M2: 10.0 },
						fiveMinute: { count: 120, mean: 2.0, M2: 10.0 },
						fifteenMinute: { count: 120, mean: 2.0, M2: 10.0 },
					},
				},
			};
			mockProfiles.set('burst.com', profile);
			const context = generateContext(now);
			await calculator.calculate('burst.com', context);
		});
	});

	describe('Memory Pressure: Array Operations', () => {
		bench('push + shift (60 elements, 1-min window)', () => {
			const series = Array.from({ length: 60 }, (_, i) => Date.now() - i * 1000);
			series.push(Date.now());
			if (series.length > 120) series.shift();
		});

		bench('push + shift (300 elements, 5-min window)', () => {
			const series = Array.from({ length: 300 }, (_, i) => Date.now() - i * 1000);
			series.push(Date.now());
			if (series.length > 120) series.shift();
		});

		bench('slice + concat vs push (60 elements)', () => {
			const series = Array.from({ length: 60 }, (_, i) => Date.now() - i * 1000);
			const newSeries = [...series, Date.now()];
			void newSeries;
		});

		bench('filter old timestamps (60 of 120)', () => {
			const now = Date.now();
			const series = Array.from({ length: 120 }, (_, i) => now - i * 1000);
			const cutoff = now - 60000;
			const filtered = series.filter((ts) => ts >= cutoff);
		});
	});

	describe('Performance Regression: Rate vs History Size', () => {
		bench('calculate with empty profile', async () => {
			const profile = generateProfile('empty.com', 0);
			mockProfiles.set('empty.com', profile);
			const context = generateContext();
			await calculator.calculate('empty.com', context);
		});

		bench('calculate with 50 requests', async () => {
			const profile = generateProfile('p50.com', 50);
			mockProfiles.set('p50.com', profile);
			const context = generateContext();
			await calculator.calculate('p50.com', context);
		});

		bench('calculate with 200 requests', async () => {
			const profile = generateProfile('p200.com', 200);
			mockProfiles.set('p200.com', profile);
			const context = generateContext();
			await calculator.calculate('p200.com', context);
		});

		bench('calculate with 1000 requests', async () => {
			const profile = generateProfile('p1000.com', 1000);
			mockProfiles.set('p1000.com', profile);
			const context = generateContext();
			await calculator.calculate('p1000.com', context);
		});
	});
});
