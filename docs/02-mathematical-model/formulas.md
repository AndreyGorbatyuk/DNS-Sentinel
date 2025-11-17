## Formula 1: Shannon Entropy
**LaTeX**:
```latex
H(X) = -\sum_{i=1}^{n} p(x_i) \log_2 p(x_i)
```

**Description**: Measures the randomness of characters in a domain name. High entropy is typical of algorithmically generated domains (DGAs) used in phishing.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( H(X) \) | Entropy of string \( X \) | \( \geq 0 \) (bits) |
| \( p(x_i) \) | Probability of character \( x_i \) | \( [0, 1] \) |
| \( n \) | Number of unique characters | \( \mathbb{Z}^+ \) |

---

## Formula 2: Normalized Entropy Metric (M₂)
**LaTeX**:
```latex
M_2 = \frac{H(X)}{H_{\max}}
```

**Description**: Normalizes entropy to [0, 1]. \( H_{\max} = \log_2(36) \approx 5.17 \) for alphanumeric domains.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( M_2 \) | Normalized entropy metric | \( [0, 1] \) |
| \( H(X) \) | Shannon entropy | \( \geq 0 \) |
| \( H_{\max} \) | Max entropy for charset | \( > 0 \) |

---

## Formula 3: Request Rate in Time Window
**LaTeX**:
```latex
\text{Rate}(W) = \frac{\text{RequestCount}(W)}{\text{WindowSize}(W)}
```

**Description**: Computes DNS request rate over a sliding time window (1, 5, 15 minutes).

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( \text{Rate}(W) \) | Rate in requests/min | \( \geq 0 \) |
| \( \text{RequestCount}(W) \) | Count in window | \( \mathbb{Z}^{\geq 0} \) |
| \( \text{WindowSize}(W) \) | Duration in minutes | \( > 0 \) |

---

## Formula 4: Burst Detection Condition
**LaTeX**:
```latex
R_{\text{current}} > R_{\text{avg}} \times \text{BurstMultiplier}
```

**Description**: Identifies sudden spikes in DNS activity (default multiplier = 3.0).

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( R_{\text{current}} \) | Current rate | \( \geq 0 \) |
| \( R_{\text{avg}} \) | Historical average | \( \geq 0 \) |
| \( \text{BurstMultiplier} \) | Threshold | \( > 1 \) (default: 3.0) |

---

## Formula 5: Normalized Rate Metric (M₁)
**LaTeX**:
```latex
M_1 = \min\left(1.0, \max\left(0.0, \frac{R_{\text{current}} - R_{\text{baseline}}}{R_{\text{threshold}}}\right)\right)
```

**Description**: Normalizes rate deviation into [0, 1] for risk aggregation.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( M_1 \) | Rate metric | \( [0, 1] \) |
| \( R_{\text{current}} \) | Current rate | \( \geq 0 \) |
| \( R_{\text{baseline}} \) | Baseline rate | \( \geq 0 \) |
| \( R_{\text{threshold}} \) | Threshold (default: 50 req/min) | \( > 0 \) |

---

## Formula 6: Reputation Score Aggregation (M₃)
**LaTeX**:
```latex
M_3 = \sum_{i} (w_i \times S_i) + P_{\text{age}} + P_{\text{SSL}} + P_{\text{WHOIS}}
```

**Description**: Combines scores from threat intelligence sources with domain metadata penalties.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( M_3 \) | Reputation metric | \( [0, 1] \) |
| \( w_i \) | Source weight | \( [0, 1] \), \( \sum w_i = 1 \) |
| \( S_i \) | Source score | \( [0, 1] \) |
| \( P_{\text{age}}, P_{\text{SSL}}, P_{\text{WHOIS}} \) | Penalties | \( [0, 0.3] \) |

---

## Formula 7: Source Confidence Weighting
**LaTeX**:
```latex
w_i' = w_i \times C_f
```

**Description**: Adjusts base weight by data freshness and API reliability.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( w_i' \) | Adjusted weight | \( [0, 1] \) |
| \( w_i \) | Base weight | \( [0, 1] \) |
| \( C_f \) | Confidence factor | \( [0, 1] \) (1.0 if <24h old) |

---

## Formula 8: Domain Age Penalty
**LaTeX**:
```latex
P_{\text{age}}(d) = 
\begin{cases}
0.3 & d < 7 \\
0.2 & 7 \leq d < 30 \\
0.1 & 30 \leq d < 90 \\
0.0 & d \geq 90
\end{cases}
```

**Description**: Penalizes newly registered domains, common in phishing.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( P_{\text{age}} \) | Age penalty | \( \{0.0, 0.1, 0.2, 0.3\} \) |
| \( d \) | Domain age (days) | \( \mathbb{Z}^{\geq 0} \) |

---

## Formula 9: Behavior Anomaly Score (M₄)
**LaTeX**:
```latex
M_4 = w_t A_t + w_f A_f + w_n A_n
```

**Description**: Weighted sum of temporal, frequency, and navigation anomalies.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( M_4 \) | Behavior metric | \( [0, 1] \) |
| \( w_t, w_f, w_n \) | Weights (0.3, 0.4, 0.3) | \( [0, 1] \), sum = 1 |
| \( A_t, A_f, A_n \) | Anomaly scores | \( [0, 1] \) |

---

## Formula 10: Temporal Anomaly Score
**LaTeX**:
```latex
A_t = \min\left(1.0, \max\left(0.0, \frac{|z_h| + |z_d|}{6.0}\right)\right)
```

**Description**: Normalizes combined z-scores of access time and day.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( A_t \) | Temporal anomaly | \( [0, 1] \) |
| \( z_h \) | Hour z-score | \( \mathbb{R} \) |
| \( z_d \) | Day-of-week z-score | \( \mathbb{R} \) |

---

## Formula 11: Hour Z-Score
**LaTeX**:
```latex
z_h = \frac{h_{\text{current}} - \mu_h}{\sigma_h}
```

**Description**: Measures deviation from typical access hour.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( z_h \) | Z-score (hour) | \( \mathbb{R} \) |
| \( h_{\text{current}} \) | Current hour | \( [0, 23] \) |
| \( \mu_h \) | Mean access hour | \( \mathbb{R} \) |
| \( \sigma_h \) | Std dev of hours | \( > 0 \) |

---

## Formula 12: Integrated Risk Score (R)
**LaTeX**:
```latex
R = w_1 M_1 + w_2 M_2 + w_3 M_3 + w_4 M_4
```

**Description**: Final risk score combining all four normalized metrics.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( R \) | Integrated risk | \( [0, 1] \) |
| \( w_1 \) to \( w_4 \) | Weights: 0.15, 0.25, 0.40, 0.20 | \( [0, 1] \), sum = 1 |
| \( M_1 \) to \( M_4 \) | Metrics | \( [0, 1] \) |

---

## Formula 13: Frequency Anomaly Score
**LaTeX**:
```latex
A_f = \min\left(1.0, \max\left(0.0, \frac{z_r}{3.0}\right)\right)
```

**Description**: Normalizes request frequency deviation using z-score.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( A_f \) | Frequency anomaly | \( [0, 1] \) |
| \( z_r \) | Rate z-score | \( \mathbb{R} \) |

---

## Formula 14: Risk Level Classification
**LaTeX**:
```latex
\text{Level} = 
\begin{cases}
\text{CRITICAL} & R \geq 0.8 \\
\text{HIGH} & 0.6 \leq R < 0.8 \\
\text{MEDIUM} & 0.4 \leq R < 0.6 \\
\text{LOW} & R < 0.4
\end{cases}
```

**Description**: Maps continuous risk score to discrete threat levels.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( \text{Level} \) | Risk classification | {CRITICAL, HIGH, MEDIUM, LOW} |
| \( R \) | Risk score | \( [0, 1] \) |

---

## Formula 15: Request Rate Z-Score
**LaTeX**:
```latex
z_r = \frac{r_{\text{current}} - \mu_r}{\sigma_r}
```

**Description**: Standardizes current request rate against historical distribution.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( z_r \) | Rate z-score | \( \mathbb{R} \) |
| \( r_{\text{current}} \) | Current rate | \( \geq 0 \) |
| \( \mu_r \) | Mean rate | \( \geq 0 \) |
| \( \sigma_r \) | Std dev of rate | \( > 0 \) |

---

## Formula 16: Navigation Pattern Anomaly
**LaTeX**:
```latex
A_n = w_{\text{ref}} S_{\text{ref}} + w_{\text{seq}} S_{\text{seq}}
```

**Description**: Combines referrer and navigation sequence anomalies.

| Variable | Description | Range/Type |
|--------|-------------|-----------|
| \( A_n \) | Navigation anomaly | \( [0, 1] \) |
| \( w_{\text{ref}}, w_{\text{seq}} \) | Weights (0.6, 0.4) | \( [0, 1] \), sum = 1 |
| \( S_{\text{ref}} \) | Referrer anomaly | \( [0, 1] \) |
| \( S_{\text{seq}} \) | Sequence anomaly | \( [0, 1] \) |

---

**Note**: Formulas 1–16 fully cover the mathematical model as described in the original paper and implementation. Adaptive weight calibration (gradient-based learning) is **conceptual** and not assigned a numbered formula in the source, but is referenced in future work.