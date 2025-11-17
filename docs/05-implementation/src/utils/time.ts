/**
 * @file docs/05-implementation/src/utils/time.ts
 * @description
 * Pure time-related utilities used by RateMetricCalculator, BehaviorMetricCalculator
 * and storage layer. No external dependencies, no chrome.* API.
 * Fully compatible with documentation stage — zero imports, zero errors.
 */

/// <reference no-default-lib="true"/>
/// <reference lib="es2022" />
/// <reference lib="webworker" />

/**
 * Returns hour of day (0–23) from timestamp in milliseconds.
 */
export function getHour(timestamp: number): number {
	return new Date(timestamp).getHours();
}

/**
 * Returns day of week (0 = Sunday, 6 = Saturday) from timestamp.
 */
export function getDayOfWeek(timestamp: number): number {
	return new Date(timestamp).getDay();
}

/**
 * Counts how many timestamps fall into a sliding window ending at `now`.
 * @param series   Sorted ascending array of timestamps (ms)
 * @param now      Current timestamp (ms)
 * @param windowSec Window size in seconds
 * @returns        Number of events in the last `windowSec` seconds
 */
export function slidingWindowCount(
	series: number[],
	now: number,
	windowSec: number
): number {
	if (series.length === 0) return 0;

	const cutoff = now - windowSec * 1000;

	// Fast path: series is chronologically ordered → binary search possible
	let left = 0;
	let right = series.length;

	while (left < right) {
		const mid = (left + right) >> 1; // eslint-disable-line no-bitwise
		if (series[mid] < cutoff) {
			left = mid + 1;
		} else {
			right = mid;
		}
	}

	return series.length - left;
}

/**
 * Appends a timestamp to a circular time-series buffer.
 * @param series   The array acting as buffer
 * @param timestamp New timestamp to add
 * @param maxSize  Maximum number of entries to keep (default: 120)
 */
export function appendToTimeSeries(
	series: number[],
	timestamp: number,
	maxSize = 120
): void {
	series.push(timestamp);
	if (series.length > maxSize) {
		series.shift();
	}
}

/**
 * Removes entries older than the specified window.
 * Useful for periodic cleanup of large buffers.
 */
export function pruneTimeSeries(series: number[], windowSec: number): void {
	const cutoff = Date.now() - windowSec * 1000;
	while (series.length > 0 && series[0] < cutoff) {
		series.shift();
	}
}

/**
 * Returns current timestamp in milliseconds (wrapper for consistency).
 */
export function now(): number {
	return Date.now();
}

/**
 * Converts seconds → milliseconds.
 */
export function secToMs(seconds: number): number {
	return seconds * 1000;
}

/**
 * Converts milliseconds → seconds (rounded down).
 */
export function msToSec(ms: number): number {
	return Math.floor(ms / 1000);
}