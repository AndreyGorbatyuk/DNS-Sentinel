# Example: CRITICAL threat

```json
{
  "action": "BLOCK",
  "blockingAction": "BLOCK_IMMEDIATE",
  "notifications": [
    { "type": "MODAL_WARNING", "priority": "IMMEDIATE" },
    { "type": "BROWSER_NOTIFICATION", "priority": "HIGH" }
  ],
  "explanation": "⛔ CRITICAL THREAT DETECTED\nDomain: evil.com\n...",
  "userActions": ["PROCEED_ANYWAY", "GO_BACK", "ADD_TO_WHITELIST"],
  "priority": "P0"
}
```