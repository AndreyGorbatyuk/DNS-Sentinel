# Weight Coefficients

This document defines **all weight coefficients** used in the phishing domain detection system, including:
- **Metric-level weights** (for risk aggregation — Formula 12)
- **Component-level weights** (within individual metrics)
- **Source-level weights** (within reputation metric)

Each weight is presented in a **table** with **justification** based on threat intelligence reliability, false positive risk, and detection effectiveness.

---

## 1. Integrated Risk Score Weights (Formula 12)

| Weight | Metric | Value | **Justification** |
|--------|--------|-------|-------------------|
| \( w_1 \) | **M₁: Request Rate** | **0.15** | Lowest weight to avoid false positives from legitimate high-traffic sites (SPAs, APIs, CDNs). Rate anomalies are noisy and context-dependent. |
| \( w_2 \) | **M₂: Entropy** | **0.25** | High weight due to strong correlation between high entropy and DGA domains used in phishing. Effective for zero-day detection. |
| \( w_3 \) | **M₃: Reputation** | **0.40** | **Highest weight** — reputation comes from verified threat intelligence (PhishTank, Google Safe Browsing). Most reliable signal when available. |
| \( w_4 \) | **M₄: Behavior** | **0.20** | Moderate weight: powerful for targeted attacks but requires user history. Prone to false positives on behavior changes (travel, new devices). |

> **Sum**: \( 0.15 + 0.25 + 0.40 + 0.20 = 1.00 \)

---

## 2. Behavior Metric Component Weights (Formula 9)

| Weight | Sub-component | Value | **Justification** |
|--------|---------------|-------|-------------------|
| \( w_{\text{temporal}} \) | **Temporal Anomaly** | **0.30** | Time-of-day and day-of-week patterns are strong behavioral signals but can vary (e.g., night shifts). |
| \( w_{\text{frequency}} \) | **Frequency Anomaly** | **0.40** | **Highest sub-weight** — sudden spikes in request frequency are highly indicative of automated phishing or session hijacking. |
| \( w_{\text{navigation}} \) | **Navigation Pattern** | **0.30** | Direct access to login pages or atypical referrers is suspicious but less reliable than frequency. |

> **Sum**: \( 0.30 + 0.40 + 0.30 = 1.00 \)

---

## 3. Navigation Pattern Sub-weights (Formula 16)

| Weight | Sub-factor | Value | **Justification** |
|--------|------------|-------|-------------------|
| \( w_{\text{ref}} \) | **Referrer Anomaly** | **0.60** | **Stronger signal** — phishing sites are often accessed directly or from spam, not trusted referrers. |
| \( w_{\text{seq}} \) | **Sequence Anomaly** | **0.40** | Bypassing normal flow (e.g., direct to `/login`) is suspicious but can occur legitimately (bookmarks). |

> **Sum**: \( 0.60 + 0.40 = 1.00 \)

---

## 4. Reputation Source Weights (Formula 6)

| Weight | Source | Value | **Justification** |
|--------|--------|-------|-------------------|
| \( w_{\text{phishtank}} \) | **PhishTank** | **0.40** | Community-driven, high precision for confirmed phishing. Manual verification reduces false positives. |
| \( w_{\text{safebrowsing}} \) | **Google Safe Browsing** | **0.35** | Large-scale, automated, updated frequently. Slightly lower weight due to occasional over-blocking. |
| \( w_{\text{openphish}} \) | **OpenPhish** | **0.25** | Real-time feed, excellent for emerging threats. Lower weight due to higher false positive rate. |

> **Sum**: \( 0.40 + 0.35 + 0.25 = 1.00 \)

---

## 5. Reputation Penalty Weights

| Penalty | Factor | Value | **Justification** |
|---------|--------|-------|-------------------|
| \( P_{\text{age}} \) | **Domain Age < 7 days** | **+0.30** | 70%+ of phishing domains are <30 days old; <7 days is extremely suspicious. |
| | **Age 7–29 days** | **+0.20** | Still high risk, but less aggressive penalty. |
| | **Age 30–89 days** | **+0.10** | Moderate risk. |
| | **Age ≥ 90 days** | **+0.00** | No penalty. |
| \( P_{\text{SSL}} \) | **Invalid/Missing SSL** | **+0.15** | Many phishing sites use HTTP or invalid certs. |
| \( P_{\text{WHOIS}} \) | **Privacy Protection Enabled** | **+0.10** | Common in malicious domains to hide identity. |

---

## Adaptive Calibration (Future)

> **Note**: The system supports **gradient-based weight updates** using user feedback (Formula 15–16 in concept). Currently, weights are **static** but can be personalized per user via:
> - Positive feedback → decrease weight of triggering metric
> - Negative feedback → increase weight of missed signal

---

**Summary**:  
The weighting strategy prioritizes **verified intelligence (reputation)** while using **structural (entropy)** and **behavioral** signals to catch zero-day and targeted attacks. Rate is de-emphasized to reduce noise. All weights are configurable and validated to sum to 1.0.