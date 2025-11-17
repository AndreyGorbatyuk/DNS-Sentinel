# AlertConfig — Common API
**Alert Dispatcher Settings**
```ts
interface AlertConfig {
  operationMode: "paranoid" | "balanced" | "passive";
  autoBlockingEnabled: boolean;
  riskThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  notificationPreferences: {
    showMediumThreats: boolean;
    audioAlerts: boolean;
    batchingEnabled: boolean;
    batchInterval: number;
  };
  advancedOptions: {
    sessionWhitelistEnabled: boolean;
    adaptiveLearningEnabled: boolean;
    telemetryEnabled: boolean;
  };
}
```
Used in: alert-dispatcher.md, configuration-store.md