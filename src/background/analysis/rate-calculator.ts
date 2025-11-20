import type { RequestContext, MetricResult, DomainProfile, Configuration } from '../../types/index.ts';
import { sigmoid, varianceFromM2, computeZScore } from '../utils/normalization.ts';
import { getDomainProfile, updateDomainProfile } from '../storage/domain-statistics.ts';
import { getConfig } from '../storage/configuration-store.ts';

interface RateStats {
	count: number;
	mean: number;
	M2: number;
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

		if (!profile) {
			profile = this.createInitialProfile(domain, now);
		}

		const counts = {
			oneMinute: this.countInWindow(profile.timeSeries.minutely, now, this.WINDOWS.oneMinute),
			fiveMinute: this.countInWindow(profile.timeSeries.fiveMinute, now, this.WINDOWS.fiveMinute),
			fifteenMinute: this.countInWindow(profile.timeSeries.fifteenMinute, now, this.WINDOWS.fifteenMinute),
		};

		const rates = {
			oneMinute: (counts.oneMinute / this.WINDOWS.oneMinute) * 60,
			fiveMinute: (counts.fiveMinute / this.WINDOWS.fiveMinute) * 60,
			fifteenMinute: (counts.fifteenMinute / this.WINDOWS.fifteenMinute) * 60,
		};

		const maxRate = Math.max(rates.oneMinute, rates.fiveMinute, rates.fifteenMinute);
		const windowKey =
			rates.oneMinute === maxRate
				? 'oneMinute'
				: rates.fiveMinute === maxRate
					? 'fiveMinute'
					: 'fifteenMinute';

		const stats = profile.stats.rate[windowKey];
		const zScore = computeZScore(maxRate, stats.mean, varianceFromM2(stats));

		const normalized = sigmoid(zScore * 2);
		const confidence = Math.min(stats.count / 50, 1.0);

		const details: RateDetails = {
			oneMinute: { count: counts.oneMinute, rate: rates.oneMinute },
			fiveMinute: { count: counts.fiveMinute, rate: rates.fiveMinute },
			fifteenMinute: { count: counts.fifteenMinute, rate: rates.fifteenMinute },
			zScore,
			normalized,
		};

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
		return series.filter(ts => ts >= cutoff).length;
	}

	private appendToTimeSeries(series: number[], timestamp: number): void {
		series.push(timestamp);
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

