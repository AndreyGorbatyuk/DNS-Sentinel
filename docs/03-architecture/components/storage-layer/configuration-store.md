# Configuration Store — Architecture

## Purpose
Central repository for system settings, user preferences, and adaptive parameters. Provides single source of truth for weights, thresholds, whitelists, and learning configs. Enables dynamic updates via user feedback.

## Responsibilities
- Load/store configuration (persistent)
- Validate constraints (weights sum=1, bounds)
- Apply sensitivity profiles (strict/balanced/relaxed)
- Handle migrations (schema versions)
- Process adaptive updates (feedback → weights)
- Sync across devices (optional)

## Dependencies
- **APIs**: `chrome.storage.local/sync`
- **Components**: `background-service-worker.md` (init), `risk-aggregator.md` (weights), `request-interceptor.md` (lists), `ui-components/settings-panel.md` (changes), `alert-system/` (notifications)
- **Config**: `api/configuration.api.md` (schema), `api/user-feedback.api.md` (input)

## Triggers & Events
| Event | Source | Action |
|-------|--------|--------|
| **onStartup/onInstalled** | Browser | Load/init config |
| **onUserUpdate** | Settings UI | Validate & save |
| **onFeedback** | UI/Alert | Adaptive calibration |
| **onSyncChange** | Storage.sync | Merge remote prefs |
| **onMigrationNeeded** | Version check | Apply schema updates |

## Architecture Flow

```
Browser Startup →
  Load Config (local/sync) →
  Validate Schema →
  { Valid? } → Register Listeners
  { Invalid? } → Migrate + Save →
  Enter Idle State

User Feedback →
  Process Feedback →
  Update Weights (Formula 15-16) →
  Normalize Constraints →
  Save + Notify Components
```

## Latency Targets
- Load: ≤ 10 ms
- Update: ≤ 5 ms
- Migration: ≤ 50 ms
- Cache hit: ≤ 0.5 ms

## Implementation Considerations
- **Manifest V3**: Event-driven storage
- **Cross-Device**: Sync preferences only (no PII)
- **Validation**: Runtime checks for integrity
- **Caching**: L1 (memory, TTL=1m), L2 (storage)

## Related Documentation
- `overview.md` — Storage Layer overview
- `data-flow.md` — Request lifecycle
- `component-interactions.md` — Event contracts
- `api/configuration.api.md` — Schema details
- `specs/configuration.spec.md` — Requirements (если существует)
- `examples/analysis-engine.examples.md` — Usage
- `02-mathematical-model/adaptive-calibration.md` — Formulas 15-16
- `ROADMAP.md` — Future ML enhancements

---

*This file contains **only architectural overview**. No code. See api/ for schemas.*
