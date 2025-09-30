// Background service worker for MV3
self.addEventListener('install', () => {
  console.log('Minimal MV3 Extension: service worker installed');
});

self.addEventListener('activate', () => {
  console.log('Minimal MV3 Extension: service worker activated');
});

// Example listener to show background is alive
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PING') {
    console.log('Background received PING from', sender.tab ? `tab ${sender.tab.id}` : 'unknown');
    sendResponse({ type: 'PONG' });
  }
  // Return true only if you intend to send an async response
  return false;
});


