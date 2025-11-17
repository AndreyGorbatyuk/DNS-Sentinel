# Adaptive Weight Calibration — Formulas 15 & 16

**Mathematical specification of dynamic weight adjustment based on user feedback**  
**Goal**: Reduce false positives/negatives via **personalized learning**

---

## Core Objective

Minimize classification error:
\[
\min_{w} \quad \mathcal{L}(w) = \sum (y - \hat{y}(w))^2
\]

- \( y \): Ground truth (1 = malicious, 0 = legitimate)  
- \( \hat{y} = L(R(w)) \): Predicted level  
- \( w = [w_1, w_2, w_3, w_4] \): Metric weights

---

## Feedback Loop (Formula 15)

**Gradient-based update** after each user interaction:

\[
\boxed{w_i^{(t+1)} = w_i^{(t)} + \alpha \cdot (y - \hat{y}) \cdot \frac{\partial R}{\partial M_i}}
\]

### Partial Derivative
\[
\frac{\partial R}{\partial M_i} = w_i
\]

> Since \( R = \sum w_i M_i \)

### Final Update Rule
\[
\boxed{w_i^{(t+1)} = w_i^{(t)} + \alpha \cdot (y - \hat{y}) \cdot w_i}
\]

---

## Learning Rate & Triggers

| Event | \( y \) | \( \hat{y} \) | \( (y - \hat{y}) \) | Effect |
|------|--------|--------------|-------------------|--------|
| **False Positive** (user allows) | 0 | 1 | **−1** | ↓ weights |
| **Confirmed Threat** (user blocks) | 1 | 0 | **+1** | ↑ weights |
| **No feedback** | — | — | 0 | No change |

> **\( \alpha = 0.01 \)** (configurable)

---

## Weight Constraints

After each update:

1. **L1 Normalization**  
   \[
   w_i \leftarrow \frac{w_i}{\sum w_j}
   \]

2. **Hard Bounds**  
   \[
   \boxed{0.05 \leq w_i \leq 0.60 \quad \forall i}
   \]

3. **Minimum Contribution**  
   Ensures no metric is silenced

---

## Confidence-Weighted Update (Formula 16 Extension)

Use **metric confidence** to modulate learning:

\[
\boxed{w_i^{(t+1)} = w_i^{(t)} + \alpha \cdot (y - \hat{y}) \cdot C_i \cdot w_i}
\]

- \( C_i \): Confidence of metric \( i \)  
- High-confidence metrics → stronger updates  
- Low-confidence (e.g., cold start) → muted learning

---

## Decay to Default

**Exponential decay** when no feedback:

\[
w_i^{(t+1)} = (1 - \beta) w_i^{(t)} + \beta \cdot w_i^{\text{default}}
\]

- \( \beta = 0.001 \) per day  
- Full reset after **30 days** of inactivity

---

## Cold Start Protection

| Condition | Behavior |
|---------|----------|
| **< 5 total feedback events** | **No adaptation** |
| **< 1 day history** | Use **population defaults** |
| **M4 confidence < 0.3** | Ignore M4 in updates |

---

## Example Update

**User reports false positive** on domain with:
- \( M1=0.9, M2=0.7, M3=0.1, M4=0.3 \)
- \( R = 0.39 \), \( \hat{y} = \text{LOW} \), but system warned → \( y = 0 \)

\[
\Delta w_1 = 0.01 \cdot (-1) \cdot 0.9 \cdot 0.15 = -0.00135
\]

→ M1 weight **decreases** (burst was legitimate)

---

## Convergence Properties

| Property | Value |
|--------|-------|
| **Max Δw per event** | ≤ 0.006 |
| **Equilibrium** | Within ±0.05 of optimal |
| **Oscillation** | Damped by \( \alpha \) |
| **Privacy** | 100% local |

---

## Implementation Requirements

| Requirement | Specification |
|-----------|---------------|
| **Storage** | `userCalibration: { weights, lastUpdated, eventCount }` |
| **Persistence** | `chrome.storage.local` |
| **Sync** | Optional across devices |
| **Reset** | User-initiated or after 90 days |

---

## Related Documentation

- `formulas.md` – Formulas 15 & 16
- `weight-coefficients.md` – Default \( w^{\text{default}} \)
- `normalization.md` – \( C_i \) sources
- `specs/risk.spec.md` – `applySensitivityAdjustment()`
- `api/risk.api.md` – `updateWeights()` method
- `ROADMAP.md` – Future: Bayesian / RL alternatives

---

*This file contains **only the adaptive learning math**. No code. Used by Cursor to generate `RiskAggregator` feedback loop.*