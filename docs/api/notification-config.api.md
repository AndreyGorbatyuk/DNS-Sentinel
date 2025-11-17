# NotificationConfig — Common API
**User and system settings for notifications**

```ts
interface NotificationConfig {
  notifications: {
    browserNotifications: boolean;
    inlineWarnings: boolean;
    badgeIndicator: boolean;
    audioAlerts: boolean;
    vibrationFeedback: boolean;
  };
  consolidation: {
    enabled: boolean;
    windowMs: number;
  };
  accessibility: {
    screenReaderAnnouncements: boolean;
    highContrastMode: boolean;
    reducedMotion: boolean;
  };
}
```
Used in: notification-manager.md, configuration-store.md