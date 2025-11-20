import type { WelfordStats } from '../../types/index.ts';

export function zScore(value: number, mean: number, stdDev: number): number {
	return stdDev > 0 ? (value - mean) / stdDev : 0;
}

export function sigmoid(x: number, steepness = 1): number {
	return 1 / (1 + Math.exp(-steepness * x));
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function varianceFromM2(stat: WelfordStats): number {
	return stat.count > 1 ? stat.M2 / (stat.count - 1) : 0;
}

export function harmonicMean(values: number[]): number {
	if (values.length === 0) return 0;
	const sumOfInverses = values.reduce((sum, v) => sum + 1 / Math.max(v, 0.01), 0);
	return values.length / sumOfInverses;
}

export function weightedAverage(values: number[], weights: number[]): number {
	let numerator = 0;
	let denominator = 0;
	for (let i = 0; i < values.length; i++) {
		numerator += values[i] * weights[i];
		denominator += weights[i];
	}
	return denominator > 0 ? numerator / denominator : 0;
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * clamp(t, 0, 1);
}

