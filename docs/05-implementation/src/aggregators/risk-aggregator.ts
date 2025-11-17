/**
 * @file docs/05-implementation/src/aggregators/risk-aggregator.ts
 * @implements 04-algorithms/risk-calculation.md
 * @spec specs/risk.spec.md
 * @uses api/metric-result.api.md
 * @uses api/configuration.api.md
 */
import type { MetricResult } from '../../api/metric-result.api.md';
import type { Configuration } from '../../api/configuration.api.md';

import { getConfig } from '../storage/configuration-store.ts';

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

/**
 * Aggregates M1–M4 into final risk score R ∈ [0,1] using weighted sum.
 * Applies confidence adjustment via harmonic mean.
 */
export class RiskAggregator {
	async aggregate(metrics: MetricResult[]): Promise<{
		riskScore: number;
		confidence: number;
		details: RiskDetails;
	}> {
		const config: Configuration = await getConfig();

		const contributions: Contribution[] = [];
		let weightedSum = 0;
		let totalWeight = 0;
		const confidences: number[] = [];

		const enabledMetrics: string[] = [];

		for (const metric of metrics) {
			const id = metric.id;
			const group = config.groups[id as keyof typeof config.groups];

			if (!group?.enabled) continue;

			const weight = group.weight ?? 0;
			if (weight <= 0) continue;

			const contribution = metric.value * weight;
			weightedSum += contribution;
			totalWeight += weight;
			confidences.push(metric.confidence);

			contributions.push({
				id,
				value: metric.value,
				weight,
				contribution,
				confidence: metric.confidence,
			});

			enabledMetrics.push(id);
		}

		// Normalize by active weights
		const riskScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

		// Harmonic mean of confidence (penalizes low-confidence inputs)
		const confidence =
			confidences.length > 0
				? this.harmonicMean(confidences)
				: 0.0;

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

	/**
	 * Harmonic mean: n / Σ(1/c_i)
	 * More sensitive to low values → conservative risk assessment.
	 */
	private harmonicMean(values: number[]): number {
		if (values.length === 0) return 0;
		const sumOfInverses = values.reduce((sum, c) => sum + 1 / Math.max(c, 0.01), 0);
		return values.length / sumOfInverses;
	}
}