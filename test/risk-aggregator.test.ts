/**
 * @file tests/risk-aggregator.test.ts
 * @description Unit tests for RiskAggregator
 * @uses src/aggregators/risk-aggregator.ts
 * @uses types.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskAggregator } from '../src/background/aggregators/risk-aggregator.ts';
import type { Configuration, MetricResult } from '../src/types/index.ts';

vi.mock('../src/background/storage/configuration-store.ts', () => ({
	getConfig: vi.fn(),
}));

import { getConfig } from '../src/background/storage/configuration-store.ts';

describe('RiskAggregator', () => {
	let aggregator: RiskAggregator;
	let mockConfig: Configuration;

	beforeEach(() => {
		aggregator = new RiskAggregator();

		// Default configuration with all groups enabled
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

	describe('Full aggregation (all metrics enabled)', () => {
		it('should aggregate all four metrics with correct weights', async () => {
			const metrics: MetricResult[] = [
				{
					id: 'M1',
					value: 0.3,
					confidence: 0.9,
					details: { reason: 'normal rate' },
				},
				{
					id: 'M2',
					value: 0.2,
					confidence: 0.8,
					details: { reason: 'low entropy' },
				},
				{
					id: 'M3',
					value: 0.8,
					confidence: 0.95,
					details: { reason: 'blacklisted' },
				},
				{
					id: 'M4',
					value: 0.4,
					confidence: 0.7,
					details: { reason: 'minor deviation' },
				},
			];

			const result = await aggregator.aggregate(metrics);

			expect(result.riskScore).toBeGreaterThan(0);
			expect(result.riskScore).toBeLessThan(1);
			expect(result.confidence).toBeGreaterThan(0);
			expect(result.confidence).toBeLessThan(1);

			// Verify weighted sum: 0.3*0.15 + 0.2*0.25 + 0.8*0.40 + 0.4*0.20
			// = 0.045 + 0.05 + 0.32 + 0.08 = 0.495
			const expectedRisk = (0.3 * 0.15 + 0.2 * 0.25 + 0.8 * 0.4 + 0.4 * 0.2) / 1.0;
			expect(result.riskScore).toBeCloseTo(expectedRisk, 2);

			expect(result.details.enabledMetrics).toHaveLength(4);
			expect(result.details.contributions).toHaveLength(4);
			expect(result.details.totalWeight).toBe(1.0);
		});

		it('should handle high-risk scenario (all metrics critical)', async () => {
			const metrics: MetricResult[] = [
				{
					id: 'M1',
					value: 0.95,
					confidence: 1.0,
					details: { reason: 'burst detected' },
				},
				{
					id: 'M2',
					value: 0.9,
					confidence: 0.95,
					details: { reason: 'DGA pattern' },
				},
				{
					id: 'M3',
					value: 1.0,
					confidence: 1.0,
					details: { reason: 'multiple blacklists' },
				},
				{
					id: 'M4',
					value: 0.85,
					confidence: 0.9,
					details: { reason: 'suspicious behavior' },
				},
			];

			const result = await aggregator.aggregate(metrics);

			expect(result.riskScore).toBeGreaterThan(0.85);
			expect(result.confidence).toBeGreaterThan(0.9);

			// Verify all contributions are high
			result.details.contributions.forEach((contrib) => {
				expect(contrib.value).toBeGreaterThan(0.8);
			});
		});

		it('should handle low-risk scenario (all metrics benign)', async () => {
			const metrics: MetricResult[] = [
				{
					id: 'M1',
					value: 0.1,
					confidence: 0.9,
					details: { reason: 'normal rate' },
				},
				{
					id: 'M2',
					value: 0.05,
					confidence: 0.85,
					details: { reason: 'legitimate domain' },
				},
				{
					id: 'M3',
					value: 0.0,
					confidence: 1.0,
					details: { reason: 'clean reputation' },
				},
				{
					id: 'M4',
					value: 0.15,
					confidence: 0.8,
					details: { reason: 'normal behavior' },
				},
			];

			const result = await aggregator.aggregate(metrics);

			expect(result.riskScore).toBeLessThan(0.2);
			expect(result.confidence).toBeGreaterThan(0.8);

			// Verify all contributions are low
			result.details.contributions.forEach((contrib) => {
				expect(contrib.contribution).toBeLessThan(0.1);
			});
		});
	});

	describe('Partial aggregation (groups disabled)', () => {
		it('should exclude disabled metrics from aggregation', async () => {
			// Disable rate and behavior
			mockConfig.groups.rate.enabled = false;
			mockConfig.groups.behavior.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const metrics: MetricResult[] = [
				{
					id: 'M1',
					value: 0.9,
					confidence: 0.95,
					details: { reason: 'burst' },
				},
				{
					id: 'M2',
					value: 0.3,
					confidence: 0.8,
					details: { reason: 'moderate entropy' },
				},
				{
					id: 'M3',
					value: 0.6,
					confidence: 0.9,
					details: { reason: 'suspicious' },
				},
				{
					id: 'M4',
					value: 0.7,
					confidence: 0.85,
					details: { reason: 'anomaly' },
				},
			];

			const result = await aggregator.aggregate(metrics);

			// Only M2 and M3 should be included
			expect(result.details.enabledMetrics).toHaveLength(2);
			expect(result.details.enabledMetrics).toContain('M2');
			expect(result.details.enabledMetrics).toContain('M3');
			expect(result.details.enabledMetrics).not.toContain('M1');
			expect(result.details.enabledMetrics).not.toContain('M4');

			expect(result.details.contributions).toHaveLength(2);

			// Total weight should be 0.25 + 0.40 = 0.65
			expect(result.details.totalWeight).toBeCloseTo(0.65, 2);

			// Risk score: (0.3*0.25 + 0.6*0.40) / 0.65
			const expectedRisk = (0.3 * 0.25 + 0.6 * 0.4) / 0.65;
			expect(result.riskScore).toBeCloseTo(expectedRisk, 2);
		});

		it('should handle single active metric', async () => {
			// Enable only reputation
			mockConfig.groups.rate.enabled = false;
			mockConfig.groups.entropy.enabled = false;
			mockConfig.groups.behavior.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const metrics: MetricResult[] = [
				{
					id: 'M1',
					value: 0.5,
					confidence: 0.8,
					details: {},
				},
				{
					id: 'M2',
					value: 0.5,
					confidence: 0.8,
					details: {},
				},
				{
					id: 'M3',
					value: 0.9,
					confidence: 1.0,
					details: { reason: 'blacklisted' },
				},
				{
					id: 'M4',
					value: 0.5,
					confidence: 0.8,
					details: {},
				},
			];

			const result = await aggregator.aggregate(metrics);

			expect(result.details.enabledMetrics).toHaveLength(1);
			expect(result.details.enabledMetrics).toContain('M3');
			expect(result.details.contributions).toHaveLength(1);

			// With only one metric, risk score should equal that metric's value
			expect(result.riskScore).toBeCloseTo(0.9, 2);
			expect(result.confidence).toBeCloseTo(1.0, 2);
		});

		it('should return medium risk when all metrics disabled', async () => {
			// Disable all groups
			mockConfig.groups.rate.enabled = false;
			mockConfig.groups.entropy.enabled = false;
			mockConfig.groups.reputation.enabled = false;
			mockConfig.groups.behavior.enabled = false;
			vi.mocked(getConfig).mockResolvedValue(mockConfig);

			const metrics: MetricResult[] = [
				{
					id: 'M1',
					value: 0.8,
					confidence: 0.9,
					details: {},
				},
				{
					id: 'M2',
					value: 0.7,
					confidence: 0.85,
					details: {},
				},
				{
					id: 'M3',
					value: 0.9,
					confidence: 0.95,
					details: {},
				},
				{
					id: 'M4',
					value: 0.6,
					confidence: 0.8,
					details: {},
				},
			];

			const result = await aggregator.aggregate(metrics);

			expect(result.details.enabledMetrics).toHaveLength(0);
			expect(result.details.contributions).toHaveLength(0);
			expect(result.details.totalWeight).toBe(0);

			// Fallback to 0.5 when no metrics enabled
			expect(result.riskScore).toBe(0.5);
			expect(result.confidence).toBe(0.0);
		});
	});
});