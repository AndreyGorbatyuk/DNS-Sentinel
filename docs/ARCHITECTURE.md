# DNS Sentinel - System Architecture

**Comprehensive architectural documentation for DNS Sentinel browser extension**

Version: 1.0.0 | Last Updated: November 2025

---

## Table of Contents

- [1. Architectural Overview](#1-architectural-overview)
- [2. Design Principles](#2-design-principles)
- [3. Component Architecture](#3-component-architecture)
- [4. Data Flow](#4-data-flow)
- [5. Storage Architecture](#5-storage-architecture)
- [6. Analysis Engine](#6-analysis-engine)
- [7. Alert System](#7-alert-system)
- [8. UI Architecture](#8-ui-architecture)
- [9. Performance Considerations](#9-performance-considerations)
- [10. Security Architecture](#10-security-architecture)

---

## 1. Architectural Overview

DNS Sentinel follows a **modular, event-driven architecture** designed for real-time DNS traffic analysis within the Chrome browser environment.

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Background Service Worker                      │   │
│  │  (Persistent coordinator - runs in background)              │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  Request Interceptor                                 │  │   │
│  │  │  • webRequest API listener                           │  │   │
│  │  │  • URL parsing & domain extraction                   │  │   │
│  │  │  • Timestamp recording                               │  │   │
│  │  └──────────────────┬──────────────────────────────────┘  │   │
│  │                     │                                      │   │
│  │                     ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │          Analysis Engine                            │  │   │
│  │  │                                                     │  │   │
│  │  │  ┌──────────────────────────────────────────────┐  │  │   │
│  │  │  │  Parallel Metric Calculators (10-30ms)       │  │  │   │
│  │  │  │                                              │  │  │   │
│  │  │  │  ┌────────────────┐  ┌──────────────────┐  │  │  │   │
│  │  │  │  │ Rate Calc      │  │ Entropy Calc     │  │  │  │   │
│  │  │  │  │ (M_r)          │  │ (M_e)            │  │  │  │   │
│  │  │  │  │ • Frequency    │  │ • Shannon        │  │  │  │   │
│  │  │  │  │ • Time windows │  │ • Randomness     │  │  │  │   │
│  │  │  │  └────────────────┘  └──────────────────┘  │  │  │   │
│  │  │  │                                              │  │  │   │
│  │  │  │  ┌────────────────┐  ┌──────────────────┐  │  │  │   │
│  │  │  │  │ Reputation     │  │ Behavior Calc    │  │  │  │   │
│  │  │  │  │ (M_rep)        │  │ (M_b)            │  │  │  │   │
│  │  │  │  │ • Blacklists   │  │ • User profile   │  │  │  │   │
│  │  │  │  │ • Domain age   │  │ • Temporal       │  │  │  │   │
│  │  │  │  │ • SSL check    │  │ • Navigation     │  │  │  │   │
│  │  │  │  └────────────────┘  └──────────────────┘  │  │  │   │
│  │  │  └──────────────┬───────────────────────────┘  │  │   │
│  │  │                 │                               │  │   │
│  │  │                 ▼                               │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │  Risk Aggregator (1-5ms)                 │  │  │   │
│  │  │  │  • Weighted combination                  │  │  │   │
│  │  │  │  • Risk = Σ(w_i × M_i)                  │  │  │   │
│  │  │  │  • Classification (CRITICAL/HIGH/MED)    │  │  │   │
│  │  │  └──────────────┬───────────────────────────┘  │  │   │
│  │  └─────────────────┼──────────────────────────────┘  │   │
│  │                    │                                  │   │
│  │                    ▼                                  │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │          Alert System (5-10ms)                  │  │   │
│  │  │                                                 │  │   │
│  │  │  ┌──────────────────┐  ┌───────────────────┐  │  │   │
│  │  │  │ Alert Dispatcher │  │ Notification Mgr  │  │  │   │
│  │  │  │ • Decision logic │  │ • Modal warnings  │  │  │   │
│  │  │  │ • Risk routing   │  │ • Inline alerts   │  │  │   │
│  │  │  │ • Action select  │  │ • Badge updates   │  │  │   │
│  │  │  └──────────────────┘  └───────────────────┘  │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │          Storage Layer (2-5ms)                  │  │   │
│  │  │                                                 │  │   │
│  │  │  ┌────────────────────────────────────────┐    │  │   │
│  │  │  │  Domain Statistics (DS)                │    │  │   │
│  │  │  │  chrome.storage.local                  │    │  │   │
│  │  │  │  • Request counts                      │    │  │   │
│  │  │  │  • Timestamps                          │    │  │   │
│  │  │  │  • Metric history                      │    │  │   │
│  │  │  └────────────────────────────────────────┘    │  │   │
│  │  │                                                 │  │   │
│  │  │  ┌────────────────────────────────────────┐    │  │   │
│  │  │  │  Configuration Store (CF)              │    │  │   │
│  │  │  │  chrome.storage.sync                   │    │  │   │
│  │  │  │  • Weight coefficients                 │    │  │   │
│  │  │  │  • Thresholds                          │    │  │   │
│  │  │  │  • User preferences                    │    │  │   │
│  │  │  └────────────────────────────────────────┘    │  │   │
│  │  │                                                 │  │   │
│  │  │  ┌────────────────────────────────────────┐    │  │   │
│  │  │  │  History Log (HL)                      │    │  │   │
│  │  │  │  chrome.storage.local                  │    │  │   │
│  │  │  │  • Threat events                       │    │  │   │
│  │  │  │  • User actions                        │    │  │   │
│  │  │  │  • Audit trail                         │    │  │   │
│  │  │  └────────────────────────────────────────┘    │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  UI Components                           │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │  Popup UI    │  │   Settings   │  │ Notifications│  │  │
│  │  │  • Dashboard │  │   • Config   │  │  • Inline    │  │  │
│  │  │  • Stats     │  │   • Lists    │  │  • Modal     │  │  │
│  │  │  • History   │  │   • Export   │  │  • Badge     │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘

External APIs (Outbound Requests)
─────────────────────────────────
┌──────────────┐  ┌─────────────┐  ┌───────────┐  ┌──────────┐
│  PhishTank   │  │ Google Safe │  │ OpenPhish │  │  WHOIS   │
│     API      │  │  Browsing   │  │    API    │  │ Services │
└──────────────┘  └─────────────┘  └───────────┘  └──────────┘
```

---

## 2. Design Principles

### 2.1 Core Principles

1. **Modularity**: Each component is independent and replaceable
2. **Performance-First**: Sub-50ms processing constraint drives all decisions
3. **Privacy-Preserving**: All processing happens locally, zero server dependency
4. **Extensibility**: Easy to add new metrics or data sources
5. **Resilience**: Graceful degradation when external APIs fail
6. **User-Centric**: Balance security with usability

### 2.2 Architectural Patterns

- **Event-Driven Architecture**: Components communicate via events
- **Pipeline Pattern**: Sequential processing stages with clear boundaries
- **Strategy Pattern**: Pluggable metric calculators
- **Observer Pattern**: UI updates based on state changes
- **Facade Pattern**: Simplified interfaces to complex subsystems

---

## 3. Component Architecture

### 3.1 Background Service Worker

**Role**: Central coordinator and lifecycle manager

**Responsibilities**:
- Intercept all webRequest events
- Coordinate communication between components
- Manage extension lifecycle (install, update, suspend)
- Handle alarm triggers for periodic tasks
- Maintain persistent connections

**Implementation**:
```javascript
// background/service-worker.js
class ServiceWorker {
  constructor() {
    this.requestInterceptor = new RequestInterceptor();
    this.analysisEngine = new AnalysisEngine();
    this.alertSystem = new AlertSystem();
    this.storage = new StorageLayer();
  }

  async initialize() {
    // Register listeners
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleRequest.bind(this),
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );

    // Setup alarms for periodic tasks
    chrome.alarms.create("cleanup", { periodInMinutes: 60 });
    chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
  }

  async handleRequest(details) {
    const startTime = performance.now();
    
    try {
      // Stage 1: Extract domain
      const domain = this.requestInterceptor.extractDomain(details.url);
      
      // Stage 2: Analyze
      const metrics = await this.analysisEngine.calculateMetrics(domain);
      const risk = this.analysisEngine.aggregateRisk(metrics);
      
      // Stage 3: Respond
      await this.alertSystem.dispatch(domain, risk);
      
      // Stage 4: Store
      await this.storage.updateStatistics(domain, metrics, risk);
      
      // Performance monitoring
      const duration = performance.now() - startTime;
      if (duration > 50) {
        console.warn(`Slow processing: ${duration}ms for ${domain}`);
      }
    } catch (error) {
      console.error("Request handling error:", error);
      // Fail open - don't block user
    }
  }
}
```

**Performance Characteristics**:
- Lightweight: ~2-5MB memory footprint
- Always-on: Survives browser restarts
- Fast initialization: <100ms startup time

---

### 3.2 Request Interceptor

**Role**: DNS request capture and preprocessing

**Responsibilities**:
- Listen to webRequest events
- Extract and normalize domain names
- Filter noise (localhost, private IPs, cached requests)
- Record timestamps with millisecond precision
- Initialize processing context

**Domain Extraction Logic**:
```javascript
// background/request-interceptor.js
class RequestInterceptor {
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;
      
      // Remove 'www.' prefix if present
      domain = domain.replace(/^www\./, '');
      
      // Validate domain format
      if (!this.isValidDomain(domain)) {
        throw new Error(`Invalid domain: ${domain}`);
      }
      
      return domain.toLowerCase();
    } catch (error) {
      throw new Error(`URL parsing failed: ${error.message}`);
    }
  }

  isValidDomain(domain) {
    // Skip localhost and private IPs
    if (domain === 'localhost' || /^(\d+\.){3}\d+$/.test(domain)) {
      return false;
    }
    
    // Basic domain validation
    const domainPattern = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    return domainPattern.test(domain);
  }

  shouldAnalyze(domain, details) {
    // Skip analysis for certain request types
    const skipTypes = ['ping', 'beacon', 'csp_report'];
    if (skipTypes.includes(details.type)) {
      return false;
    }
    
    // Check whitelist
    if (this.isWhitelisted(domain)) {
      return false;
    }
    
    return true;
  }
}
```

---

### 3.3 Storage Layer

**Role**: Data persistence with three distinct stores

#### 3.3.1 Domain Statistics (DS)

**Purpose**: Store quantitative metrics about domain access patterns

**Schema**:
```javascript
{
  "domain.com": {
    "firstSeen": 1699123456789,          // Unix timestamp
    "lastSeen": 1699234567890,
    "requestCounts": {
      "1min": 5,                          // Sliding window counters
      "5min": 18,
      "15min": 42,
      "total": 156
    },
    "timestamps": [                       // Last 100 timestamps
      1699234567890,
      1699234566123,
      // ...
    ],
    "metricsHistory": {
      "rate": [0.15, 0.18, 0.12, ...],   // Historical metric values
      "entropy": [0.42, 0.41, 0.43, ...],
      "reputation": [0.0, 0.0, 0.0, ...],
      "behavior": [0.22, 0.25, 0.21, ...]
    },
    "riskHistory": [0.18, 0.19, 0.17, ...] // Historical risk scores
  }
}
```

**Operations**:
- Read: O(1) by domain key
- Write: Batched every 5 seconds to minimize disk I/O
- Cleanup: Remove domains not seen in 30 days

#### 3.3.2 Configuration Store (CF)

**Purpose**: User preferences and system parameters

**Schema**:
```javascript
{
  "version": "1.0.0",
  "weights": {
    "reputation": 0.4,
    "entropy": 0.3,
    "behavior": 0.2,
    "rate": 0.1
  },
  "thresholds": {
    "critical": 0.8,
    "high": 0.6,
    "medium": 0.4
  },
  "userPreferences": {
    "sensitivityMode": "balanced",      // paranoid | balanced | passive
    "notificationTypes": {
      "modal": true,
      "inline": true,
      "badge": true,
      "sound": false
    },
    "whitelist": ["trusted-site.com", "company-domain.com"],
    "blacklist": ["known-phishing.com"]
  },
  "adaptiveLearning": {
    "enabled": true,
    "learningRate": 0.01,
    "minFeedbackCount": 10
  },
  "performance": {
    "maxProcessingTime": 50,
    "cacheSize": 1000,
    "batchWriteInterval": 5000
  }
}
```

**Storage**: chrome.storage.sync (synced across devices)

#### 3.3.3 History Log (HL)

**Purpose**: Audit trail of all detected threats and user actions

**Schema**:
```javascript
{
  "events": [
    {
      "id": "evt_1699234567890_abc123",
      "timestamp": 1699234567890,
      "domain": "suspicious-site.com",
      "riskLevel": "HIGH",
      "riskScore": 0.72,
      "metrics": {
        "rate": { "value": 0.85, "normalized": 0.42 },
        "entropy": { "value": 4.2, "normalized": 0.78 },
        "reputation": { "value": 0.6, "normalized": 0.6 },
        "behavior": { "value": 0.55, "normalized": 0.28 }
      },
      "action": "WARNED",                // BLOCKED | WARNED | LOGGED
      "userResponse": "ALLOWED",         // BLOCKED | ALLOWED | REPORTED | null
      "userFeedback": {
        "timestamp": 1699234578901,
        "falsePositive": false,
        "comments": ""
      },
      "context": {
        "url": "https://suspicious-site.com/login",
        "referrer": "https://phishing-email-link.com",
        "requestType": "main_frame"
      }
    }
  ]
}
```

**Retention**: Configurable, default 90 days

---

### 3.4 Analysis Engine

**Role**: Core risk assessment computation

**Architecture**: Pipeline of specialized calculators feeding into aggregator

#### 3.4.1 Rate Metric Calculator

**Purpose**: Detect frequency anomalies

**Algorithm**:
```javascript
// analysis/rate-calculator.js
class RateCalculator {
  constructor(storage) {
    this.storage = storage;
    this.windows = [
      { duration: 60000, weight: 0.5 },    // 1 minute
      { duration: 300000, weight: 0.3 },   // 5 minutes
      { duration: 900000, weight: 0.2 }    // 15 minutes
    ];
  }

  async calculate(domain) {
    const stats = await this.storage.getDomainStats(domain);
    const now = Date.now();
    
    let weightedRate = 0;
    
    for (const window of this.windows) {
      const count = this.countRequestsInWindow(
        stats.timestamps,
        now,
        window.duration
      );
      
      // Normalize: 0 requests = 0, 100+ requests = 1
      const normalized = Math.min(count / 100, 1.0);
      weightedRate += normalized * window.weight;
    }
    
    return {
      value: weightedRate,
      raw: stats.requestCounts,
      normalized: weightedRate
    };
  }

  countRequestsInWindow(timestamps, now, windowMs) {
    const cutoff = now - windowMs;
    return timestamps.filter(ts => ts > cutoff).length;
  }
}
```

**Performance**: O(n) where n = timestamps count (max 100)

#### 3.4.2 Entropy Metric Calculator

**Purpose**: Measure domain name randomness

**Algorithm**:
```javascript
// analysis/entropy-calculator.js
class EntropyCalculator {
  calculate(domain) {
    // Remove TLD for analysis
    const domainWithoutTLD = this.removeTLD(domain);
    
    // Calculate Shannon entropy
    const entropy = this.calculateShannon(domainWithoutTLD);
    
    // Normalize: 0 entropy = 0, max entropy (~4.7 for lowercase) = 1
    const maxEntropy = Math.log2(36); // a-z, 0-9
    const normalized = Math.min(entropy / maxEntropy, 1.0);
    
    // Additional anomaly checks
    const hasExcessiveDigits = this.checkExcessiveDigits(domainWithoutTLD);
    const hasRandomPattern = this.checkRandomPattern(domainWithoutTLD);
    const hasHomoglyphs = this.checkHomoglyphs(domain);
    
    // Boost score if additional anomalies detected
    let adjustedScore = normalized;
    if (hasExcessiveDigits) adjustedScore += 0.1;
    if (hasRandomPattern) adjustedScore += 0.15;
    if (hasHomoglyphs) adjustedScore += 0.2;
    
    return {
      value: entropy,
      normalized: Math.min(adjustedScore, 1.0),
      flags: {
        excessiveDigits: hasExcessiveDigits,
        randomPattern: hasRandomPattern,
        homoglyphs: hasHomoglyphs
      }
    };
  }

  calculateShannon(text) {
    const freq = {};
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = text.length;
    
    for (const count of Object.values(freq)) {
      const probability = count / len;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }

  checkExcessiveDigits(domain) {
    const digitCount = (domain.match(/\d/g) || []).length;
    const digitRatio = digitCount / domain.length;
    return digitRatio > 0.3; // More than 30% digits is suspicious
  }

  checkRandomPattern(domain) {
    // Check for consonant clusters or other patterns
    const consonantClusters = domain.match(/[bcdfghjklmnpqrstvwxyz]{4,}/gi);
    return consonantClusters && consonantClusters.length > 0;
  }

  checkHomoglyphs(domain) {
    const homoglyphPairs = [
      ['0', 'o'], ['1', 'l'], ['1', 'i'],
      ['5', 's'], ['8', 'b'], ['vv', 'w']
    ];
    
    for (const [char1, char2] of homoglyphPairs) {
      if (domain.includes(char1) || domain.includes(char2)) {
        // Further analysis needed - check against known legitimate domains
        return this.checkSimilarityToLegitimate(domain);
      }
    }
    return false;
  }
}
```

**Performance**: O(m) where m = domain name length (typically <50)

#### 3.4.3 Reputation Metric Calculator

**Purpose**: Aggregate threat intelligence from multiple sources

**Implementation**:
```javascript
// analysis/reputation-calculator.js
class ReputationCalculator {
  constructor() {
    this.apis = {
      phishTank: new PhishTankAPI(),
      safeBrowsing: new GoogleSafeBrowsingAPI(),
      openPhish: new OpenPhishAPI()
    };
    this.whoisService = new WHOISService();
    this.certChecker = new CertificateChecker();
  }

  async calculate(domain) {
    // Parallel API calls with timeout
    const results = await Promise.allSettled([
      this.checkBlacklists(domain),
      this.checkDomainAge(domain),
      this.checkSSLCertificate(domain)
    ]);

    // Aggregate results with weighted importance
    const blacklistScore = this.getBlacklistScore(results[0]);
    const ageScore = this.getAgeScore(results[1]);
    const sslScore = this.getSSLScore(results[2]);

    // Weights: blacklist=0.6, age=0.25, ssl=0.15
    const aggregated = 
      blacklistScore * 0.6 +
      ageScore * 0.25 +
      sslScore * 0.15;

    return {
      value: aggregated,
      normalized: aggregated, // Already normalized
      details: {
        blacklisted: results[0].value,
        domainAge: results[1].value,
        sslStatus: results[2].value
      }
    };
  }

  async checkBlacklists(domain) {
    const checks = await Promise.allSettled([
      this.apis.phishTank.check(domain),
      this.apis.safeBrowsing.check(domain),
      this.apis.openPhish.check(domain)
    ]);

    // If ANY service flags as malicious, return high score
    const anyMalicious = checks.some(
      result => result.status === 'fulfilled' && result.value === true
    );

    return anyMalicious ? 1.0 : 0.0;
  }

  async checkDomainAge(domain) {
    try {
      const whoisData = await this.whoisService.lookup(domain);
      const creationDate = new Date(whoisData.creationDate);
      const ageInDays = (Date.now() - creationDate) / (1000 * 60 * 60 * 24);

      // Younger than 30 days = high risk
      // Older than 365 days = low risk
      if (ageInDays < 30) return 1.0;
      if (ageInDays > 365) return 0.0;
      
      // Linear interpolation between 30-365 days
      return 1.0 - ((ageInDays - 30) / 335);
    } catch (error) {
      // If WHOIS fails, assume moderate risk
      return 0.5;
    }
  }

  async checkSSLCertificate(domain) {
    try {
      const cert = await this.certChecker.getCertificate(domain);
      
      // No SSL = high risk
      if (!cert) return 1.0;
      
      // Self-signed = high risk
      if (cert.selfSigned) return 0.9;
      
      // Let's Encrypt = moderate risk (easy to obtain)
      if (cert.issuer.includes('Let\'s Encrypt')) return 0.3;
      
      // EV certificate = low risk
      if (cert.type === 'EV') return 0.0;
      
      // OV certificate = low-moderate risk
      if (cert.type === 'OV') return 0.1;
      
      // DV certificate = moderate risk
      return 0.4;
    } catch (error) {
      return 0.6; // Assume moderate-high risk on error
    }
  }
}
```

**Performance**: 10-25ms (dominated by external API calls)

#### 3.4.4 Behavior Metric Calculator

**Purpose**: Detect deviations from user's normal patterns

**Implementation**:
```javascript
// analysis/behavior-calculator.js
class BehaviorCalculator {
  constructor(storage) {
    this.storage = storage;
  }

  async calculate(domain) {
    const userProfile = await this.storage.getUserProfile();
    const domainStats = await this.storage.getDomainStats(domain);
    
    const temporalScore = this.analyzeTemporalAnomaly(
      domainStats,
      userProfile
    );
    
    const frequencyScore = this.analyzeFrequencyAnomaly(
      domainStats,
      userProfile
    );
    
    const navigationScore = this.analyzeNavigationAnomaly(
      domain,
      userProfile
    );
    
    // Weighted combination
    const combined = 
      temporalScore * 0.4 +
      frequencyScore * 0.3 +
      navigationScore * 0.3;
    
    return {
      value: combined,
      normalized: combined,
      components: {
        temporal: temporalScore,
        frequency: frequencyScore,
        navigation: navigationScore
      }
    };
  }

  analyzeTemporalAnomaly(domainStats, userProfile) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Get user's typical activity pattern for this hour/day
    const typicalActivity = userProfile.activityPatterns[dayOfWeek][hour];
    
    // Calculate z-score for current access time
    const mean = typicalActivity.mean;
    const stdDev = typicalActivity.stdDev;
    const zScore = Math.abs((hour - mean) / stdDev);
    
    // Convert z-score to 0-1 scale (z > 3 = 1.0)
    return Math.min(zScore / 3, 1.0);
  }

  analyzeFrequencyAnomaly(domainStats, userProfile) {
    // Compare current access frequency to historical average
    const currentRate = domainStats.requestCounts['1min'];
    const historicalAvg = this.calculateAverage(
      domainStats.metricsHistory.rate
    );
    
    // Calculate percentage deviation
    if (historicalAvg === 0) return 0.5; // Insufficient data
    
    const deviation = Math.abs(currentRate - historicalAvg) / historicalAvg;
    
    // Deviation > 200% = 1.0, < 50% = 0.0
    if (deviation > 2.0) return 1.0;
    if (deviation < 0.5) return 0.0;
    
    return (deviation - 0.5) / 1.5;
  }

  analyzeNavigationAnomaly(domain, userProfile) {
    // Check if user was referred from suspicious source
    const referrer = this.getCurrentReferrer();
    
    if (this.isSuspiciousReferrer(referrer)) {
      return 0.8;
    }
    
    // Check if direct navigation to login page (phishing pattern)
    if (this.isDirectToLogin(domain)) {
      return 0.7;
    }
    
    return 0.0;
  }
}
```

**Performance**: 5-10ms (depends on profile size)

#### 3.4.5 Risk Aggregator

**Purpose**: Combine all metrics into final risk score

**Implementation**:
```javascript
// analysis/risk-aggregator.js
class RiskAggregator {
  constructor(storage) {
    this.storage = storage;
  }

  async aggregate(metrics) {
    // Load current weight configuration
    const config = await this.storage.getConfig();
    const weights = config.weights;
    
    // Weighted linear combination
    const risk = 
      weights.rate * metrics.rate.normalized +
      weights.entropy * metrics.entropy.normalized +
      weights.reputation * metrics.reputation.normalized +
      weights.behavior * metrics.behavior.normalized;
    
    // Classify risk level
    const level = this.classifyRiskLevel(risk, config.thresholds);
    
    return {
      score: risk,
      level: level,
      metrics: metrics,
      weights: weights
    };
  }

  classifyRiskLevel(score, thresholds) {
    if (score >= thresholds.critical) return 'CRITICAL';
    if (score >= thresholds.high) return 'HIGH';
    if (score >= thresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  async adaptWeights(domain, userFeedback) {
    // Adaptive calibration based on user feedback
    const config = await this.storage.getConfig();
    
    if (!config.adaptiveLearning.enabled) return;
    
    const learningRate = config.adaptiveLearning.learningRate;
    const event = await this.storage.getHistoryEvent(domain);
    
    // Calculate prediction error
    const predictedRisk = event.riskScore;
    const actualRisk = this.interpretUserFeedback(userFeedback);
    const error = predictedRisk - actualRisk;
    
    // Gradient descent update
    const newWeights = { ...config.weights };
    
    for (const metric of ['rate', 'entropy', 'reputation', 'behavior']) {
      const metricValue = event.metrics[metric].normalized;
      const gradient = error * metricValue;
      newWeights[metric] -= learningRate * gradient;
      
      // Ensure weights stay in valid range [0, 1]
      newWeights[metric] = Math.max(0, Math.min(1, newWeights[metric]));
    }
    
    // Normalize weights to sum to 1
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    for (const key in newWeights) {
      newWeights[key] /= sum;
    }
    
    // Save updated weights
    config.weights = newWeights;
    await this.storage.saveConfig(config);
  }

  interpretUserFeedback(feedback) {
    // Convert user action to "actual" risk score
    switch (feedback.userResponse) {
      case 'BLOCKED':
      case 'REPORTED':
        return 1.0; // User confirmed threat
      case 'ALLOWED':
        if (feedback.falsePositive) {
          return 0.0; // User indicated false positive
        }
        return 0.5; // User allowed but didn't confirm safety
      default:
        return 0.5; // Neutral
    }
  }
}
```

---

## 4. Data Flow

### 4.1 Request Processing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Stage 1: Interception (1-5ms)                                    │
├──────────────────────────────────────────────────────────────────┤
│ 1. webRequest.onBeforeRequest fires                              │
│ 2. Extract domain from URL                                       │
│ 3. Validate domain format                                        │
│ 4. Check whitelist/blacklist                                     │
│ 5. Record timestamp                                              │
│ 6. Initialize processing context                                 │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│ Stage 2: Parallel Metrics Calculation (10-30ms)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │  Rate Calc      │  │  Entropy Calc   │  │  Reputation Calc │ │
│  │  (5-10ms)       │  │  (1-2ms)        │  │  (10-25ms)       │ │
│  │                 │  │                 │  │                  │ │
│  │ • Query storage │  │ • Local compute │  │ • API calls      │ │
│  │ • Count windows │  │ • Shannon       │  │ • WHOIS lookup   │ │
│  │ • Normalize     │  │ • Anomaly check │  │ • Cert check     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘ │
│           │                    │                     │           │
│           └────────────────────┼─────────────────────┘           │
│                                │                                 │
│  ┌─────────────────────────────▼──────────────────┐              │
│  │  Behavior Calculator (5-10ms)                  │              │
│  │  • Load user profile                           │              │
│  │  • Temporal analysis                           │              │
│  │  • Frequency analysis                          │              │
│  │  • Navigation analysis                         │              │
│  └─────────────────────────────┬──────────────────┘              │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ Stage 3: Risk Aggregation (1-5ms)                                │
├──────────────────────────────────────────────────────────────────┤
│ 1. Load weight coefficients from config                          │
│ 2. Calculate weighted sum: Risk = Σ(w_i × M_i)                   │
│ 3. Classify risk level (CRITICAL/HIGH/MEDIUM/LOW)                │
│ 4. Generate risk assessment object                               │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│ Stage 4: Alert Dispatch & Response (5-10ms)                      │
├──────────────────────────────────────────────────────────────────┤
│ Switch on risk level:                                            │
│   CRITICAL (≥0.8): Block domain + Modal warning                  │
│   HIGH (0.6-0.8): Show strong warning                            │
│   MEDIUM (0.4-0.6): Show info notification                       │
│   LOW (<0.4): Silent logging only                                │
│                                                                   │
│ Update UI components:                                            │
│   • Badge counter                                                │
│   • Popup dashboard                                              │
│   • System notifications                                         │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│ Stage 5: Storage Update (2-5ms)                                  │
├──────────────────────────────────────────────────────────────────┤
│ 1. Update Domain Statistics (DS):                                │
│    • Increment request counters                                  │
│    • Append timestamp                                            │
│    • Store metric values in history                              │
│                                                                   │
│ 2. Append to History Log (HL):                                   │
│    • Create event record with full context                       │
│    • Include metrics, risk score, action taken                   │
│                                                                   │
│ 3. Trigger adaptive calibration (if user feedback available)     │
└──────────────────────────────────────────────────────────────────┘

Total Processing Time: 5-50 milliseconds
```

---

## 5. Storage Architecture

### 5.1 Storage Strategy

**chrome.storage.local** (fast, not synced):
- Domain Statistics (DS) - high write frequency
- History Log (HL) - append-only audit trail
- Cached API responses
- User behavior profiles

**chrome.storage.sync** (synced across devices):
- Configuration Store (CF)
- User preferences
- Weight coefficients
- Whitelists/blacklists

### 5.2 Data Flow Patterns

```
┌────────────────────┐
│   Metric           │
│   Calculators      │
└────────┬───────────┘
         │ (write)
         ▼
┌────────────────────┐       ┌────────────────────┐
│ Domain Statistics  │◄──────│  Batch Write       │
│      (DS)          │       │  Queue             │
└────────────────────┘       └────────────────────┘
         ▲                    • Collects writes
         │ (read)             • Flushes every 5s
         │                    • Reduces disk I/O
┌────────┴───────────┐
│  Next Request      │
│  (same domain)     │
└────────────────────┘
```

### 5.3 Performance Optimization

**Caching Strategy**:
```javascript
class StorageLayer {
  constructor() {
    this.cache = new LRU({ max: 1000 }); // LRU cache for hot domains
    this.writeQueue = [];
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  async getDomainStats(domain) {
    // Check cache first
    if (this.cache.has(domain)) {
      return this.cache.get(domain);
    }
    
    // Cache miss - load from storage
    const data = await chrome.storage.local.get(domain);
    this.cache.set(domain, data[domain]);
    return data[domain];
  }

  async updateDomainStats(domain, stats) {
    // Update cache immediately
    this.cache.set(domain, stats);
    
    // Queue write for batch processing
    this.writeQueue.push({ domain, stats });
  }

  async flush() {
    if (this.writeQueue.length === 0) return;
    
    // Batch write all pending updates
    const batch = {};
    for (const { domain, stats } of this.writeQueue) {
      batch[domain] = stats;
    }
    
    await chrome.storage.local.set(batch);
    this.writeQueue = [];
  }
}
```

---

## 6. Analysis Engine

*[Covered extensively in Section 3.4]*

**Key Design Decisions**:
1. **Parallel Execution**: All 4 calculators run simultaneously via `Promise.all()`
2. **Fail-Safe**: If one calculator fails, others continue
3. **Timeout Protection**: Each calculator has 30ms timeout
4. **Graceful Degradation**: Missing metrics use default neutral values

---

## 7. Alert System

### 7.1 Alert Dispatcher

**Decision Logic**:
```javascript
class AlertDispatcher {
  async dispatch(domain, riskAssessment) {
    const { score, level } = riskAssessment;
    
    switch (level) {
      case 'CRITICAL':
        await this.handleCritical(domain, riskAssessment);
        break;
      case 'HIGH':
        await this.handleHigh(domain, riskAssessment);
        break;
      case 'MEDIUM':
        await this.handleMedium(domain, riskAssessment);
        break;
      case 'LOW':
        await this.handleLow(domain, riskAssessment);
        break;
    }
  }

  async handleCritical(domain, risk) {
    // Block domain immediately
    await this.blockDomain(domain);
    
    // Show modal warning
    await this.notificationManager.showModal({
      title: '🔴 Critical Threat Detected',
      message: `Domain ${domain} has been blocked due to high phishing risk.`,
      details: this.formatRiskDetails(risk),
      actions: ['View Details', 'Report False Positive']
    });
    
    // Log event
    await this.logEvent(domain, risk, 'BLOCKED');
  }

  async blockDomain(domain) {
    // Use declarativeNetRequest to block domain
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: this.generateRuleId(domain),
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: `*://${domain}/*`,
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }]
    });
  }
}
```

### 7.2 Notification Manager

**Multi-Channel Notifications**:
```javascript
class NotificationManager {
  async showModal(options) {
    // Inject modal into active tab
    await chrome.tabs.executeScript({
      code: `
        const modal = document.createElement('div');
        modal.id = 'dns-sentinel-modal';
        modal.innerHTML = \`
          <div class="ds-modal-overlay">
            <div class="ds-modal-content">
              <h2>${options.title}</h2>
              <p>${options.message}</p>
              <div class="ds-modal-details">${options.details}</div>
              <div class="ds-modal-actions">
                ${options.actions.map(action => `
                  <button class="ds-btn">${action}</button>
                `).join('')}
              </div>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      `
    });
  }

  async showInlineWarning(domain) {
    // Inject warning banner at top of page
    await chrome.tabs.executeScript({
      code: `
        const banner = document.createElement('div');
        banner.id = 'dns-sentinel-warning';
        banner.className = 'ds-inline-warning';
        banner.innerHTML = \`
          ⚠️ DNS Sentinel: This domain (${domain}) may be unsafe.
          <button onclick="this.parentElement.remove()">Dismiss</button>
        \`;
        document.body.insertBefore(banner, document.body.firstChild);
      `
    });
  }

  async updateBadge(threatCount) {
    // Update extension icon badge
    await chrome.action.setBadgeText({
      text: threatCount > 0 ? String(threatCount) : ''
    });
    
    await chrome.action.setBadgeBackgroundColor({
      color: threatCount > 0 ? '#FF0000' : '#00FF00'
    });
  }

  async showSystemNotification(options) {
    // Native OS notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/warning-128.png',
      title: options.title,
      message: options.message,
      priority: 2
    });
  }
}
```

---

## 8. UI Architecture

### 8.1 Popup UI

**Component Structure**:
```
popup.html
├── Dashboard Tab
│   ├── Threat Counter (24h)
│   ├── Risk Distribution Chart
│   └── Recent Threats List
├── History Tab
│   ├── Search/Filter
│   ├── Event Timeline
│   └── Detailed Event View
└── Settings Tab
    ├── Sensitivity Slider
    ├── Notification Preferences
    ├── Whitelist/Blacklist Manager
    └── Export Data Button
```

**Implementation**:
```javascript
// ui/popup/dashboard.js
class Dashboard {
  async render() {
    const stats = await this.loadStatistics();
    
    document.getElementById('threat-count').textContent = stats.total;
    document.getElementById('critical-count').textContent = stats.critical;
    document.getElementById('high-count').textContent = stats.high;
    
    this.renderChart(stats.distribution);
    this.renderRecentThreats(stats.recent);
  }

  renderChart(distribution) {
    // Use Chart.js for risk distribution pie chart
    new Chart(document.getElementById('risk-chart'), {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [
            distribution.critical,
            distribution.high,
            distribution.medium,
            distribution.low
          ],
          backgroundColor: ['#FF0000', '#FF8800', '#FFCC00', '#00FF00']
        }]
      }
    });
  }
}
```

---

## 9. Performance Considerations

### 9.1 Critical Performance Paths

**Hot Path Optimization**:
1. **Request Interception**: < 5ms
   - Optimized URL parsing
   - Fast domain extraction
   - Minimal validation

2. **Metrics Calculation**: < 30ms
   - Parallel execution
   - Cached data access
   - Timeout protection

3. **Risk Aggregation**: < 5ms
   - Simple arithmetic
   - Pre-loaded config
   - No I/O operations

4. **Alert Dispatch**: < 10ms
   - Async notifications
   - Non-blocking UI updates

### 9.2 Resource Management

**Memory**:
- LRU cache limits: 1000 domains (~5MB)
- History log rotation: 90 days
- Automatic cleanup of old data

**CPU**:
- Throttle analysis for repeated requests (same domain within 1s)
- Debounce storage writes
- Lazy load UI components

**Network**:
- Cache API responses (TTL: 1 hour)
- Batch API requests when possible
- Graceful degradation on API failure

---

## 10. Security Architecture

### 10.1 Threat Model

**Protected Against**:
- ✅ Phishing domains
- ✅ DGA (Domain Generation Algorithm) domains
- ✅ Typosquatting
- ✅ Newly registered malicious domains
- ✅ Homoglyph attacks

**Not Protected Against**:
- ❌ Zero-day phishing (no reputation data yet)
- ❌ Highly sophisticated targeted attacks
- ❌ Legitimate sites compromised after reputation check

### 10.2 Security Measures

**Input Validation**:
- Sanitize all URLs before processing
- Validate all API responses
- Escape all user-provided data in UI

**API Key Protection**:
```javascript
// Store API keys in encrypted storage
const encryptedKeys = await chrome.storage.local.get('apiKeys');
const keys = await this.decrypt(encryptedKeys);
```

**CSP (Content Security Policy)**:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Conclusion

DNS Sentinel's architecture prioritizes **performance**, **modularity**, and **privacy** while maintaining high detection accuracy through a multi-factor risk assessment model. The system is designed to be extensible, allowing easy integration of new metrics or data sources without disrupting existing functionality.

For detailed implementation guidance, see:
- Component specifications: `docs/03-architecture/components/`
- Algorithm details: `docs/04-algorithms/`
- API integration: `docs/05-implementation/apis-usage.md`

---

**Document Version**: 1.0.0  
**Last Updated**: November 2025  
**Maintained By**: DNS Sentinel Development Team
