# Risk Calculation — Algorithm

**Purpose:** Aggregate normalized metric values into a single risk score R ∈ [0, 1] using weighted summation and confidence adjustment.

---

## Purpose
Combine four independent anomaly metrics (M1–M4) into a unified risk score R using adaptive weights and confidence factors.

## Input
- `metrics: Array<MetricResult>` → see `api/metric-result.api.md`
- `weights: { M1: number, M2: number, M3: number, M4: number }` → sum = 1.0
- `config: Configuration` → see `api/configuration.api.md`

## Output
- `riskScore: number` ∈ [0, 1]
- `confidence: number` ∈ [0, 1]
- `contributingMetrics: Array<{ id: string, value: number, weight: number, contribution: number }>`

## Steps (Pseudocode)

```ts
function aggregateRisk(metrics, weights, config):
  totalWeight = 0
  weightedSum = 0
  confidences = []
  contributions = []

  for each metric in metrics:
    id = metric.id        // 'M1', 'M2', 'M3', 'M4'
    value = metric.value  // ∈ [0, 1]
    confidence = metric.confidence
    weight = weights[id]

    if config.groups[id].enabled and weight > 0:
      contribution = value * weight
      weightedSum += contribution
      totalWeight += weight
      confidences.push(confidence)
      contributions.push({ id, value, weight, contribution })

  // Normalize by active weights
  if totalWeight > 0:
    R = weightedSum / totalWeight
  else:
    R = 0.5  // fallback: neutral

  // Aggregate confidence (harmonic mean favors low-confidence metrics)
  if confidences.length > 0:
    C = harmonicMean(confidences)
  else:
    C = 0.0

  return {
    riskScore: R,
    confidence: C,
    contributingMetrics: contributions
  }
```

## Complexity
- **Time:** `O(n)` where `n ≤ 4` → effectively `O(1)`
- **Space:** `O(1)`

## Constraints
- `Σ weights[M_i] = 1.0`
- Each `metric.value`, `metric.confidence` ∈ [0, 1]
- At least one metric enabled and weighted

## Mathematical Foundation
- **Formula 12**:  
  $$ R = \frac{\sum_{i=1}^{4} w_i M_i}{\sum_{i=1}^{4} w_i \cdot \mathbb{1}_{enabled}} $$  
  → see `02-mathematical-model/risk-aggregation.md#formula-12`

- **Confidence**: Harmonic mean  
  $$ C = \frac{n}{\sum \frac{1}{c_i}} $$  
  → penalizes low-confidence inputs

## Related Documents
- `metrics-calculation.md` → source of M1–M4
- `classification-response.md` → use of R
- `main-workflow.md` → integration
- `02-mathematical-model/risk-aggregation.md` → proof and derivation
- `api/metric-result.api.md` → input format
- `api/configuration.api.md` → weights and feature flags
