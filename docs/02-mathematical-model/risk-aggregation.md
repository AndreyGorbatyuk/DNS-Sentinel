# Risk Aggregation — Formula 12

**Mathematical specification of final risk score calculation**  
**Input**: Normalized metrics \( M1, M2, M3, M4 \in [0, 1] \)  
**Output**: \( R \in [0, 1] \)

---

## Core Aggregation (Formula 12)

\[
\boxed{R = 0.15 \cdot M1 + 0.25 \cdot M2 + 0.40 \cdot M3 + 0.20 \cdot M4}
\]

> **Weighted linear combination**  
> **Σ wᵢ = 1.00**

---

## Weight Rationale

| Metric | \( w_i \) | Influence | Justification |
|--------|-----------|---------|-------------|
| **M1** | 0.15 | Low | Fast but noisy |
| **M2** | 0.25 | Medium | Structural signal |
| **M3** | **0.40** | **High** | **Lowest false positive rate** |
| **M4** | 0.20 | Medium | Personalized, history-dependent |

> See `weight-coefficients.md` for sensitivity analysis

---

## Sensitivity to Inputs

\[
\frac{\partial R}{\partial M3} = 0.40 \quad \text{(highest impact)}
\]

**Example**:
- \( \Delta M3 = +0.10 \) → \( \Delta R = +0.04 \)
- \( \Delta M1 = +0.10 \) → \( \Delta R = +0.015 \)

---

## User Sensitivity Adjustment

Applied **after** Formula 12, **before** classification:

| Mode | Multiplier | \( R' = \) |
|------|-----------|-----------|
| **Strict** | 1.15 | \( R \times 1.15 \) |
| **Balanced** | 1.00 | \( R \) |
| **Relaxed** | 0.85 | \( R \times 0.85 \) |

> Clamped to [0, 1] post-adjustment

---

## Metric Availability Handling

If a metric is **unavailable** (\( A_i = 0 \)):

\[
R = \frac{\sum_{i \in \text{avail}} w_i M_i}{\sum_{i \in \text{avail}} w_i}
\]

- Preserves **relative weighting**
- Prevents zero-filling

---

## Conflict Detection (Optional)

| Condition | Conflict | Confidence Penalty |
|---------|--------|-------------------|
| \( |M1 - M3| \geq 0.60 \) | Yes | −0.30 |
| \( M2 \geq 0.80 \land M4 \leq 0.30 \) | Yes | −0.25 |

> See `specs/risk.spec.md` for implementation

---

## Output Range

\[
R \in [0, 1]
\]

- \( R = 0.00 \): Definitely legitimate  
- \( R = 0.50 \): Neutral / uncertain  
- \( R = 1.00 \): Definitely malicious

---

## Classification Mapping (Formula 14)

\[
L(R) = 
\begin{cases}
\text{CRITICAL}, & R \geq 0.80 \\
\text{HIGH},     & 0.60 \leq R < 0.80 \\
\text{MEDIUM},   & 0.40 \leq R < 0.60 \\
\text{LOW},      & R < 0.40
\end{cases}
\]

> See `risk-classification.md` for thresholds

---

## Example Calculations

| M1 | M2 | M3 | M4 | R | Level |
|----|----|----|----|---|-------|
| 0.90 | 0.80 | 0.95 | 0.70 | **0.91** | CRITICAL |
| 0.20 | 0.30 | 0.10 | 0.10 | **0.15** | LOW |
| 0.70 | 0.60 | 0.30 | 0.80 | **0.56** | MEDIUM |

---

## Requirements

| Constraint | Value |
|----------|-------|
| **Latency** | ≤ 1 ms |
| **Deterministic** | Same inputs → same R |
| **No side effects** | Pure function |
| **Config reload** | Runtime weight update |

---

## Related Documentation

- `formulas.md` – Formula 12 & 14
- `weight-coefficients.md` – Default weights
- `normalization.md` – Mᵢ ∈ [0,1]
- `specs/risk.spec.md` – Full aggregator logic
- `api/risk.api.md` – `calculateRiskScore()` signature
- `examples/analysis-engine.examples.md` – End-to-end

---

*This file contains **only the aggregation formula and constraints**. No code. Used by Cursor to generate `RiskAggregator.calculateRiskScore()`.*