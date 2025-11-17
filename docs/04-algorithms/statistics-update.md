# Statistics Update — Algorithm

**Purpose:** Incrementally update domain profile with new request data, maintain time-series, and compute rolling statistics for future anomaly detection.

---

## Purpose
Persist request context into `DomainProfile`, update counters, append to time-series, and recalculate derived statistics (means, standard deviations) using incremental formulas.

## Input
- `domain: string`
- `context: RequestContext` → see `api/request-context.api.md`
- `metrics: Array<MetricResult>` → see `api/metric-result.api.md`
- `level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'`
- `profile: DomainProfile | null` → see `api/domain-profile.api.md`

## Output
- Updated `DomainProfile` (in-place or returned)

## Steps (Pseudocode)

```ts
function updateStatistics(domain, context, metrics, level, profile):
  if profile is null:
    profile = createInitialProfile(domain, context)

  // 1. Core counters
  profile.requestCount += 1
  profile.lastSeen = context.timestamp
  if profile.firstSeen == 0:
    profile.firstSeen = context.timestamp

  // 2. Time-series append (fixed-size circular buffers)
  appendToTimeSeries(profile.timeSeries.minutely, context.timestamp)
  appendToTimeSeries(profile.timeSeries.fiveMinute, context.timestamp)
  appendToTimeSeries(profile.timeSeries.fifteenMinute, context.timestamp)

  // 3. Behavioral patterns
  hour = getHour(context.timestamp)
  profile.accessHours[hour] += 1

  day = getDayOfWeek(context.timestamp)
  profile.dayFrequencies[day] += 1

  if context.referrer:
    updateReferrerStats(profile.typicalReferrers, context.referrer)

  if context.requestType == 'navigation' and isSensitivePath(context.url):
    profile.directAccessToSensitive = true

  // 4. Risk history
  profile.riskHistory.push({
    timestamp: context.timestamp,
    level: level,
    score: getRiskScoreFromMetrics(metrics)
  })
  if profile.riskHistory.length > 100:
    profile.riskHistory.shift()

  // 5. Incremental statistics (Welford's method)
  updateIncrementalStats(profile.stats.rate1m, context.timestamp)
  updateIncrementalStats(profile.stats.rate5m, context.timestamp)
  updateIncrementalStats(profile.stats.rate15m, context.timestamp)

  return profile
```

```ts
function createInitialProfile(domain, context):
  return {
    domain: domain,
    firstSeen: context.timestamp,
    lastSeen: context.timestamp,
    requestCount: 0,
    timeSeries: { minutely: [], fiveMinute: [], fifteenMinute: [] },
    accessHours: arrayOf(24, 0),
    dayFrequencies: arrayOf(7, 0),
    typicalReferrers: [],
    directAccessToSensitive: false,
    riskHistory: [],
    stats: {
      rate1m: { count: 0, mean: 0, M2: 0 },
      rate5m: { count: 0, mean: 0, M2: 0 },
      rate15m: { count: 0, mean: 0, M2: 0 }
    }
  }
```

```ts
function updateIncrementalStats(stat, timestamp):
  stat.count += 1
  delta = 1 - stat.mean
  stat.mean += delta / stat.count
  delta2 = 1 - stat.mean
  stat.M2 += delta * delta2
```

## Complexity
- **Time:** `O(1)` — fixed-size operations
- **Space:** `O(1)` per domain (bounded buffers)

## Constraints
- `context.timestamp` must be monotonic
- `profile.riskHistory` capped at 100 entries
- `timeSeries` buffers capped at window size + 10%

## Mathematical Foundation
- **Welford’s Online Algorithm** for variance:  
  $$ \text{variance} = \frac{M_2}{n-1} $$  
  → see `02-mathematical-model/normalization.md#welford`

- **Rolling windows**: Fixed-size circular buffers with timestamp pruning

## Related Documents
- `domain-profile.api.md` → full schema
- `main-workflow.md` → call site
- `classification-response.md` → source of `level`
- `02-mathematical-model/normalization.md` → incremental stats
- `performance.md` → storage bounds
- `03-architecture/components/domain-statistics.md` → persistence layer

---
*Algorithm only. No storage API, no async, no batching. See `05-implementation/storage/` for persistence and `03-architecture/` for data flow.*
