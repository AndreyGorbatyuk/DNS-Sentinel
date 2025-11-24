/**
 * @file docs/05-implementation/src/analysis/rate-calculator.ts
 * @implements 04-algorithms/rate-calculation.md
 * @spec specs/rate.spec.md
 * @uses api/request-context.api.md
 * @uses api/metric-result.api.md
 * @uses api/domain-profile.api.md
 * @uses api/configuration.api.md
 */

import type { Configuration, DomainProfile, MetricResult, RequestContext } from '../../../types.ts';

import { getConfig } from '../storage/configuration-store.ts';
import { getDomainProfile, updateDomainProfile } from '../storage/domain-statistics.ts';
import { computeZScore, sigmoid, varianceFromM2 } from '../utils/normalization.ts';

interface RateStats {
	count: number;
	mean: number;
	M2: number; // Sum of squared differences (for Welford)
}

interface RateDetails {
	oneMinute: { count: number; rate: number };
	fiveMinute: { count: number; rate: number };
	fifteenMinute: { count: number; rate: number };
	zScore: number;
	normalized: number;
}

export class RateMetricCalculator {
	private readonly WINDOWS = {
		oneMinute: 60,
		fiveMinute: 300,
		fifteenMinute: 900,
	} as const;

	/**
	 * Calculates M1: Request rate anomaly using sliding time windows.
	 * Implements Z-score normalization over 1m/5m/15m windows.
	 */
	async calculate(domain: string, context: RequestContext): Promise<MetricResult> {
		const config: Configuration = await getConfig();
		if (!config.groups.rate.enabled) {
			return {
				id: 'M1',
				value: 0.0,
				confidence: 0.0,
				details: { reason: 'rate calculation disabled' },
			};
		}

		let profile: DomainProfile | null = await getDomainProfile(domain);
		const now = context.timestamp;

		// Create profile if first encounter
		if (!profile) {
			profile = this.createInitialProfile(domain, now);
		}

		// Count requests in each window
		const counts = {
			oneMinute: this.countInWindow(profile.timeSeries.minutely, now, this.WINDOWS.oneMinute),
			fiveMinute: this.countInWindow(profile.timeSeries.fiveMinute, now, this.WINDOWS.fiveMinute),
			fifteenMinute: this.countInWindow(
				profile.timeSeries.fifteenMinute,
				now,
				this.WINDOWS.fifteenMinute,
			),
		};

		// Compute per-minute rates
		const rates = {
			oneMinute: (counts.oneMinute / this.WINDOWS.oneMinute) * 60,
			fiveMinute: (counts.fiveMinute / this.WINDOWS.fiveMinute) * 60,
			fifteenMinute: (counts.fifteenMinute / this.WINDOWS.fifteenMinute) * 60,
		};

		// Use window with highest deviation
		const maxRate = Math.max(rates.oneMinute, rates.fiveMinute, rates.fifteenMinute);
		const windowKey =
			rates.oneMinute === maxRate
				? 'oneMinute'
				: rates.fiveMinute === maxRate
					? 'fiveMinute'
					: 'fifteenMinute';

		const stats = profile.stats.rate[windowKey];
		const zScore = computeZScore(maxRate, stats.mean, varianceFromM2(stats));

		// Normalize to [0,1] using sigmoid
		const normalized = sigmoid(zScore * 2); // Scale for steeper curve

		// Confidence based on sample size
		const confidence = Math.min(stats.count / 50, 1.0);

		const details: RateDetails = {
			oneMinute: { count: counts.oneMinute, rate: rates.oneMinute },
			fiveMinute: { count: counts.fiveMinute, rate: rates.fiveMinute },
			fifteenMinute: { count: counts.fifteenMinute, rate: rates.fifteenMinute },
			zScore,
			normalized,
		};

		// Update profile incrementally
		profile.requestCount += 1;
		profile.lastSeen = now;
		this.appendToTimeSeries(profile.timeSeries.minutely, now);
		this.appendToTimeSeries(profile.timeSeries.fiveMinute, now);
		this.appendToTimeSeries(profile.timeSeries.fifteenMinute, now);
		this.updateIncrementalStats(profile.stats.rate.oneMinute, 1);
		this.updateIncrementalStats(profile.stats.rate.fiveMinute, 1);
		this.updateIncrementalStats(profile.stats.rate.fifteenMinute, 1);

		await updateDomainProfile(domain, profile);

		return {
			id: 'M1',
			value: normalized,
			confidence,
			details,
		};
	}

	private createInitialProfile(domain: string, timestamp: number): DomainProfile {
		return {
			domain,
			firstSeen: timestamp,
			lastSeen: timestamp,
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
	}

	private countInWindow(series: number[], now: number, windowSec: number): number {
		const cutoff = now - windowSec * 1000;
		return series.filter((ts) => ts >= cutoff).length;
	}

	private appendToTimeSeries(series: number[], timestamp: number): void {
		series.push(timestamp);
		// Keep only last N entries (e.g., 120 for 1min window)
		if (series.length > 120) series.shift();
	}

	private updateIncrementalStats(stat: RateStats, value: number): void {
		stat.count += 1;
		const delta = value - stat.mean;
		stat.mean += delta / stat.count;
		const delta2 = value - stat.mean;
		stat.M2 += delta * delta2;
	}
}
