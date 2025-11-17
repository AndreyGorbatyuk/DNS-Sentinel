# Main workflow — Algorithm

## Purpose
Sequence of steps in analyzing a DNS query from interception to response.

## Input
→ `RequestContext` (see `api/request-context.api.md`)

## Output
→ `RiskAssessment` (see `api/risk-assessment.api.md`)  
→ Updated `DomainProfile`

## Steps (pseudocode)

```ts
function processRequest(context):
  domain = extractDomain(context.url)

  if isExcluded(domain):
    return ALLOW

  profile = loadDomainProfile(domain)

  metrics = calculateAllMetrics(domain, context, profile)

  R = aggregateRisk(metrics)  // Formula 12

  level = classifyRisk(R)     // Formula 14

  response = handleResponse(level, domain, R)

  updateStatistics(domain, context, metrics, level)

  return response
```
## Сложность

- O(1) — fixed windows, cache
- Parallelism: metrics are independent

## Связанные документы

- request-interception.md → interception
- metrics-calculation.md → M1–M4
- risk-calculation.md → R
- classification-response.md → level
- statistics-update.md → update
- performance.md → limitations


Algorithm only. No code, API, diagrams. See 03-architecture/ for flows.