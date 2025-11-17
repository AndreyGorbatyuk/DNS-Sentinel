# Risk Assessment — Common API

**Risk Aggregator Unified Output Interface**

```ts
interface RiskAssessment {
  score: number;                    // R ∈ [0, 1]
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;               // ∈ [0, 1]
  metrics: {
    M1?: MetricResult;
    M2?: MetricResult;
    M3?: MetricResult;
    M4?: MetricResult;
  };
  reasoning: string[];              // Explanation of the solution
  recommendations?: string[];       // Tips for users
}
```

> Used in `risk-aggregator.api.md`, `alert-system.api.md`