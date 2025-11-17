# Domain Statistics — Architecture

## Purpose
Core repository in Storage Layer for historical domain interaction data. Tracks time-series, aggregates, and patterns for anomaly detection (e.g., behavior metrics). Optimized for frequent writes (per request) and fast reads (real-time analysis).

## Responsibilities
- Record requests (counters, logs, time-series)
- Compute aggregates (rates, std dev, frequencies)
- Maintain profiles (temporal, navigation patterns)
- Enforce retention (archive/evict old data)
- Provide queries (top domains, risk history)
- Support compression for large logs

## Dependencies
- **APIs**: `chrome.storage.local` (persistence)
- **Components**: `request-interceptor.md` (events), `background-service-worker.md` (init), `analysis-engine/behavior-calculator.md` (queries), `analysis-engine/rate-calculator.md` (rates)
- **Config**: `api/configuration.api.md` (retention, limits), `api/domain-profile.api.md` (schema)

## Triggers & Events
| Event | Source | Action |
|-------|--------|--------|
| **onRequestIntercepted** | Interceptor | Record request + update aggregates |
| **onAnalysisComplete** | Engine | Append metrics/risk history |
| **onUserFeedback** | UI | Update actions (dismiss/confirm) |
| **onCleanupInterval** | Background | Enforce retention/compression |
| **onQuery** | Components | Get records (top/recent/search) |

## Architecture Flow

```
Request Event →
  Extract Domain + Context →
  Load Record (cache/storage) →
  { Exists? } → Update Counters/Time-Series/Log
  { New? } → Create Profile →
  Compute Aggregates (incremental) →
  Save (batch/async) →
  Return Updated Profile
```

## Latency Targets
- Read: ≤ 2 ms (cache hit: ≤ 0.5 ms)
- Write: ≤ 5 ms (batch flush: ≤ 50 ms)
- Query (all domains): ≤ 20 ms
- Cleanup: ≤ 100 ms (background)

## Implementation Considerations
- **Manifest V3**: Async storage, batch writes
- **Caching**: LRU (max 1000 domains, TTL=1m)
- **Compression**: Limit logs to 1000, aggregate old
- **Retention**: 30 days inactive → archive/delete
- **Cross-Device**: Sync aggregates only (no logs)

## Related Documentation
- `overview.md` — Storage Layer overview
- `data-flow.md` — Request lifecycle
- `component-interactions.md` — Event contracts
- `api/domain-profile.api.md` — Schema details
- `specs/domain-statistics.spec.md` — Requirements (если существует)
- `examples/analysis-engine.examples.md` — Usage
- `02-mathematical-model/normalization.md` — Aggregates
- `ROADMAP.md` — Future ML enhancements

---

*This file contains **only architectural overview**. No code. See api/ for schemas.*