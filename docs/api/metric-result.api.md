# Metric Result — Common API

**General template for metric calculator results**

```ts
interface MetricResult {
  value: number;                    // Mᵢ ∈ [0, 1]
  confidence: number;               // ∈ [0, 1]
  detailed: Record<string, any>;    // Detail (depends on metric)
}
```

> Inherited in:
> - `RateMetricResult`
> - `BehaviorMetricResult`
> - `EntropyMetricResult`
> - `ReputationMetricResult`