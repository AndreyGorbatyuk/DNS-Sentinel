import type { WelfordStats } from '../../types/index.ts';

export function sigmoid(x: number): number {
	return 1 / (1 + Math.exp(-x));
}

export function varianceFromM2(stat: WelfordStats): number {
	return stat.count > 1 ? stat.M2 / (stat.count - 1) : 0;
}

export function computeZScore(value: number, mean: number, variance: number): number {
	const stdDev = Math.sqrt(variance);
	return stdDev > 0 ? (value - mean) / stdDev : 0;
}

export function harmonicMean(values: number[]): number {
	if (values.length === 0) return 0;
	const sumOfInverses = values.reduce((sum, c) => sum + 1 / Math.max(c, 0.01), 0);
	return values.length / sumOfInverses;
}

