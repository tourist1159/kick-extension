(async () => {

    // ---------- SPA URL 監視 ----------
    function observeUrlChange(onChange) {
    let lastUrl = location.href;
    let title = document.querySelector('span[data-testid="livestream-title"]');
    const mo = new MutationObserver(() => {

        if (location.href !== lastUrl) {
        lastUrl = location.href;
        title = document.querySelector('span[data-testid="livestream-title"]');
        onChange();
        }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    }

    window.getUuidFromUrl = function (url) {
    const m = String(url).match(/videos\/([\w-]+)/);
    return m ? m[1] : null;
    }

    async function resolveVideoId() { 
    try {
        console.log("[Kick Extension] resolving video ID from URL...");
        const uuid = getUuidFromUrl(location.href);
        if (!uuid) return null;
        const res = await fetch("https://tourist1159.github.io/kick-comment-fetcher/kick_archives.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(res.status);

        const archives = await res.json();
        const found = archives.find(v => v.uuid === uuid);
        return found ? found.id : null;

    } catch (e) {
        console.error("[Kick Extension] resoleVideoId error:", e);
        return null;
    }
    }

    function waitForVideoElement() {
        return new Promise(resolve => {
            const existing = document.querySelector("video");
            if (existing) return resolve(existing);

            const observer = new MutationObserver(() => {
            const video = document.querySelector("video");
            if (video) {
                observer.disconnect();
                resolve(video);
            }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    async function runInit() {
    const videoId = await resolveVideoId();
    const videoEl = await waitForVideoElement();
    window.AppState.videoId = videoId;
    window.AppState.videoEl = videoEl;
    console.log("[Kick Extension] running init with", { videoId, videoEl });
    await InitManager.run("init", { videoId, videoEl });
    }

    async function reInit() {
    const prevideoId = window.AppState.videoId;
    const prevideoEl = window.AppState.videoEl;
    
    await InitManager.run("beforeunload", {
        videoId: prevideoId,
        videoEl: prevideoEl
    });
    const videoId = await resolveVideoId();
    const videoEl = await waitForVideoElement();
    window.AppState.videoId = videoId;
    window.AppState.videoEl = videoEl;
    console.log("[Kick Extension] running re-init with", { videoId, videoEl });
    await InitManager.run("init", { videoId, videoEl });
    }

    // 初回
    runInit();

    window.addEventListener("pagehide", async () => {
    await InitManager.run("beforeunload", {
        videoId: window.AppState.videoId,
        videoEl: window.AppState.videoEl
    });
    console.log("[Kick Extension] watch history: pagehide completed");
    });

    // SPA遷移対応
    observeUrlChange(async () => {
    console.log("[InitManager] URL changed → re-init");
    await reInit();
    });
})();
