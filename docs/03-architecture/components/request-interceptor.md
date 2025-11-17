# Request Interceptor — Architecture

## Purpose
Entry point for detection: Captures network requests at browser level, extracts domain info, performs preliminary filtering, and triggers analysis workflow (non-blocking, <2 ms per request).

## Responsibilities
- Register webRequest listeners for HTTP/HTTPS/DNS
- Extract domain, context from requests
- Apply exclusions (internal/extension URLs)
- Check whitelist/blacklist cache
- Forward to Analysis Engine
- Handle blocking decisions for critical risks

## Dependencies
- **APIs**: `chrome.webRequest` (onBeforeRequest, blocking)
- **Components**: `background-service-worker.md` (orchestration), `storage-layer/` (whitelist/cache), `analysis-engine/` (metrics trigger), `alert-system/` (blocking alerts)
- **Config**: `api/configuration.api.md` (scope, exclusions)

## Interception Scope

| Type | Included | Rationale |
|------|----------|---------|
| main_frame | Yes | Top navigation |
| sub_frame | Yes | Iframes |
| xmlhttprequest | Yes | AJAX |
| fetch | Yes | Modern requests |
| websocket | Partial | Connections only |

## Exclusions

| Pattern | Reason |
|---------|--------|
| chrome://, about:// | Internal |
| chrome-extension:// | Extension |
| localhost, 127.0.0.1 | Local dev |

## Architecture Flow

```
webRequest.onBeforeRequest →
  Extract Context (domain, url, referrer) →
  Check Cache/Whitelist →
  { Safe? } → Allow
  { Suspicious? } → Trigger Analysis Engine →
  { Block? } → Cancel Request
```

## Latency Targets
- Interception: ≤ 1 ms
- Filtering: ≤ 0.5 ms
- Total overhead: ≤ 2 ms per request

## Implementation Considerations
- **Manifest V3**: Event-driven, no persistent page
- **Cross-Browser**: Polyfills for Firefox/Edge/Safari
- **Fail-Open**: On error → allow request

## Related Documentation
- `overview.md` — System architecture
- `data-flow.md` — Request lifecycle
- `component-interactions.md` — Event contracts
- `api/request-interceptor.api.md` — Method signatures (если существует)
- `examples/analysis-engine.examples.md` — Scenarios
- `ROADMAP.md` — Future ML integration

---

*This file contains **only architectural overview**. No code. See api/ for contracts.*