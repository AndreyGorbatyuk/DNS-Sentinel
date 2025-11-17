# Background Service Worker — Architecture

## Purpose
Central orchestration component: Persistent background process that coordinates system activities, manages component lifecycle, handles communication, and monitors DNS traffic without performance impact (Manifest V3 service worker).

## Responsibilities
- System initialization (config loading, storage setup, component registration, external integrations)
- Event orchestration (request handling, analysis triggering, alert dispatching)
- Resource management (latency monitoring, cache control, quota enforcement)
- User interaction support (feedback processing, config changes)
- Update handling (data migration, integrity checks)

## Dependencies
- **APIs**: `chrome.webRequest`, `chrome.storage.local`, `chrome.notifications`
- **Components**: `request-interceptor.md` (interception), `storage-layer/` (data), `analysis-engine/` (metrics), `alert-system/` (notifications), UI (popup/settings)
- **Config**: `api/configuration.api.md` (thresholds, weights)

## Triggers & Events

| Event | Source | Action |
|-------|--------|--------|
| **onInstalled / onStartup** | Browser | Initialize config, storage, components |
| **onBeforeRequest** | webRequest | Trigger interceptor → analysis pipeline |
| **onUserFeedback** | UI | Process via calibration (async weight update) |
| **onConfigChange** | Settings UI | Hot-reload calculators and thresholds |
| **onStorageQuota** | Storage Layer | Evict old data (LRU) |

## Architecture Flow

```
Browser Startup →
  Load Configuration →
  Register webRequest Handlers →
  Initialize Storage (DS, CF, HL) →
  Setup Analysis Engine →
  Configure Alert System →
  Enter Event Loop
```

## Latency Targets
- Initialization: ≤ 100 ms
- Event handling: ≤ 5 ms
- Background idle: 0 CPU when dormant

## Implementation Considerations
- **Manifest V3**: Event-driven, no persistent page
- **Cross-Browser**: Polyfills for Firefox/Edge
- **Migration**: Versioned data schemas

## Related Documentation
- `overview.md` — System architecture
- `data-flow.md` — Request lifecycle
- `component-interactions.md` — Event contracts
- `api/background-service-worker.api.md` — Method signatures (если существует)
- `examples/analysis-engine.examples.md` — Scenarios
- `ROADMAP.md` — Future ML integration

---

*This file contains **only architectural overview**. No code. See api/ for contracts.*