export function getHour(timestamp: number): number {
	return new Date(timestamp).getHours();
}

export function getDayOfWeek(timestamp: number): number {
	return new Date(timestamp).getDay();
}

export function slidingWindowCount(
	series: number[],
	now: number,
	windowSec: number
): number {
	if (series.length === 0) return 0;

	const cutoff = now - windowSec * 1000;

	let left = 0;
	let right = series.length;

	while (left < right) {
		const mid = (left + right) >> 1;
		if (series[mid] < cutoff) {
			left = mid + 1;
		} else {
			right = mid;
		}
	}

	return series.length - left;
}

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

export function pruneTimeSeries(series: number[], windowSec: number): void {
	const cutoff = Date.now() - windowSec * 1000;
	while (series.length > 0 && series[0] < cutoff) {
		series.shift();
	}
}

export function now(): number {
	return Date.now();
}

export function secToMs(seconds: number): number {
	return seconds * 1000;
}

export function msToSec(ms: number): number {
	return Math.floor(ms / 1000);
}

