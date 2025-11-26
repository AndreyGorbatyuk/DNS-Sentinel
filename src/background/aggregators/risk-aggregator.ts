import type { Configuration, MetricResult } from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';

interface Contribution {
	id: string;
	value: number;
	weight: number;
	contribution: number;
	confidence: number;
}

interface RiskDetails {
	riskScore: number;
	confidence: number;
	contributions: Contribution[];
	enabledMetrics: string[];
	totalWeight: number;
}

export class RiskAggregator {
	async aggregate(
		metrics: MetricResult[],
	): Promise<{ riskScore: number; confidence: number; details: RiskDetails }> {
		const config: Configuration = await getConfig();

		const contributions: Contribution[] = [];
		let weightedSum = 0;
		let totalWeight = 0;
		let weightedConfidenceSum = 0;
		const enabledMetrics: string[] = [];

		for (const metric of metrics) {
			const groupKey = this.mapMetricToGroup(metric.id);
			if (!groupKey) continue;
			const group = config.groups[groupKey];
			if (!group?.enabled) continue;

			const resolvedWeight =
				group.weight ?? config.weights[groupKey as keyof typeof config.weights] ?? 0;
			if (resolvedWeight <= 0) continue;

			const clampedValue = this.clamp(metric.value, 0, 1);
			const clampedConfidence = this.clamp(metric.confidence, 0, 1);

			const contribution = clampedValue * resolvedWeight;
			weightedSum += contribution;
			totalWeight += resolvedWeight;
			weightedConfidenceSum += clampedConfidence * resolvedWeight;

			contributions.push({
				id: metric.id,
				value: clampedValue,
				weight: resolvedWeight,
				contribution,
				confidence: clampedConfidence,
			});

			enabledMetrics.push(metric.id);
		}

		const clampedScore = totalWeight > 0 ? this.clamp(weightedSum / totalWeight, 0, 1) : 0.5;
		const riskScore = this.applySensitivity(clampedScore, config.sensitivity);
		const confidence =
			totalWeight > 0 ? this.clamp(weightedConfidenceSum / totalWeight, 0, 1) : 0.0;

		const details: RiskDetails = {
			riskScore,
			confidence,
			contributions,
			enabledMetrics,
			totalWeight,
		};

		return {
			riskScore,
			confidence,
			details,
		};
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	private applySensitivity(score: number, sensitivity: Configuration['sensitivity']): number {
		switch (sensitivity) {
			case 'low':
				return this.clamp(score * 0.8, 0, 1);
			case 'high':
				return this.clamp(score * 1.15, 0, 1);
			case 'paranoid':
				return this.clamp(score * 1.3, 0, 1);
			default:
				return score;
		}
	}

	private mapMetricToGroup(metricId: string): keyof Configuration['groups'] | null {
		const normalized = metricId.trim().toUpperCase();
		switch (normalized) {
			case 'M1':
			case 'RATE':
				return 'rate';
			case 'M2':
			case 'ENTROPY':
				return 'entropy';
			case 'M3':
			case 'REPUTATION':
				return 'reputation';
			case 'M4':
			case 'BEHAVIOR':
				return 'behavior';
			default:
				return null;
		}
	}
}
