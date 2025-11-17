# Metrics Integration — Concept

## Philosophy
**Single metric detection is insufficient**. Phishing attacks exploit gaps in any one signal. The four metric groups provide **orthogonal perspectives** that compensate for each other's weaknesses:

- **Rate**: Immediate but noisy  
- **Entropy**: Structural but context-agnostic  
- **Reputation**: Authoritative but delayed  
- **Behavior**: Personalized but requires history  

**Integration via weighted linear combination** balances speed, accuracy, and robustness.

---

## Metric Groups

| Group | Metric | Symbol | Range | Weight | Focus |
|-------|--------|--------|-------|--------|-------|
| 1 | Request Rate | M1 | [0,1] | 0.15 | Intensity & burst detection |
| 2 | Entropy | M2 | [0,1] | 0.25 | DGA, typosquatting, patterns |
| 3 | Reputation | M3 | [0,1] | 0.40 | Threat intel, age, SSL |
| 4 | Behavior | M4 | [0,1] | 0.20 | User-specific anomalies |

> **Σ wᵢ = 1.0**  
> Weights reflect empirical false positive/negative trade-offs.

---

## Risk Aggregation (Formula 12)

```
R = 0.15×M1 + 0.25×M2 + 0.40×M3 + 0.20×M4
```

- **R ∈ [0, 1]**
- Higher weight on **M3 (reputation)** due to low false positive rate
- Lower weight on **M1 (rate)** due to high noise in dynamic apps

---

## Normalization Strategy
All metrics normalized to [0, 1] **before** weighting:

| Metric | Normalization | Source |
|--------|---------------|--------|
| M1 | Z-score → sigmoid | `specs/rate.spec.md` |
| M2 | H / H_max + penalties | `specs/entropy.spec.md` |
| M3 | Weighted source scores + penalties | `specs/reputation.spec.md` |
| M4 | Weighted anomaly sum | `specs/behavior.spec.md` |

---

## Confidence Integration
Final confidence uses **weighted average of metric confidences**:

```
C = (Σ wᵢ × Cᵢ × Aᵢ) / (Σ wᵢ × Aᵢ)
```

- `Cᵢ` = metric-specific confidence
- `Aᵢ` = 1 if metric available

Adjustments:
- All 4 available → +10%
- M3 missing → −40%
- High conflict → −30%

---

## Adaptive Calibration
Weights evolve via user feedback:
- **False positive** → decrease contributing metric weights
- **Missed threat** → increase
- **Learning rate** → 0.01 per event

See `ROADMAP.md` for ML-based calibration.

---

## Related Documentation
- `specs/risk.spec.md` – Full aggregation & classification
- `specs/*.spec.md` – Per-metric normalization
- `api/risk.api.md` – Integration interface
- `examples/analysis-engine.examples.md` – End-to-end scenarios
- `02-mathematical-model/formulas.md` – Formula 12 derivation

---

*This file contains **no code or examples**. Implementation generated from `api/risk.api.md` and `specs/`.*
