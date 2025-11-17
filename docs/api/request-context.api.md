# Request Context — Common API

**A single entry point for all metric calculators**

```ts
interface RequestContext {
  timestamp: number;                // Unix ms
  url: string;                      // Full URL
  referrer?: string | null;         // Previous page
  userAgent: string;                // UA browser
  hour: number;                     // 0–23 (calculated from timestamp)
  dayOfWeek: number;                // 0–6 (Mon=0, Sun=6)
  requestType?: 'navigation' | 'api' | 'resource';  // Опционально
}
```
Used in rate.api.md, behavior.api.md, entropy.api.md, reputation.api.md