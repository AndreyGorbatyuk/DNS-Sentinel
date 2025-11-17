# Classification & Response — Algorithm

**Purpose:** Map aggregated risk score R ∈ [0, 1] to discrete threat level and determine system response.

---

## Purpose
Classify domain risk into one of four levels (CRITICAL, HIGH, MEDIUM, LOW) based on configurable thresholds and trigger appropriate system action.

## Input
- `riskScore: number` ∈ [0, 1]
- `confidence: number` ∈ [0, 1]
- `domain: string`
- `contributingMetrics: Array<{ id: string, contribution: number }>`
- `config: Configuration` → see `api/configuration.api.md`

## Output
- `level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'`
- `action: 'BLOCK' | 'WARN' | 'LOG' | 'ALLOW'`
- `reasoning: string[]` — human-readable explanations
- `recommendations?: string[]`

## Steps (Pseudocode)

```ts
function classifyAndRespond(riskScore, confidence, domain, contributingMetrics, config):
  thresholds = config.thresholds  // { critical, high, medium }
  level = determineLevel(riskScore, thresholds)
  action = mapLevelToAction(level, config)

  reasoning = generateReasoning(level, riskScore, contributingMetrics)
  recommendations = generateRecommendations(level, domain)

  return {
    level: level,
    action: action,
    reasoning: reasoning,
    recommendations: recommendations
  }
```

```ts
function determineLevel(R, thresholds):
  if R >= thresholds.critical: return 'CRITICAL'
  if R >= thresholds.high:     return 'HIGH'
  if R >= thresholds.medium:   return 'MEDIUM'
  return 'LOW'
```

```ts
function mapLevelToAction(level, config):
  rules = config.responseRules
  if rules.blockOnCritical and level == 'CRITICAL': return 'BLOCK'
  if rules.warnOnHigh and level == 'HIGH':         return 'WARN'
  if level == 'MEDIUM':                            return 'LOG'
  return 'ALLOW'
```

```ts
function generateReasoning(level, R, metrics):
  reasons = []
  reasons.push(`Risk score: ${R.toFixed(3)} → ${level}`)

  topMetric = metrics.sort((a,b) => b.contribution - a.contribution)[0]
  if topMetric:
    reasons.push(`Dominant factor: ${topMetric.id} (${(topMetric.contribution*100).toFixed(1)}%)`)

  return reasons
```

## Complexity
- **Time:** `O(1)`
- **Space:** `O(1)`

## Constraints
- `thresholds.critical > thresholds.high > thresholds.medium > 0`
- `0 ≤ riskScore ≤ 1`
- `config.responseRules` must define behavior for each level

## Mathematical Foundation
- **Formula 14**:  
  $$ \text{Level} = 
  \begin{cases}
    \text{CRITICAL} & R \geq T_c \\
    \text{HIGH}     & T_h \leq R < T_c \\
    \text{MEDIUM}   & T_m \leq R < T_h \\
    \text{LOW}      & R < T_m
  \end{cases}
  $$  
  → see `02-mathematical-model/threshold-classification.md#formula-14`

## Related Documents
- `risk-calculation.md` → source of R
- `statistics-update.md` → logging response
- `main-workflow.md` → integration point
- `02-mathematical-model/threshold-classification.md` → thresholds and proof
- `api/configuration.api.md` → thresholds and response rules
- `api/risk-assessment.api.md` → output format

---
*Algorithm only. No UI logic, no DOM, no timing. See `03-architecture/alert-system.md` for response execution and `05-implementation/` for code.*
