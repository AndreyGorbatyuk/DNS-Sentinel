# User Feedback — Common API

**User feedback format**

```ts
interface UserFeedback {
  domain: string;
  timestamp: number;
  decision: 'allow' | 'block' | 'dismiss';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  userComment?: string;
  systemScore: number;
  overridden: boolean;
}