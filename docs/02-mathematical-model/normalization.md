# Normalization to [0,1]

**Mathematical specification of per-metric normalization functions**  
All metrics **M₁–M₄ ∈ [0, 1]** before aggregation in **Formula 12**

---

## Overview

| Metric | Input Range | Normalization Function | Output Mᵢ | Source |
|--------|-------------|------------------------|----------|--------|
| M1 | \( z \in (-\infty, \infty) \) | Sigmoid-like clamping | [0,1] | `specs/rate.spec.md` |
| M2 | \( H + P \in [0, \infty) \) | Shannon + penalties | [0,1] | `specs/entropy.spec.md` |
| M3 | \( S \in [0, \infty) \) | Weighted sources + penalties | [0,1] | `specs/reputation.spec.md` |
| M4 | \( A \in [0, \infty) \) | Weighted anomaly sum | [0,1] | `specs/behavior.spec.md` |

---

## M1 — Rate Anomaly (Z-Score)

### Input
\( z = \frac{R_{\text{current}} - \mu_R}{\sigma_R} \)  
\( z \in (-\infty, \infty) \)

### Formula
\[
\boxed{M1 = \min\left(1, \max\left(0, \frac{z}{3}\right)\right)}
\]

### Interpretation
| z-score | M1 | Meaning |
|--------|-----|--------|
| ≤ 0 | 0.00 | Normal or low |
| 1.5 | 0.50 | Moderate |
| 3.0 | 1.00 | **Critical burst** |

> **Linear in [0,3]**, clamped.  
> **3σ = full anomaly**

---

## M2 — Entropy + Patterns

### Input
- \( H \): Shannon entropy (bits)  
- \( P \): Sum of pattern penalties  
\[
H_{\max} = \log_2 |\mathcal{C}|
\]

### Formula
\[
\boxed{M2 = \min\left(1, \frac{H}{H_{\max}} + \sum P_i\right)}
\]

### Penalties \( P_i \)

| Pattern | \( P_i \) |
|--------|----------|
| Typosquatting | +0.30 |
| Homoglyphs (≥2) | +0.25 |
| Digit ratio ≥ 0.6 | +0.15 |
| Consecutive chars (≥3) | +0.10 |

> **Max M2 = 1.0** (even with high H)

---

## M3 — Reputation Score

### Input
- \( S_s \in \{0,1\} \): Source result (listed = 1)  
- \( P_{\text{age}}, P_{\text{SSL}}, P_{\text{WHOIS}} \): Penalties ∈ [0,1]

### Formula
\[
\boxed{M3 = \min\left(1, \sum_s w_s S_s + P_{\text{age}} + P_{\text{SSL}} + P_{\text{WHOIS}}\right)}
\]

### Default Source Weights \( w_s \)

| Source | \( w_s \) |
|--------|----------|
| PhishTank | 0.40 |
| Google Safe Browsing | 0.35 |
| OpenPhish | 0.25 |

### Penalties

| Condition | \( P \) |
|---------|--------|
| Age < 7 days | +0.30 |
| Age 7–30 days | +0.20 |
| Invalid SSL | +0.15 |
| WHOIS privacy | +0.10 |

---

## M4 — Behavioral Anomaly

### Input
- \( T, F, N \in [0,1] \): Temporal, Frequency, Navigation scores

### Formula
\[
\boxed{M4 = w_T T + w_F F + w_N N}
\]
\[
w_T = 0.30,\; w_F = 0.40,\; w_N = 0.30
\]

> Already in [0,1] per component → **no clamping needed**

---

## Normalization Properties

| Property | Guaranteed |
|--------|------------|
| **Range** | \( M_i \in [0, 1] \) |
| **Monotonic** | Higher input → higher Mᵢ |
| **Differentiable** | Except at clamp points |
| **Configurable** | Via thresholds in `specs/*.spec.md` |

---

## Confidence Propagation

Each metric provides \( C_i \in [0,1] \). Final confidence:
\[
C = \frac{\sum w_i C_i A_i}{\sum w_i A_i}
\]

> See `formulas.md` (Formula 16)

---

## Related Documentation

- `formulas.md` – Full formula list
- `specs/rate.spec.md` – M1 z-score & windows
- `specs/entropy.spec.md` – Shannon & \( H_{\max} \)
- `specs/reputation.spec.md` – Source weights
- `specs/behavior.spec.md` – T/F/N components
- `api/*.api.md` – `normalize()` method stubs

---

*This file contains **only mathematical normalization**. No code. Used by Cursor to generate metric calculators.*