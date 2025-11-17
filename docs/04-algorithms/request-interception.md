# Request Interception — Algorithm

## Purpose
Извлечение домена и контекста из URL для анализа.

## Input
→ `url`, `initiator`, `resourceType`, `timestamp`

## Output
→ `domain`, `RequestContext`

## Steps (pseudocode)

```ts
function interceptRequest(details):
  url = details.url
  if not isDnsBound(url): return SKIP

  domain = extractSecondLevelDomain(url)
  if isExcluded(domain): return ALLOW

  context = {
    domain: domain,
    url: url,
    timestamp: details.timestamp,
    referrer: details.initiator,
    resourceType: details.type,
    userInitiated: isUserNavigation(details)
  }

  return ENQUEUE_ANALYSIS(context)
```


03-architecture/components/request-interceptor.md
api/request-context.api.md
main-workflow.md

## Complexity

O(1) — PSL is cached
## Constraints

Valid URL
PSL loaded

## Related documents
Only the algorithm. No chrome, no diagrams. See 03-architecture/ for threads.