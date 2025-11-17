# Risk Classification — Concept

## Purpose
Maps continuous risk score `R ∈ [0, 1]` to **4 discrete threat levels** with **actionable responses**.

**Goals**:  
- Actionable decisions  
- Balanced security/usability  
- Transparent thresholds  
- User override control  

---

## Risk Levels & Thresholds (Formula 14)

| Level | Threshold | Color | Icon | Action |
|-------|-----------|-------|------|--------|
| **CRITICAL** | `R ≥ 0.80` | Red | Block | **Block** + modal alert |
| **HIGH**     | `0.60 ≤ R < 0.80` | Orange | Warning | Warn + **proceed with override** |
| **MEDIUM**   | `0.40 ≤ R < 0.60` | Yellow | Info | Notify (banner) |
| **LOW**      | `R < 0.40` | Green | Check | Silent logging |

> See `specs/risk.spec.md` for classification logic.

---

## Response Strategies

| Level | Strategy | User Override |
|-------|---------|----------------|
| CRITICAL | Immediate block | Not allowed (safety) |
| HIGH | Strong warning modal | Allowed (1-click) |
| MEDIUM | Info banner | Auto-dismiss |
| LOW | No UI | N/A |

---

## User Communication

| Level | Message Style | Example |
|-------|---------------|--------|
| CRITICAL | **Block screen** | "This domain is confirmed phishing" |
| HIGH | **Warning modal** | "Multiple indicators suggest phishing" |
| MEDIUM | **Info toast** | "New domain — proceed with caution" |
| LOW | Silent | — |

> Details in `06-user-interaction/risk-levels.md`

---

## False Positive Handling

1. **Override** → temporary whitelist (configurable duration)  
2. **Feedback** → triggers adaptive weight adjustment  
3. **Reporting** → anonymized telemetry (opt-in)

> See `ROADMAP.md` for learning pipeline.

---

## Threshold Tuning

| Preset | Critical | High | Medium | Use Case |
|--------|----------|------|--------|---------|
| **Strict** | 0.75 | 0.55 | 0.35 | High-security |
| **Balanced** | 0.80 | 0.60 | 0.40 | Default |
| **Relaxed** | 0.85 | 0.65 | 0.45 | High usability |

> Configurable in `configuration.md`

---

## Related Documentation
- `specs/risk.spec.md` – Classification logic & Formula 14
- `api/risk.api.md` – `classifyRiskLevel()` signature
- `examples/analysis-engine.examples.md` – Real-world scenarios
- `06-user-interaction/` – UI flows & notifications
- `02-mathematical-model/risk-aggregation.md` – Score calculation

---

*This file contains **no code or examples**. Implementation generated from `api/risk.api.md` and `specs/risk.spec.md`.*