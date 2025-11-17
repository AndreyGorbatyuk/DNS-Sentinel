# Example: THREAT_DETECTED Event

```json
{
"id": "evt_1698869832000_a1b2c3d4",
"type": "THREAT_DETECTED",
"timestamp": 1698869832000,
"domain": "suspicious-site.com",
"risk": { "score": 0.78, "level": "HIGH" },
"userAction": null
}
```

# Example: Event with User Action

```json
{
"id": "evt_1698869832000_a1b2c3d4",
"type": "THREAT_DETECTED",
"userAction": {
	"type": "FALSE_POSITIVE",
	"timestamp": 1698869835000,
	"responseTime": 3000
	}
}
```