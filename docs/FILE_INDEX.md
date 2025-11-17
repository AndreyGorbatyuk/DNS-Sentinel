# FILE_INDEX.md — DNS Sentinel Documentation Registry  
**Version 1.0 | November 11, 2025 19:20 EET | UA | Complete, Cursor-ready, SSOT**

---

## `api/` — Interfaces (SSOT)

| File | Description |
|------|-----------|
| `request-context.api.md` | Request input context |
| `metric-result.api.md` | Mᵢ metric result |
| `domain-profile.api.md` | Domain profile |
| `risk-assessment.api.md` | Final risk assessment |
| `user-feedback.api.md` | User feedback |
| `configuration.api.md` | Global configuration |

---

## `02-mathematical-model/` — Formulas

| File | Description |
|------|-----------|
| `formulas.md` | Formulas 1–16 |
| `normalization.md` | Z-score, sigmoid, Welford |
| `risk-aggregation.md` | Formula 12 |
| `threshold-classification.md` | Formula 14 |
| `adaptive-calibration.md` | Formulas 15–16 |

---

## `03-architecture/` — Architecture

### `components/`

| File | Description |
|------|-----------|
| `request-interceptor.md` | Request interception |
| `background-service-worker.md` | Orchestrator |
| `analysis-engine.md` | Analysis engine |
| `rate-calculator.md` | M1 |
| `entropy-calculator.md` | M2 |
| `reputation-calculator.md` | M3 |
| `behavior-calculator.md` | M4 |
| `risk-aggregator.md` | R aggregation |
| `alert-system.md` | Notifications |
| `storage-layer.md` | Storage |
| `domain-statistics.md` | Statistics |
| `configuration-store.md` | Settings |

### Flows

| File | Description |
|------|-----------|
| `data-flow.md` | Full cycle |
| `component-interactions.md` | Event contracts |

---

## `04-algorithms/` — Algorithms

| File | Description |
|------|-----------|
| `main-workflow.md` | Main pipeline |
| `request-interception.md` | Domain extraction |
| `metrics-calculation.md` | M1–M4 in parallel |
| `risk-calculation.md` | R = Σ wᵢMᵢ |
| `classification-response.md` | Level + action |
| `statistics-update.md` | Profile update |
| `performance.md` | Constraints |

---

## `05-implementation/` — Implementation

### `src/`

| File | Description |
|------|-----------|
| `interceptors/request-interceptor.ts` | `chrome.webRequest` |
| `analysis/rate-calculator.ts` | M1 |
| `analysis/entropy-calculator.ts` | M2 |
| `analysis/reputation-calculator.ts` | M3 |
| `analysis/behavior-calculator.ts` | M4 |
| `aggregators/risk-aggregator.ts` | R |
| `storage/domain-statistics.ts` | `chrome.storage.local` |
| `utils/psl.ts` | `@psl/parse` |
| `utils/normalization.ts` | Z-score, sigmoid |

### `tests/`

| File | Description |
|------|-----------|
| `rate-calculator.test.ts` | M1 |
| `entropy-calculator.test.ts` | M2 |
| `risk-aggregator.test.ts` | R |
| `statistics-update.test.ts` | Profile |

### `benchmarks/`

| File | Description |
|------|-----------|
| `rate-calculation.bench.ts` | ≤ 10 ms |
| `full-pipeline.bench.ts` | ≤ 50 ms |

### `examples/`

| File | Description |
|------|-----------|
| `popup.html` | UI |
| `background.js` | Orchestrator |

---

## `specs/` — Specifications

| File | Description |
|------|-----------|
| `rate.spec.md` | M1: input/output |
| `entropy.spec.md` | M2 |
| `reputation.spec.md` | M3 |
| `behavior.spec.md` | M4 |
| `risk.spec.md` | R |
| `performance.spec.md` | ≤ 50 ms |

---

## Root Files

| File | Description |
|------|-----------|
| `README.md` | Project overview |
| `ROADMAP.md` | ML, cross-browser support |
| `FILE_INDEX.md` | **This file** |
