let cleanupFns2 = [];
let cleanupFns3 = [];
let clearinterval = null;
/* =========================
 * async 初期化エントリポイント
 * ========================= */
InitManager.register("init", async ({videoId, videoEl}) => {
  try {
    console.log("[Kick Extension]watch history: init start", { videoId });
    if (!videoId) return;

    // クリーンアップ
    if (clearinterval) {
      clearInterval(clearinterval);
      clearinterval = null;
    }
    cleanupFns2.forEach(fn => {try { fn(); } catch (e) {}});
    cleanupFns2 = [];
    /*cleanupFns2.push(setupProgressSaving(videoEl, videoId));*/
    cleanupFns2.push(restartfromsavedpoint(videoEl, videoId));
    cleanupFns2.push(observeAndRenderProgress(videoId));
    console.log("[Kick Extension]watch history: init completed");
  } catch (e) {
    console.error("[Kick Extension] init failed:", e);
  }
});


InitManager.register("beforeunload", async ({videoId, videoEl}) => {
  try {
    console.log("[Kick Extension]watch history: beforeunload start", { videoId });
    if (!videoId) return;

    // クリーンアップ
    cleanupFns2.forEach(fn => {try { fn(); } catch (e) {}});
    cleanupFns2 = [];
    cleanupFns2.push(saveWatchProgress(videoEl, videoId));
    console.log("[Kick Extension]watch history: beforeunload completed");
  } catch (e) {
    console.error("[Kick Extension] init failed:", e);
  }
});

function restartfromsavedpoint(videoEl, videoId) {
  chrome.storage.local.get(['watchProgress'], data => {
    const store = data.watchProgress || {};
    const dataObj = store[videoId];
    if (dataObj && dataObj.currentTime) {
      console.log("[Kick Extension] resuming from saved point:", dataObj);
      videoEl.currentTime = dataObj.currentTime;
    }
  });
}

function saveWatchProgress(videoEl, videoId) {
  const currentTime = videoEl.currentTime;
  const duration = videoEl.duration;
  const percent = duration
    ? Math.min(1, currentTime / duration)
    : 0;
  console.log("[Kick Extension] saving watch progress:", {
    videoId,
    currentTime: currentTime,
    duration: duration,
    percent
  });
  chrome.storage.local.get(['watchProgress'], data => {
    const store = data.watchProgress || {};
    store[videoId] = {
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      percent,
      updatedAt: Date.now()
    };
    chrome.storage.local.set({ watchProgress: store });
    console.log("[Kick Extension] watch progress saved.", videoId, store[videoId]);
  });

}

function setupProgressSaving(videoEl, videoId) {
  clearinterval = setInterval(() => {
    saveWatchProgress(videoEl, videoId);
  }, 10000);
}


// Called on pages that contain lists of archive thumbnails. Scans links and decorates them.
async function renderProgressOnArchiveList(root = document) {
  try {
    // load mapping uuid->id
    const res = await fetch(
      "https://tourist1159.github.io/kick-comment-fetcher/kick_archives.json",
      { cache: "no-cache" }
    );
    if (!res.ok) throw new Error(res.status);

    const archives = await res.json();
    const uuidToId = new Map(archives.map(a => [a.uuid, a.id]));

    // collect anchors that point to /videos/<uuid>
    const anchors = Array.from(root.querySelectorAll('a[href*="/videos/"]'));
    if (!anchors.length) return;

    // load stored progress
    chrome.storage.local.get(['watchProgress'], (data) => {
      const store = data.watchProgress || {};
      anchors.forEach(a => {
        const uuid = window.getUuidFromUrl(a.href);
        if (!uuid) return;
        const id = uuidToId.get(uuid);
        if (!id) return;

        // find thumbnail container (try common patterns)
        let container = a.closest('div') || a.parentElement;
        if (!container) container = a; 

        // avoid duplicating
        if (container.querySelector('.ke-watch-progress')) return;

        const dataObj = store[id];
        const percent = dataObj ? (dataObj.percent || 0) : 0;

        const barWrap = document.createElement('div');
        barWrap.className = 'ke-watch-progress';
        barWrap.style.cssText = 'height:6px;background:rgba(255,255,255,0.12);border-radius:3px;overflow:hidden;margin-top:6px;position:relative;';
        const bar = document.createElement('div');
        bar.style.cssText = `height:100%;background:linear-gradient(90deg,#4caf50,#8bc34a);width:${Math.round(percent*100)}%;transition:width .3s ease;`;
        barWrap.appendChild(bar);

        // insert after thumbnail or as last child
        if (a.parentElement) a.parentElement.appendChild(barWrap);
        else container.appendChild(barWrap);
      });
    });
  } catch (e) {
    console.warn('renderProgressOnArchiveList error', e);
  }
}

function observeAndRenderProgress(videoId) {
  renderProgressOnArchiveList(document);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        // try to decorate newly added nodes
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          renderProgressOnArchiveList(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}