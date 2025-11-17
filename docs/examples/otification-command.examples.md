# Example: Critical Browser Notification

```json
{
  "type": "BROWSER_NOTIFICATION",
  "priority": "IMMEDIATE",
  "data": {
    "title": "⛔ Critical Threat Detected",
    "message": "Suspicious domain: evil.com",
    "domain": "evil.com",
    "riskScore": 0.95,
    "explanation": "High risk score due to reputation and behavior metrics"
  },
  "options": {
    "requireInteraction": true,
    "silent": false
  }
}
```
# Example: Inline Warning
```json
{
  "type": "INLINE_WARNING",
  "priority": "HIGH",
  "data": {
    "domain": "suspicious-site.com",
    "riskScore": 0.78,
    "explanation": "Medium-high risk: unusual request patterns detected"
  },
  "options": {
    "dismissible": true,
    "timeout": 10000
  }
}
```