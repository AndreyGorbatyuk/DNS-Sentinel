# Rate Metric Calculator — API
```ts
/**
* @spec specs/rate.spec.md
* @example examples/analysis-engine.examples.md
*/
class RateMetricCalculator {
	/**
	* Calculates the normalized request rate anomaly metric M1 ∈ [0, 1].
	*/
	async calculate(
	domain: string,
	context: RequestContext // See api/request-context.api.md
	): Promise<MetricResult> { // See api/metric-result.api.md
		// Cursor: Implement per rate.spec.md
	}
	
	private async loadDomainStatistics(domain: string): Promise<DomainProfile | null> {
		// See api/domain-profile.api.md
		// Cursor: Implement
	}
	
	private calculateMultiWindowRates(profile: DomainProfile): TimeWindowRates {
		// Cursor: Implement
	}
	
	private detectBurst(rates: TimeWindowRates, profile: DomainProfile): BurstInfo {
		// Cursor: Implement
	}
	
	private normalize(score: number): number {
		// Cursor: Implement
	}
	
	private calculateConfidence(profile: DomainProfile, rates: TimeWindowRates): number {
		// Cursor: Implement
	}
}
```
---

## Types
```ts
// See api/metric-result.api.md for MetricResult
// See api/domain-profile.api.md for DomainProfile

interface TimeWindowRates {
	oneMinute: number;
	fiveMinute: number;
	fifteenMinute: number;
}

interface BurstInfo {
	detected: boolean;
	multiplier: number;
	peakRate: number;
}
```
---

## Configuration
```ts
// See api/configuration.api.md

```
---

*This file contains **only public API**. Implementation generated from `specs/rate.spec.md`.*