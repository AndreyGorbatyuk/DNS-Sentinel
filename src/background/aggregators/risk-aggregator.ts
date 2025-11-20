import type { MetricResult, Configuration } from '../../types/index.ts';
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

		const riskScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
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

	private harmonicMean(values: number[]): number {
		if (values.length === 0) return 0;
		const sumOfInverses = values.reduce((sum, c) => sum + 1 / Math.max(c, 0.01), 0);
		return values.length / sumOfInverses;
	}
}

