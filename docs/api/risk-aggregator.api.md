# Risk Aggregator — API

```ts
class RiskAggregator {
	async aggregate(
	metrics: {
		M1?: MetricResult;
		M2?: MetricResult;
		M3?: MetricResult;
		M4?: MetricResult;
	}
	): Promise<RiskAssessment> { // See api/risk-assessment.api.md
		// Cursor: Implement per risk.spec.md
	}
	
	async handleFeedback(feedback: UserFeedback): Promise<void> { // See api/user-feedback.api.md
		// Cursor: Implement adaptive calibration
	}
}
```

---

## Configuration

```ts
// See api/configuration.api.md
```