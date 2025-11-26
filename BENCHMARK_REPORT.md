# DNS Sentinel Benchmark Report

_Run date: 2025‑11‑26 · Command: `npx vitest@2.1.9 bench benchmark/*.bench.ts`_

Benchmarks were executed for all suites under `benchmark/` (domain profile update, entropy calculation, rate calculation). The run completed successfully in ~2m 20s and produced the following observations.

---

## 1. Domain Profile Update (`domain-profile-update.bench.ts`, 45 benches, 42.8s)

**Storage I/O**
- `storage.set (single profile)` remains the baseline hot path.
- Compared to it, `storage.get (single profile)` is **4% slower** and `storage.remove (single profile)` is **11% slower**.
- Bulk operations are expensive: single `storage.set` is **8.8× faster** than `storage.set (10 profiles)` and **134× faster** than `storage.get(null)` that retrieves 100 profiles.
- _Implication_: keep single-profile writes and reads whenever possible; avoid `get(null)` scans unless absolutely necessary.

**Welford statistics**
- A cold incremental update is **1.16× faster** than warm updates with 100 samples and **3.4× faster** than batch recomputation (10 values).
- Batch updates with 100 values are **110×** slower than the incremental version.
- _Implication_: continue using streaming updates for per-request statistics; only batch when rebuilding historical data offline.

**Time-series arrays**
- `push timestamp to empty array` is **40×** faster than filtering 60 timestamps and **63×** faster than `push` when the buffer already holds 60 slots.
- The most expensive action is `push + shift (circular buffer, 120 items)`—it is **85×** slower than the empty push baseline.

**Cloning, migration, CRUD**
- Manual deep clone beats structuredClone by **4.7×** and JSON stringify/parse by **10.5×**.
- Migrating a v1 profile to v2 is **3.4×** faster than simply checking if migration is required, so guard clauses should stay cheap.
- Creating a profile is 2–3× faster than updating or deleting one; bulk updates (≥500 requests) incur a **3×** slowdown versus small profiles.
- Measuring profile size for a 1000-request profile is **6×** slower than for a 10-request profile.

---

## 2. Entropy Metric (`entropy-calculation.bench.ts`, 50 benches, 64.8s)

**Domain normalization**
- `normalize short domain (google.com)` is the baseline.
- It is **1.03×** faster than normalizing very long subdomains, **1.10×** faster than medium `co.uk` domains, and **1.45×** faster than mixed-number domains.
- Batch normalization (10 domains) is **8×** slower than the single-domain baseline.

**Frequency maps & entropy**
- Frequency maps for 10-character strings are **3.1×** faster than long strings (50 chars) and **7.9×** faster than batch processing.
- Shannon entropy for uniform distributions is **1.3×** faster than skewed distributions and **16×** faster than batch entropy on 10 distributions.
- Max entropy scales mildly with length (≤27% delta between length 10 and 20; 10 vs 50 is only 10% delta) but batch mode is **3×** slower.

**Normalization**
- Low-entropy sigmoid normalization is **1.22×** faster than high-entropy normalization; batch runs are **5.7×** slower than single calls.

**Reporter caveat**
- Scenarios comparing M2 scores (legitimate vs DGA) report `NaNx faster` because Vitest cannot compute ratios when reference values are identical. Raw timings were produced, so this is purely a reporter issue. Capture JSON output if numeric comparisons are required.

---

## 3. Rate Metric (`rate-calculation.bench.ts`, 27 benches, 32.9s)

**Window maintenance**
- Filtering 60 timestamps (1-minute window) is **1.77×** faster than filtering 120 timestamps and **11.8×** faster than 900 timestamps (15-minute window).
- Filtering 60 of 120 timestamps is **1.02×** faster than slice+concat and **4.9×** faster than `push+shift` when the buffer is full.

**Statistics**
- Warm Welford updates (100 samples) are **1.4×** faster than cold-start updates and **92×** faster than batch updates with 100 values.
- Z-score calculations with zero variance are **2.4×** faster than batch z-score runs.
- Sigmoid with scaling is only **5%** slower than the unscaled variant but batches are **4.2×** slower than single calls.

**Reporter caveat**
- Similar to the entropy suite, comparisons such as “M1: new domain vs history size” show `NaNx faster`. Absolute results are still valid.

---

## Execution Summary

| Suite | File | Benches | Duration |
| --- | --- | --- | --- |
| Domain Profile Update | `benchmark/domain-profile-update.bench.ts` | 45 | **42.8s** |
| Entropy Calculator | `benchmark/entropy-calculation.bench.ts` | 50 | **64.8s** |
| Rate Calculator | `benchmark/rate-calculation.bench.ts` | 27 | **32.9s** |

Vitest reported no runtime errors. Relative-speed rows that show `NaNx faster` stem from the reporter attempting to divide by zero when two results are identical.

---

## Recommendations

1. **Persist raw benchmark data** – run with `--reporter=json --outputFile benchmark/results-<date>.json` so we can track absolute timings and avoid `NaN` comparisons.
2. **Watch known hotspots**:
   - Large `chrome.storage` scans (`get(null)`).
   - Profile updates with hundreds of requests (use incremental strategies).
   - Entropy/rate batch jobs (prefer single-pass streaming).
3. **Automate regression alerts** – wire a simple threshold check (e.g., `storage.set (10 profiles)` must stay within +10% of current 42.8s run) before cutting releases.

All benchmark source files remain untouched; this document captures the latest execution results only.


