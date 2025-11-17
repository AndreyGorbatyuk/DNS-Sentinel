# Domain Profile — Common API

**Single domain profile for all calculators**

```ts
interface DomainProfile {
  domain: string;
  firstSeen: number;
  lastSeen: number;
  requestCount: number;
  historyDays: number;

  // Rate
  timeSeries: Array<{ timestamp: number; count: number }>;
  avgRate: number;
  stdDevRate: number;

  // Behavior
  accessHours: number[];            // [0–23]
  dayFrequencies: number[];         // [0–6]
  typicalReferrers: Array<{ domain: string; count: number }>;
  directAccessToSensitive: boolean;

  // Reputation
  lastReputationCheck?: number;
  reputationCache?: {
    source: string;
    score: number;
    timestamp: number;
  }[];

  // Metadata
  userWhitelisted?: boolean;
  userBlacklisted?: boolean;
}
```

> Stored in `chrome.storage.local`, uses `rate`, `behavior`, `reputation`