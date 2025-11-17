# Metrics Calculation — Algorithm

**Purpose:** Parallel computation of four anomaly metrics (M1–M4) from domain context and historical profile.

---

## Purpose
Compute normalized anomaly scores for rate, entropy, reputation, and behavior using current request context and stored domain profile.

## Input
- `domain: string`
- `context: RequestContext` → see `api/request-context.api.md`
- `profile: DomainProfile | null` → see `api/domain-profile.api.md`

## Output
- `Array<MetricResult>` → see `api/metric-result.api.md`

## Steps (Pseudocode)

```ts
function calculateAllMetrics(domain, context, profile):
  results = []

  // M1: Request Rate Anomaly
  if config.groups.rate.enabled:
    results.push(calculateRateMetric(domain, context, profile))

  // M2: Domain Entropy Anomaly
  if config.groups.entropy.enabled:
    results.push(calculateEntropyMetric(domain))

  // M3: Reputation Score
  if config.groups.reputation.enabled:
    results.push(calculateReputationMetric(domain, profile))

  // M4: Behavioral Anomaly
  if config.groups.behavior.enabled and hasSufficientHistory(profile):
    results.push(calculateBehaviorMetric(domain, context, profile))

  return results
```

## Complexity
- **Time:** `O(1)` — fixed-size windows, cached reputation
- **Space:** `O(1)` — no dynamic allocation per call
- **Parallelism:** All metrics independent

## Constraints
- `config` must be loaded
- `profile` may be `null` → treat as high risk
- `hasSufficientHistory(profile)` → `profile.requestCount >= 5`

## Related Documents
- `rate.md` → M1 calculation
- `entropy.md` → M2 calculation
- `reputation.md` → M3 calculation
- `behavior.md` → M4 calculation
- `main-workflow.md` → integration point
- `api/metric-result.api.md` → output format
- `api/configuration.api.md` → feature flags
