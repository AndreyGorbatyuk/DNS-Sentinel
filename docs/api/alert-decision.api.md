# AlertDecision — Common API
**Alert Dispatcher Solution**
```ts
interface AlertDecision {
  action: "BLOCK" | "WARN" | "ALLOW" | "LOG";
  blockingAction: "BLOCK_IMMEDIATE" | "WARN_NO_BLOCK" | "NONE";
  notifications: NotificationCommand[];
  explanation: string;
  userActions: UserActionType[];
  priority: "P0" | "P1" | "P2" | "P3";
  reason?: string;
}

interface NotificationCommand {
  type: NotificationType;
  priority: "IMMEDIATE" | "HIGH" | "LOW";
  data?: any;
  options?: any;
}

type NotificationType =
  | "MODAL_WARNING"
  | "INLINE_WARNING"
  | "INFO_BANNER"
  | "BROWSER_NOTIFICATION"
  | "AUDIO_ALERT"
  | "BADGE_UPDATE"
  | "BATCH_SUMMARY";

type UserActionType =
  | "PROCEED_ANYWAY"
  | "GO_BACK"
  | "ADD_TO_WHITELIST"
  | "ADD_TO_BLACKLIST"
  | "REPORT_FALSE_POSITIVE"
  | "DISMISS"
  | "VIEW_DETAILS";
	Used in: alert-dispatcher.md, notification-manager.md