# DNS Sentinel

**Intelligent browser extension for real-time phishing domain detection through DNS traffic analysis**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://github.com/your-repo/dns-sentinel)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Overview

DNS Sentinel is a Chrome browser extension that protects users from phishing attacks by analyzing DNS traffic patterns in real-time. Unlike traditional blacklist-based approaches, DNS Sentinel uses a sophisticated multi-factor mathematical model that combines four independent metric groups to assess domain risk.

### Key Features

- ⚡ **Real-time Analysis** - Processes DNS requests in 5-50 milliseconds
- 🧮 **Multi-factor Risk Model** - Combines 4 independent metrics for accurate detection
- 🛡️ **Adaptive Learning** - Self-calibrating system based on user feedback
- 🔒 **Privacy-First** - All processing happens locally, no data sent to external servers
- 🎨 **Smart Alerts** - Context-aware notifications based on risk severity
- 📊 **Detailed Dashboard** - Comprehensive statistics and threat history

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for ES2022 support)
- **pnpm** 9+ (package manager)
- **Chrome Browser** 88+ (or Edge 88+)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/dns-sentinel.git
cd dns-sentinel

# Install pnpm if not already installed
npm install -g pnpm@9

# Install dependencies
pnpm install

# Build the extension
pnpm build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

### Development Mode

For development with hot reload:

```bash
# Start development server with watch mode
pnpm dev

# The extension will auto-reload when you save files
# Just reload the extension in chrome://extensions/ after changes
```

### Usage

1. **Install the extension** - Follow installation steps above
2. **Browse normally** - DNS Sentinel monitors all DNS requests automatically
3. **Review alerts** - Click extension icon to see threat dashboard

---

## 📋 How It Works

DNS Sentinel analyzes every DNS request using a comprehensive four-metric model:

### 1. Request Intensity Metrics (M_r)
Monitors the frequency and pattern of DNS requests to detect automated phishing campaigns.

**Detection Logic:**
- Legitimate users: ~10-15 requests/minute
- Phishing campaigns: 50-100+ requests/minute

### 2. Structural Anomaly Metrics (M_e)
Uses Shannon entropy to identify algorithmically generated domain names.

**Detection Logic:**
- Legitimate domains: Low entropy, dictionary words (e.g., `google.com`)
- Phishing domains: High entropy, random strings (e.g., `xk92jd-secure.com`)

### 3. Reputation Metrics (M_rep)
Integrates threat intelligence from multiple authoritative sources.

**Data Sources:**
- PhishTank API
- Google Safe Browsing
- OpenPhish
- WHOIS domain age analysis
- SSL/TLS certificate validation

### 4. Behavioral Pattern Metrics (M_b)
Analyzes user behavior to detect deviations from normal patterns.

**Detection Logic:**
- Temporal anomalies (e.g., banking access at 3 AM)
- Frequency changes (sudden bursts vs. regular access)
- Navigation patterns (direct to login vs. normal browsing)

### Integrated Risk Formula

```
Risk = w_r × M_r + w_e × M_e + w_rep × M_rep + w_b × M_b
```

**Default Weights:**
- `w_rep` = 0.4 (Reputation - highest priority)
- `w_e` = 0.3 (Entropy - structural analysis)
- `w_b` = 0.2 (Behavior - user patterns)
- `w_r` = 0.1 (Rate - frequency analysis)

---

## 🎨 Risk Classification

DNS Sentinel classifies domains into four risk levels:

| Level | Risk Score | Action | User Experience |
|-------|-----------|--------|-----------------|
| 🔴 **CRITICAL** | ≥ 0.8 | Immediate blocking | Modal warning with details |
| 🟠 **HIGH** | 0.6 - 0.8 | Strong warning | Recommendation to avoid |
| 🟡 **MEDIUM** | 0.4 - 0.6 | Informational | Unobtrusive notification |
| 🟢 **LOW** | < 0.4 | Silent logging | No visual alert |

---

## 🏗️ Architecture

DNS Sentinel is built with a modular architecture consisting of five core components:

```
┌─────────────────────────────────────────────────────────┐
│          Background Service Worker                       │
│  (Central coordinator & lifecycle management)            │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴──────────┐
    │                   │
┌───▼──────┐    ┌──────▼─────────────────────────────┐
│ Storage  │    │   Analysis Engine                   │
│  Layer   │◄───┤                                     │
│          │    │  ┌─────────────────────────────┐   │
│ • DS     │    │  │  Rate Calculator    (M_r)   │   │
│ • CF     │    │  │  Entropy Calculator (M_e)   │   │
│ • HL     │    │  │  Reputation Calc.   (M_rep) │   │
└──────────┘    │  │  Behavior Calculator(M_b)   │   │
                │  │  Risk Aggregator            │   │
                │  └─────────────────────────────┘   │
                └──────┬─────────────────────────────┘
                       │
            ┌──────────┴───────────┐
            │                      │
      ┌─────▼──────┐      ┌───────▼────────┐
      │   Alert    │      │  UI Components  │
      │   System   │      │                 │
      │            │      │  • Popup        │
      │ • Dispatch │      │  • Settings     │
      │ • Notify   │      │  • Notifications│
      └────────────┘      └─────────────────┘
```

**See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed component descriptions.**

---

## 🔧 Configuration

### User Settings

Access via extension popup → Settings:

- **Sensitivity Level**: Paranoid / Balanced / Passive
- **Alert Types**: Modal / Inline / Badge / Sound
- **Whitelists**: Trusted domains to skip analysis
- **Blacklists**: Additional known phishing domains
- **Data Retention**: History log duration (default: 90 days)

### Developer Configuration

Configuration is managed through the `ConfigurationStore` class. Default settings are defined in the storage layer.

---

## 📊 Performance

DNS Sentinel is optimized for minimal browser impact:

- **Processing Time**: 5-50ms per request
- **Memory Usage**: < 50MB for statistics storage
- **CPU Impact**: Negligible during normal browsing
- **Battery**: Minimal drain on laptops

### Benchmarks

Run performance benchmarks:

```bash
pnpm test --bench
```

Expected results:
- Average processing time: < 20ms
- 95th percentile: < 50ms
- Memory usage: < 50MB

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run with coverage
pnpm test --coverage

# Run benchmarks
pnpm test --bench
```

---

## 🛠️ Development

### Project Structure

```
dns-sentinel/
├── src/                          # Production source code
│   ├── background/               # Service worker & request interception
│   │   ├── index.ts             # Entry point
│   │   ├── aggregators/         # Risk aggregation logic
│   │   ├── analysis/            # Metric calculators (M1-M4)
│   │   ├── storage/             # Data persistence layer
│   │   └── utils/               # Shared utilities
│   ├── popup.html               # Extension popup UI
│   ├── popup.ts                 # Popup logic
│   ├── manifest.json            # Chrome extension manifest
│   ├── types/index.ts           # TypeScript type definitions
│   └── icons/                   # Extension icons
├── test/                         # Test suites
├── benchmark/                    # Performance benchmarks
├── docs/                         # Comprehensive documentation
├── package.json                  # Dependencies & scripts
├── vite.config.ts               # Vite build configuration
├── vitest.config.ts             # Test configuration
├── tsconfig.json                # TypeScript configuration
└── biome.json                   # Linter/formatter configuration
```

### Development Workflow

```bash
# Start development server with hot reload
pnpm dev

# Run linter
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

### Technology Stack

- **TypeScript** 5.6 - Type-safe development
- **Vite** 5 - Fast build tool with hot reload
- **Vitest** 2 - Modern testing framework
- **Biome** - Fast linter and formatter
- **Chrome Extension Manifest V3** - Latest extension API

---

## 📦 Deployment

### For Chrome Web Store

1. **Build production version:**
   ```bash
   pnpm build
   ```

2. **Create ZIP archive:**
   ```bash
   cd dist
   zip -r ../dns-sentinel-v1.0.0.zip .
   ```

3. **Chrome Web Store submission:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Create new item
   - Upload ZIP file
   - Fill in store listing (screenshots, description, etc.)
   - Submit for review

### For Manual Distribution

1. **Build:**
   ```bash
   pnpm build
   ```

2. **Share the `dist/` folder:**
   - Users load it via "Load unpacked" in developer mode
   - Or create a ZIP and distribute

### Pre-deployment Checklist

- [x] Fix all linting errors: `pnpm lint`
- [x] Apply code formatting: `pnpm format`
- [x] Run all tests: `pnpm test`
- [x] Verify build succeeds: `pnpm build`
- [x] Run benchmarks: `pnpm test --bench`
- [x] Update version in `src/manifest.json`
- [x] Test extension in Chrome (load unpacked from `dist/`)

---

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design
- **[docs/QUICK_START.md](docs/QUICK_START.md)** - Developer quick start guide
- **[docs/FILE_INDEX.md](docs/FILE_INDEX.md)** - Complete documentation index
- **[docs/01-concepts/](docs/01-concepts/)** - Conceptual model and metrics
- **[docs/02-mathematical-model/](docs/02-mathematical-model/)** - Formulas and proofs
- **[docs/03-architecture/](docs/03-architecture/)** - Component specifications
- **[docs/04-algorithms/](docs/04-algorithms/)** - Implementation algorithms
- **[docs/05-implementation/](docs/05-implementation/)** - Technical details
- **[docs/api/](docs/api/)** - API documentation

---

## 🤝 Contributing

We welcome contributions! Please open an issue or submit a pull request on GitHub.

### Areas for Contribution

- 🐛 Bug fixes and error handling improvements
- 📈 Performance optimizations
- 🎨 UI/UX enhancements
- 🧪 Additional test coverage
- 📚 Documentation improvements
- 🌐 Internationalization (i18n)

---


## 🙏 Acknowledgments

- **PhishTank** for maintaining open phishing intelligence
- **Google Safe Browsing** for threat detection APIs
- **OpenPhish** for additional threat feeds
- **Chrome Extensions Team** for excellent developer documentation

---

## 📈 Project Status

- **Version**: 1.0.0 (Development)
- **Chrome Web Store**: Coming soon
- **Browser Support**: Chrome 88+, Edge 88+
