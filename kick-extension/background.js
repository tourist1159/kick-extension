chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetchJson") {
    fetch(message.url)
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.toString() }));
    return true; // 非同期応答
  }
});
