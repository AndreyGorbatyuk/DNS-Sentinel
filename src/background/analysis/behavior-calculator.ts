import type {
	Configuration,
	DomainProfile,
	MetricResult,
	RequestContext,
} from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';
import { getDomainProfile, updateDomainProfile } from '../storage/domain-statistics.js';
import { computeZScore, sigmoid, varianceFromM2 } from '../utils/normalization.js';

interface BehaviorStats {
	count: number;
	mean: number;
	M2: number;
}

interface BehaviorDetails {
	timeOfDayDeviation: number;
	dayOfWeekDeviation: number;
	referrerMismatch: boolean;
	navigationPathScore: number;
	zScore: number;
	normalized: number;
}

export class BehaviorMetricCalculator {
	private readonly MIN_HISTORY = 5;
	private readonly HOURS_IN_DAY = 24;
	private readonly DAYS_IN_WEEK = 7;

	async calculate(domain: string, context: RequestContext): Promise<MetricResult> {
		const config: Configuration = await getConfig();
		if (!config.groups.behavior.enabled) {
			return {
				id: 'M4',
				value: 0.0,
				confidence: 0.0,
				details: { reason: 'behavior calculation disabled' },
			};
		}

		const profile = await getDomainProfile(domain);
		if (!profile || profile.requestCount < this.MIN_HISTORY) {
			return {
				id: 'M4',
				value: 0.5,
				confidence: 0.1,
				details: { reason: 'insufficient history', requestCount: profile?.requestCount || 0 },
			};
		}

		// Initialize optional properties if they don't exist
		if (!profile.accessHours) {
			profile.accessHours = new Array(this.HOURS_IN_DAY).fill(0);
		}
		if (!profile.dayFrequencies) {
			profile.dayFrequencies = new Array(this.DAYS_IN_WEEK).fill(0);
		}
		if (!profile.typicalReferrers) {
			profile.typicalReferrers = [];
		}
		if (!profile.stats.interArrival) {
			profile.stats.interArrival = { count: 0, mean: 0, M2: 0 };
		}

		const now = context.timestamp;
		const hour = new Date(now).getHours();
		const day = new Date(now).getDay();

		const hourExpected = profile.accessHours[hour] || 0;
		const hourTotal = profile.accessHours.reduce((a, b) => a + b, 0);
		const hourProb = hourTotal > 0 ? hourExpected / hourTotal : 0;
		const timeDeviation = 1 - hourProb;

		const dayExpected = profile.dayFrequencies[day] || 0;
		const dayTotal = profile.dayFrequencies.reduce((a, b) => a + b, 0);
		const dayProb = dayTotal > 0 ? dayExpected / dayTotal : 0;
		const dayDeviation = 1 - dayProb;

		const expectedReferrer = this.getMostCommonReferrer(profile.typicalReferrers);
		const referrerMismatch = context.referrer
			? !this.isSimilarDomain(context.referrer, expectedReferrer)
			: false;

		const isSensitive = this.isSensitivePath(context.url);
		const pathScore = profile.directAccessToSensitive && isSensitive ? 0.8 : 0.0;

		const interArrival = this.computeInterArrival(profile.lastSeen, now);
		const interArrivalStats = profile.stats.interArrival;
		const zScore = computeZScore(
			interArrival,
			interArrivalStats.mean,
			varianceFromM2(interArrivalStats),
		);

		const rawScore =
			timeDeviation * 0.3 +
			dayDeviation * 0.25 +
			(referrerMismatch ? 0.8 : 0.0) * 0.2 +
			pathScore * 0.15 +
			Math.max(0, zScore / 5) * 0.1;

		const normalized = sigmoid(rawScore * 8);
		const confidence = Math.min(profile.requestCount / 50, 1.0);

		const details: BehaviorDetails = {
			timeOfDayDeviation: Number(timeDeviation.toFixed(3)),
			dayOfWeekDeviation: Number(dayDeviation.toFixed(3)),
			referrerMismatch,
			navigationPathScore: pathScore,
			zScore: Number(zScore.toFixed(3)),
			normalized,
		};

		profile.accessHours[hour] = (profile.accessHours[hour] || 0) + 1;
		profile.dayFrequencies[day] = (profile.dayFrequencies[day] || 0) + 1;

		if (context.referrer) {
			this.updateReferrerStats(profile.typicalReferrers, context.referrer);
		}

		if (isSensitive && context.resourceType === 'main_frame') {
			profile.directAccessToSensitive = true;
		}

		const delta = interArrival - interArrivalStats.mean;
		interArrivalStats.count += 1;
		interArrivalStats.mean += delta / interArrivalStats.count;
		const delta2 = interArrival - interArrivalStats.mean;
		interArrivalStats.M2 += delta * delta2;

		profile.lastSeen = now;

		await updateDomainProfile(domain, profile);

		return {
			id: 'M4',
			value: normalized,
			confidence,
			details,
		};
	}

	private computeInterArrival(lastSeen: number, now: number): number {
		return lastSeen ? (now - lastSeen) / 1000 : 0;
	}

	private getMostCommonReferrer(referrers: string[]): string | null {
		if (referrers.length === 0) return null;
		const freq = new Map<string, number>();
		for (const r of referrers) {
			freq.set(r, (freq.get(r) || 0) + 1);
		}
		return Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
	}

	private isSimilarDomain(a: string, b: string | null): boolean {
		if (!b) return false;
		try {
			const hostA = new URL(a).hostname;
			const hostB = new URL(b).hostname;
			return hostA === hostB || hostA.endsWith(`.${hostB}`) || hostB.endsWith(`.${hostA}`);
		} catch {
			return false;
		}
	}

	private isSensitivePath(url: string): boolean {
		try {
			const path = new URL(url).pathname.toLowerCase();
			return /\/(login|signin|auth|password|account|bank|payment|secure)/.test(path);
		} catch {
			return false;
		}
	}

	private updateReferrerStats(stats: string[], referrer: string): void {
		stats.push(referrer);
		if (stats.length > 50) stats.shift();
	}
}
