document.addEventListener('DOMContentLoaded', () => {
  console.log('Minimal MV3 Extension: popup loaded');
  // Optional: ping background
  chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Background not reachable:', chrome.runtime.lastError.message);
      return;
    }
    console.log('Received from background:', response);
  });
});


