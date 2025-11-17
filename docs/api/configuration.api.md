# Configuration — Common API

**Global system settings**

```ts
interface Configuration {
  enabled: boolean;
  sensitivity: 'strict' | 'balanced' | 'relaxed';
  privacy: {
    collectStatistics: boolean;
    allowTelemetry: boolean;
  };
  thresholds: {
    critical: number;   // 0.80
    high: number;       // 0.60
    medium: number;     // 0.40
  };
  weights: {
    M1: number;
    M2: number;
    M3: number;
    M4: number;
  };
  reputation: {
    sources: Array<{ name: string; enabled: boolean; weight: number }>;
    cacheTTL: number;   // hours
  };
  behavior: {
    minHistoryRequests: number;
    minHistoryDays: number;
  };
}
```

> Stored in `configuration-store`, hot reload