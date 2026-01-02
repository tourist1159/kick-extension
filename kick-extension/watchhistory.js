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
    const archiveinfo = new Map(archives.map(a => [a.uuid, {id:a.id, num_comments:a.number_of_comments, duration:a.duration}]));

    // collect anchors that point to /videos/<uuid>
    const anchors = Array.from(root.querySelectorAll('a[href*="/videos/"]'));
    if (!anchors.length) return;

    // load stored progress
    chrome.storage.local.get(['watchProgress'], (data) => {
      const store = data.watchProgress || {};
      anchors.forEach(a => {
        const uuid = window.getUuidFromUrl(a.href);
        if (!uuid) return;
        const id = archiveinfo.get(uuid)['id'];
        if (!id) return;

        // only add bar to anchors containing images (thumbnails)
        if (!a.querySelector('img')) return;

        // find thumbnail container (try common patterns)
        let container = a;

        // avoid duplicating
        if (container.querySelector('.ke-watch-progress')) return;

        const dataObj = store[id];
        const percent = dataObj ? (dataObj.percent || 0) : 0;

        const barWrap = document.createElement('div');
        barWrap.className = 'ke-watch-progress';
        barWrap.style.cssText = 'height:6px;background:rgba(255,255,255,0.12);border-radius:3px;overflow:hidden;position:absolute;bottom:0;left:0;right:0;';
        const bar = document.createElement('div');
        bar.style.cssText = `height:100%;background:linear-gradient(90deg,#4caf50,#8bc34a);width:${Math.round(percent*100)}%;transition:width .3s ease;`;
        barWrap.appendChild(bar);

        // ensure container has relative positioning
        if (getComputedStyle(container).position === 'static') {
          container.style.position = 'relative';
        }

        // insert after thumbnail or as last child
        container.appendChild(barWrap);

        const numComments = archiveinfo.get(uuid)['num_comments'];
        const duration = archiveinfo.get(uuid)['duration'];
        const commentvelocity = duration && numComments ? Math.round(numComments / (duration / 3600000)) : 0;
        if (commentvelocity) {
          const commentBadge = document.createElement('div');
          commentBadge.className = 'ke-comment-badge';
          commentBadge.textContent = `${commentvelocity} cph`;
          commentBadge.style.cssText = 'position:absolute;top:6px;right:6px;padding:2px 6px;background:rgba(0, 0, 0, 0.8);color:#fff;font-size:12px;border-radius:4px;';
          container.appendChild(commentBadge);
        }
        // modify timeago text details
        adddateinfo(a.parentElement);
      });
      const mainEl = document.querySelector("main[data-theatre-mode-container]");
      adddateinfo(mainEl, "UTC");
    });
  } catch (e) {
    console.warn('renderProgressOnArchiveList error', e);
  }
}

function adddateinfo(el, TZ="") {
  const elements = el.querySelectorAll("span[title]");
  let Reg = /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/
  elements.forEach(el => {
    if (Reg.test(el.getAttribute("title"))) {
      const timeago = el.textContent;
      if (!Reg.test(timeago)) {
      let date = el.getAttribute("title");
        if (TZ === "UTC") {
          let dt = new Date(date+"Z");
          dt.setHours( dt.getHours());
          let yyyy = dt.getFullYear();
          let mm = ('0' + (dt.getMonth() + 1)).slice(-2);
          let dd = ('0' + dt.getDate()).slice(-2);
          let hh = ('0' + dt.getHours()).slice(-2);
          let min = ('0' + dt.getMinutes()).slice(-2);
          date = `${yyyy}/${mm}/${dd} ${hh}:${min}`;
        }
      el.textContent = timeago+" ("+date+")"
      };
      return true;
    }
  });
  return null;
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