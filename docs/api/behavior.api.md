# Behavior Metric Calculator — API

```ts
/**
* @spec specs/behavior.spec.md
* @example examples/analysis-engine.examples.md
*/
class BehaviorMetricCalculator {
	/**
	* Calculates the normalized behavioral anomaly metric M4 ∈ [0, 1].
	*/
	async calculate(
	domain: string,
	context: RequestContext // See api/request-context.api.md
	): Promise<MetricResult> { // See api/metric-result.api.md
		// Cursor: Implement per behavior.spec.md
	}
	
	private async loadHistoricalProfile(domain: string): Promise<DomainProfile | null> {
		// See api/domain-profile.api.md
		// Cursor: Implement
	}
	
	private hasMinimumHistory(profile: DomainProfile): boolean {
		// Cursor: Implement
	}
	
	private calculateTemporalAnomaly(
	current: RequestContext,
	profile: DomainProfile
	): TemporalAnomaly {
		// Cursor: Implement
	}
	
	private calculateFrequencyAnomaly(
	currentRate: number,
	profile: DomainProfile
	): number {
		// Cursor: Implement
	}
	
	private analyzeNavigationPattern(
	context: RequestContext,
	profile: DomainProfile
	): NavigationAnomaly {
		// Cursor: Implement
	}
	
	private aggregateAnomalyScore(
	temporal: number,
	frequency: number,
	navigation: number
	): number {
		// Cursor: Implement
	}
	
	private calculateConfidence(profile: DomainProfile): number {
		// Cursor: Implement
	}
	
	async updateAfterRequest(domain: string, context: RequestContext): Promise<void> {
		// Cursor: Implement
	}
}
```

---

## Types

```ts
// See api/metric-result.api.md
// See api/domain-profile.api.md

interface TemporalAnomaly {
	zHour: number;
	zDay: number;
	score: number;
	anomalous: boolean;
}

interface NavigationAnomaly {
	referrerAnomaly: boolean;
	sequenceAnomaly: boolean;
	score: number;
}
```

---

## Configuration

```ts
// See api/configuration.api.md
```

---

*This file contains **only public API**. Implementation generated from `specs/behavior.spec.md`.*