/**
 * @file docs/05-implementation/src/utils/math.ts
 * @description
 * Pure mathematical utilities (SSOT for all calculators).
 * Zero dependencies, fully deterministic, no side effects.
 * Used by Rate, Entropy, Behavior, and Risk aggregators.
 */

import type { WelfordStats } from '../../../types.ts';

/**
 * Z-score calculation with safe division.
 * Returns 0 when standard deviation is zero.
 */
export function zScore(value: number, mean: number, stdDev: number): number {
	return stdDev > 0 ? (value - mean) / stdDev : 0;
}

/**
 * Sigmoid function — maps any real number to (0,1) range.
 * @param steepness — higher values make the curve steeper (default 1)
 */
export function sigmoid(x: number, steepness = 1): number {
	return 1 / (1 + Math.exp(-steepness * x));
}

/**
 * Clamps a value to the specified inclusive range.
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * Converts Welford's M2 accumulator to sample variance.
 * Returns 0 if insufficient data (count ≤ 1).
 */
export function varianceFromM2(stat: WelfordStats): number {
	return stat.count > 1 ? stat.M2 / (stat.count - 1) : 0;
}

/**
 * Harmonic mean — heavily penalizes low confidence values.
 * Used as final confidence aggregator in RiskAggregator.
 */
export function harmonicMean(values: number[]): number {
	if (values.length === 0) return 0;
	const sumOfInverses = values.reduce((sum, v) => sum + 1 / Math.max(v, 0.01), 0);
	return values.length / sumOfInverses;
}

/**
 * Classic weighted arithmetic mean.
 * Safe against zero total weight.
 */
export function weightedAverage(values: number[], weights: number[]): number {
	let numerator = 0;
	let denominator = 0;
	for (let i = 0; i < values.length; i++) {
		numerator += values[i] * weights[i];
		denominator += weights[i];
	}
	return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * clamp(t, 0, 1);
}