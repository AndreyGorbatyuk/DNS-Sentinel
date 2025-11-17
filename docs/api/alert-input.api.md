# AlertInput — Common API
**Input for Alert Dispatcher (derived from RiskAssessment + context)**

```ts
interface AlertInput {
  domain: string;
  timestamp: number;
  assessment: RiskAssessment; // → api/risk-assessment.api.md
  context: {
    referrer: string | null;
    resourceType: string;
    initiator: string;
  };
}
```
Used in: alert-dispatcher.md, notification-manager.md