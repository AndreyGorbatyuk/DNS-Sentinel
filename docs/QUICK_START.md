# DNS Sentinel - Quick Start Guide

**Get up and running with DNS Sentinel development in under 10 minutes**

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ (for ES2022 support)
- **pnpm** 9+ (package manager)
- **Chrome Browser** 88+ (or Edge 88+)
- **Git**
- Code editor (VS Code recommended)

---

## 🚀 Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-repo/dns-sentinel.git
cd dns-sentinel
```

### Step 2: Install pnpm

```bash
# Install pnpm globally if not already installed
npm install -g pnpm@9

# Verify installation
pnpm --version  # Should be 9.x
```

### Step 3: Install Dependencies

```bash
pnpm install
```

This will install:
- Build tools (Vite, vite-plugin-web-extension)
- Testing framework (Vitest)
- Code quality tools (Biome)
- TypeScript 5.6
- Chrome Extension types

### Step 4: Build the Extension

```bash
# Development build with hot reload
pnpm dev

# Or production build
pnpm build
```

Build output will be in the `dist/` directory.

---

## 🔧 Load Extension in Chrome

### Method 1: Load Unpacked (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `dist/` directory from your project
5. DNS Sentinel icon should appear in the extensions toolbar

### Method 2: Production Build

```bash
# Build production version
pnpm build
```

The `dist/` folder contains the production-ready extension. You can create a ZIP file for distribution or Chrome Web Store submission.

---

## 🧪 Verify Installation

### Test 1: Basic Functionality

1. Click the DNS Sentinel icon in Chrome toolbar
2. You should see the popup dashboard with zero threats detected
3. Navigate to any website (e.g., google.com)
4. Check the dashboard - you should see the domain analyzed

### Test 2: Phishing Detection

The extension will automatically detect and block phishing domains. You can test by visiting known phishing domains (DO NOT enter any credentials).

### Test 3: Performance Check

```bash
# Run performance benchmarks
pnpm test --bench
```

Expected results:
- Average processing time: < 20ms
- 95th percentile: < 50ms
- Memory usage: < 50MB

---

## 🏗️ Project Structure

```
dns-sentinel/
│
├── src/                          # Production source code
│   ├── background/               # Service worker (main logic)
│   │   ├── index.ts             # Entry point - webRequest interceptor
│   │   ├── aggregators/         # Risk aggregation logic
│   │   ├── analysis/            # 4 metric calculators (M1-M4)
│   │   ├── storage/             # Configuration & domain statistics
│   │   └── utils/               # Pure utility functions
│   ├── popup.html               # Extension popup UI
│   ├── popup.ts                 # Popup logic (vanilla JS)
│   ├── manifest.json            # Chrome Extension Manifest V3
│   ├── types/index.ts           # Single source of truth for types
│   └── icons/                   # Extension icons (PNG: 16x16, 48x48, 128x128)
├── test/                         # Unit tests (flat structure)
├── benchmark/                    # Performance benchmarks
├── docs/                         # Comprehensive documentation
├── package.json                  # Dependencies & scripts
├── vite.config.ts               # Vite + web extension plugin
├── vitest.config.ts             # Test configuration
├── tsconfig.json                # TypeScript 5.6 config
└── biome.json                   # Linter/formatter config
```

---

## 💻 Development Workflow

### Watch Mode (Recommended)

```bash
pnpm dev
```

This starts Vite in watch mode:
- Auto-rebuilds on file changes
- Generates source maps for debugging
- Fast incremental compilation
- Hot reload support

**After making changes**:
1. Save your files
2. Vite automatically rebuilds
3. Go to `chrome://extensions/`
4. Click the **reload** icon on DNS Sentinel card
5. Test your changes

### Manual Build

```bash
# Production build (TypeScript check + Vite build)
pnpm build
```

---

## 🧪 Testing

### Run All Tests

```bash
pnpm test
```

### Run Specific Test Suites

```bash
# Run tests in watch mode
pnpm test --watch

# Performance benchmarks
pnpm test --bench

# Coverage report
pnpm test --coverage

# Run specific test file
pnpm test risk-aggregator
```

### Writing Tests

Example unit test for Rate Calculator:

```javascript
// tests/unit/analysis/rate-calculator.test.js
import RateCalculator from '@/analysis/rate-calculator';

describe('RateCalculator', () => {
  let calculator;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getDomainStats: jest.fn()
    };
    calculator = new RateCalculator(mockStorage);
  });

  test('should calculate low rate for infrequent requests', async () => {
    mockStorage.getDomainStats.mockResolvedValue({
      timestamps: [
        Date.now() - 120000, // 2 minutes ago
        Date.now() - 240000  // 4 minutes ago
      ]
    });

    const result = await calculator.calculate('example.com');
    
    expect(result.normalized).toBeLessThan(0.3);
  });

  test('should calculate high rate for frequent requests', async () => {
    // Simulate 100 requests in last minute
    const timestamps = Array.from({ length: 100 }, (_, i) => 
      Date.now() - (i * 600) // 0.6 seconds apart
    );

    mockStorage.getDomainStats.mockResolvedValue({ timestamps });

    const result = await calculator.calculate('suspicious.com');
    
    expect(result.normalized).toBeGreaterThan(0.8);
  });
});
```

---

## 🔍 Debugging

### Chrome DevTools

1. Right-click DNS Sentinel icon → **Inspect popup**
2. For background script: `chrome://extensions/` → **Inspect views: background page**

### Logging

Use the built-in logger:

```javascript
import logger from '@/utils/logger';

logger.debug('Detailed debug info', { domain, metrics });
logger.info('Processing request', { domain });
logger.warn('High processing time', { duration: 45 });
logger.error('API call failed', error);
```

View logs in:
- Background console: `chrome://extensions/` → Inspect views
- Popup console: Right-click popup → Inspect

### Enable Verbose Logging

Edit `src/config/default-config.js`:

```javascript
export const DEFAULT_CONFIG = {
  debug: {
    enabled: true,          // Enable debug logging
    verboseMetrics: true,   // Log all metric calculations
    performanceTracking: true // Log timing information
  }
};
```

---

## 🎨 Code Style & Linting

### Run Linter

```bash
# Check for issues
pnpm lint
```

### Format Code

```bash
# Format all files
pnpm format
```

Biome is used for both linting and formatting in this project.

---

## 🏃 Common Development Tasks

### 1. Add a New Metric Calculator

Create a new calculator in `src/analysis/`:

```javascript
// src/analysis/my-new-calculator.js
export default class MyNewCalculator {
  constructor(storage) {
    this.storage = storage;
  }

  async calculate(domain) {
    // Your metric calculation logic
    const value = /* ... */;
    const normalized = /* normalize to 0-1 */;

    return {
      value,
      normalized,
      metadata: { /* additional info */ }
    };
  }
}
```

Register in Analysis Engine:

```javascript
// src/analysis/analysis-engine.js
import MyNewCalculator from './my-new-calculator';

class AnalysisEngine {
  constructor() {
    this.calculators = {
      rate: new RateCalculator(this.storage),
      entropy: new EntropyCalculator(),
      reputation: new ReputationCalculator(),
      behavior: new BehaviorCalculator(this.storage),
      myNew: new MyNewCalculator(this.storage) // Add here
    };
  }
  
  async calculateMetrics(domain) {
    const metrics = await Promise.all([
      this.calculators.rate.calculate(domain),
      this.calculators.entropy.calculate(domain),
      this.calculators.reputation.calculate(domain),
      this.calculators.behavior.calculate(domain),
      this.calculators.myNew.calculate(domain) // Add here
    ]);
    
    return {
      rate: metrics[0],
      entropy: metrics[1],
      reputation: metrics[2],
      behavior: metrics[3],
      myNew: metrics[4] // Add here
    };
  }
}
```

Update Risk Aggregator to include new metric in weighted formula.

### 2. Add a New Alert Type

Create notification component:

```javascript
// src/alerts/notifications/my-alert.js
export async function showMyAlert(domain, risk) {
  // Implementation
}
```

Register in Notification Manager:

```javascript
// src/alerts/notification-manager.js
import { showMyAlert } from './notifications/my-alert';

class NotificationManager {
  async show(type, domain, risk) {
    switch (type) {
      case 'modal': return this.showModal(domain, risk);
      case 'inline': return this.showInlineWarning(domain, risk);
      case 'badge': return this.updateBadge(domain, risk);
      case 'myAlert': return showMyAlert(domain, risk); // Add here
    }
  }
}
```

### 3. Add API Integration

Create API wrapper:

```javascript
// src/api/new-api-service.js
export default class NewAPIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.example.com';
  }

  async checkDomain(domain) {
    try {
      const response = await fetch(`${this.baseUrl}/check/${domain}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      return null; // Graceful degradation
    }
  }
}
```

Integrate in Reputation Calculator:

```javascript
// src/analysis/reputation-calculator.js
import NewAPIService from '@/api/new-api-service';

class ReputationCalculator {
  constructor() {
    this.apis = {
      phishTank: new PhishTankAPI(),
      safeBrowsing: new GoogleSafeBrowsingAPI(),
      newApi: new NewAPIService(process.env.NEW_API_KEY) // Add here
    };
  }

  async checkBlacklists(domain) {
    const checks = await Promise.allSettled([
      this.apis.phishTank.check(domain),
      this.apis.safeBrowsing.check(domain),
      this.apis.newApi.checkDomain(domain) // Add here
    ]);
    
    // Process results...
  }
}
```

### 4. Modify UI

Edit popup HTML:

```html
<!-- src/ui/popup/popup.html -->
<div id="my-new-section">
  <h3>My New Feature</h3>
  <div id="my-content"></div>
</div>
```

Add logic:

```javascript
// src/ui/popup/popup.js
async function initializeMySection() {
  const data = await loadMyData();
  document.getElementById('my-content').innerHTML = renderMyContent(data);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeMySection();
});
```

Style it:

```css
/* src/ui/popup/popup.css */
#my-new-section {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}
```

---

## 📊 Performance Monitoring

### Built-in Performance Tracking

DNS Sentinel automatically tracks processing times:

```javascript
// View performance stats in popup
chrome.storage.local.get('performanceStats', (result) => {
  console.log('Average processing time:', result.performanceStats.avg);
  console.log('95th percentile:', result.performanceStats.p95);
  console.log('Max time:', result.performanceStats.max);
});
```

### Custom Performance Markers

```javascript
import { startTimer, endTimer } from '@/utils/performance';

async function mySlowFunction() {
  const timerId = startTimer('mySlowFunction');
  
  // Your code here
  await someAsyncOperation();
  
  const duration = endTimer(timerId);
  if (duration > 100) {
    logger.warn('Slow operation detected', { duration });
  }
}
```

---

## 🐛 Troubleshooting

### Extension Not Loading

**Issue**: Extension fails to load or shows errors

**Solutions**:
1. Check for syntax errors: `npm run lint`
2. Ensure all dependencies are installed: `npm install`
3. Clear build cache: `rm -rf dist/ && npm run build`
4. Check console for errors: `chrome://extensions/` → Inspect views

### API Calls Failing

**Issue**: External API calls return errors

**Solutions**:
1. Verify API keys are set in `.env`
2. Check API rate limits (PhishTank: 50/day free tier)
3. Test APIs directly: `npm run test:api`
4. Enable graceful degradation (extension works without external APIs)

### Performance Issues

**Issue**: Processing takes > 50ms consistently

**Solutions**:
1. Run performance profiler: `npm run test:perf`
2. Check for memory leaks: `chrome://extensions/` → Inspect → Memory tab
3. Optimize hot paths: Enable debug logging to identify bottlenecks
4. Reduce cache size in config if memory is constrained

### Storage Quota Exceeded

**Issue**: `QuotaExceededError` in console

**Solutions**:
1. Run storage cleanup: `npm run cleanup:storage`
2. Reduce history log retention period in settings
3. Check storage usage: `chrome.storage.local.getBytesInUse()`

---

## 📚 Additional Resources

### Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detailed system architecture
- **[.cursor/rules/project-rules.md](.cursor/rules/project-rules.md)** - Complete project specifications
- **[docs/](docs/)** - Comprehensive documentation library

### External References

- **Chrome Extensions**: https://developer.chrome.com/docs/extensions/
- **Manifest V3**: https://developer.chrome.com/docs/extensions/mv3/
- **PhishTank API**: https://www.phishtank.com/api_info.php
- **Google Safe Browsing**: https://developers.google.com/safe-browsing/v4

### Community

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas
- **Contributing Guide**: See CONTRIBUTING.md

---

## ✅ Next Steps

Now that you're set up, here's what to do next:

1. **Explore the codebase**: Start with `src/background/service-worker.js`
2. **Read the architecture**: Review [ARCHITECTURE.md](ARCHITECTURE.md)
3. **Run the tests**: Ensure everything works with `npm test`
4. **Make a change**: Try adding a console.log to see the data flow
5. **Check the docs**: Dive deeper into `docs/` for specific topics

---

## 🤝 Getting Help

Stuck? Here's how to get help:

1. **Search documentation**: Use search in `docs/`
2. **Check existing issues**: Someone may have encountered the same problem
3. **Ask in discussions**: Start a GitHub Discussion
4. **Enable debug logging**: Add detailed logs to understand what's happening

---

**Happy coding! 🚀**

---

**Document Version**: 1.0.0  
**Last Updated**: November 2025  
**Maintained By**: DNS Sentinel Development Team
