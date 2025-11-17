# NotificationCommand — Common API
**Command from Alert Dispatcher to Notification Manager**

```ts
interface NotificationCommand {
  type: NotificationType;
  priority: "IMMEDIATE" | "HIGH" | "LOW";
  data: {
    title?: string;
    message: string;
    domain: string;
    riskScore: number;
    explanation: string;
    actions?: UserActionType[]; // → api/user-action-type.api.md
  };
  options?: {
    timeout?: number;
    dismissible?: boolean;
    silent?: boolean;
    imageUrl?: string;
  };
}

type NotificationType =
  | "BROWSER_NOTIFICATION"
  | "INLINE_WARNING"
  | "INFO_BANNER"
  | "MODAL_WARNING"
  | "AUDIO_ALERT"
  | "VIBRATION"
  | "BADGE_UPDATE"
  | "BATCH_SUMMARY";
```
Used in: alert-dispatcher.md, notification-manager.md