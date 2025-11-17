# HistoryEvent — Common API
**Unified interface for events in History Log**

```ts
interface HistoryEvent {
  id: string; // evt_1698869832000_a1b2c3d4
  type: EventType; // → api/event-types.api.md
  timestamp: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss

  domain: string;
  tld: string;
  isIPAddress: boolean;
  isPunycode: boolean;

  context: RequestContext; // → api/request-context.api.md
  metrics: Metrics; // → api/metrics.api.md
  weights: Weights; // → api/weights.api.md
  risk: RiskAssessment; // → api/risk-assessment.api.md
  decision: Decision; // → api/decision.api.md

  userAction: UserAction | null;
  learning: LearningMetadata;
  performance: PerformanceMetrics;
  metadata: EventMetadata;
}
```
Used in: history-log.md, adaptive-calibration.md, ui-dashboard.md