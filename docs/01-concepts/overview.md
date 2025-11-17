# Conceptual Model — Overview

**High-level description of the DNS Sentinel multi-factor phishing detection system**

---

## Vision
**Proactive, privacy-first, real-time phishing detection at the DNS level, entirely within the browser.**

---

## Core Principles

| Principle | Description |
|---------|-----------|
| **Multi-Factor** | No single signal is sufficient. Combine orthogonal metrics. |
| **Defense in Depth** | Layered analysis: structural → reputation → behavioral → frequency |
| **Local Processing** | 100% client-side. No user data leaves the device. |
| **Graceful Degradation** | System functions even if external APIs fail. |
| **User-Centric** | Transparent decisions, override control, adaptive learning. |

---

## Problem Domain

| Challenge | Impact | Addressed By |
|---------|--------|-------------|
| **Blacklist lag** | 2–6h delay | **Entropy + Rate** (zero-day detection) |
| **Targeted attacks** | Low entropy, proper SSL | **Behavior + Reputation** |
| **False positives** | User distrust | **Weighted aggregation + overrides** |
| **Privacy risks** | Data exposure | **Local-only analysis** |
| **Performance** | Latency | **<50ms total pipeline** |

---

## Solution Architecture

```
DNS Request
     ↓
[Request Interceptor]
     ↓
┌─────────────────────────────────────────────┐
│             Analysis Engine                 │
│  ┌───────┐  ┌─────────┐  ┌────────────┐     │
│  │ Rate  │  │ Entropy │  │ Reputation │     │
│  │ (M1)  │  │  (M2)   │  │    (M3)    │     │
│  └───────┘  └─────────┘  └────────────┘     │
│         ↓         ↓         ↓              │
│  ┌─────────────────────────────────────┐    │
│  │           Risk Aggregator           │    │
│  │        R = Σ wᵢ × Mᵢ (Formula 12)   │    │
│  └─────────────────────────────────────┘    │
│                 ↓                          │
│  ┌───────────────────────────────┐         │
│  │     Risk Classification        │         │
│  │   L = f(R) (Formula 14)        │         │
│  └───────────────────────────────┘         │
└─────────────────────────────────────────────┘
     ↓
[Alert System / UI]
```

---

## Key Innovations

- **Zero external telemetry**  
- **Adaptive weights via user feedback**  
- **Confidence-weighted metric fusion**  
- **Cold-start resilience**  

---

## Scope & Boundaries

| In Scope | Out of Scope |
|--------|-------------|
| DNS-level domain analysis | Content inspection |
| Real-time risk scoring | Post-visit forensics |
| Browser extension | Server-side deployment |

---

## Related Documentation

- `metrics-integration.md` – How M1–M4 combine  
- `risk-classification.md` – Threat levels & actions  
- `02-mathematical-model/` – Formulas 12, 14, 15–16  
- `ROADMAP.md` – Limitations, future research  

---

*This file contains **no formulas, code, or examples**. See linked documents for details.*