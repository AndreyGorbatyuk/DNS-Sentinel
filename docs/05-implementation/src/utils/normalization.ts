/**
 * @file src/utils/utils.ts
 * @description Utility functions for normalization, incremental statistics,
 *              Z-score calculation, and harmonic mean aggregation.
 *              Extracted from duplicated implementations across metric calculators.
 */

/**
 * Sigmoid function: f(x) = 1 / (1 + exp(-x))
 * Maps any real number to the range [0,1] with a smooth S-curve.
 */
export function sigmoid(x: number): number {
	return 1 / (1 + Math.exp(-x));
}

/**
 * Incremental statistics interface used by Welford’s online algorithm.
 */
export interface IncrementalStats {
	count: number; // Number of observations
	mean: number;  // Running mean
	M2: number;    // Sum of squared differences from the mean
}

/**
 * Calculates sample variance from M2 using Welford’s method.
 * @param stat - Incremental statistics object
 * @returns Variance (0 if insufficient data)
 */
export function varianceFromM2(stat: IncrementalStats): number {
	return stat.count > 1 ? stat.M2 / (stat.count - 1) : 0;
}

/**
 * Computes the Z-score: (value - mean) / stdDev
 * @param value - Observed value
 * @param mean - Mean of the distribution
 * @param variance - Variance (not standard deviation)
 * @returns Z-score; 0 if stdDev is zero
 */
export function computeZScore(value: number, mean: number, variance: number): number {
	const stdDev = Math.sqrt(variance);
	return stdDev > 0 ? (value - mean) / stdDev : 0;
}

/**
 * Harmonic mean of an array of numbers.
 * Sensitive to low values – ideal for confidence aggregation.
 * @param values - Non-empty array of positive numbers
 * @returns Harmonic mean; 0 for an empty array
 */
export function harmonicMean(values: number[]): number {
	if (values.length === 0) return 0;
	const sumOfInverses = values.reduce((sum, c) => sum + 1 / Math.max(c, 0.01), 0);
	return values.length / sumOfInverses;
}