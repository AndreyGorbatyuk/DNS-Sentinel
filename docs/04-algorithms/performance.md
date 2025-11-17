# Performance — Algorithm

**Purpose:** Define latency, memory, and throughput constraints for the entire analysis pipeline to ensure real-time operation with negligible browser impact.

---

## Purpose
Establish performance bounds and optimization strategies for each stage of the DNS traffic analysis pipeline under Manifest V3 constraints.

## Global Targets

| Metric | Target | Rationale |
|--------|--------|---------|
| **End-to-end latency** | ≤ 50 ms | Below human perception threshold |
| **Per-request overhead** | ≤ 5 ms | No impact on page load |
| **Memory per domain** | ≤ 2 KB | Scale to 10k+ domains |
| **CPU usage (idle)** | 0% | Background worker dormant |
| **Storage writes** | ≤ 1 per 100 ms | Avoid I/O bottlenecks |

## Stage-by-Stage Breakdown

```ts
function enforcePerformanceBounds(stage, actualMs):
  budget = getStageBudget(stage)
  if actualMs > budget * 1.5:
    triggerFallback(stage)
```

| Stage | Budget | Fallback |
|-------|--------|--------|
| Interception | ≤ 2 ms | Skip enrichment |
| Metrics | ≤ 35 ms | Use cache / skip M4 |
| Risk | ≤ 5 ms | Use last known R |
| Classification | ≤ 3 ms | Default to LOW |
| Storage | ≤ 5 ms | Batch async |

## Memory Management

```ts
function pruneDomainProfile(profile):
  if profile.requestCount > 1000:
    profile.timeSeries.minutely = keepLastN(100)
  if daysSince(profile.lastSeen) > 30:
    archiveOrDelete(profile)
```

- **Circular buffers**: Fixed size (e.g., 100 entries per window)
- **LRU cache**: Max 5000 active domains
- **Compression**: Drop `riskHistory` older than 7 days

## Throughput Control

```ts
function rateLimitAnalysis():
  if pendingRequests.length > 500:
    dropLowestPriority()
  if requestsPerSecond > 100:
    debounce(100 ms)
```

## Complexity Summary

| Component | Time | Space |
|---------|------|-------|
| Domain extraction | O(1) | O(1) |
| Metrics (all) | O(1) | O(1) |
| Risk aggregation | O(1) | O(constraints) |
| Storage update | O(1) | O(1) |

## Related Documents
- `main-workflow.md` → pipeline integration
- `statistics-update.md` → memory pruning
- `03-architecture/data-flow.md` → stage timing
- `05-implementation/performance-monitor.ts` → runtime enforcement
- `api/domain-profile.api.md` → bounded structures

---
*Algorithmic constraints only. No benchmarks, no `performance.now()`, no DOM. See `05-implementation/` for monitoring and `03-architecture/` for flow.*
