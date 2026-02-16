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

    function islive(videoEl) {
        return videoEl.duration === Infinity;
    }

    async function resolveVideoId() { 
    try {
        console.log("[Kick Extension] resolving video ID from URL...");
        const uuid = getUuidFromUrl(location.href);
        if (!uuid) {
            console.warn("[Kick Extension] could not find UUID in URL");
            return null;
        }
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

    async function waitForVideoElement() {

        return new Promise(resolve => {
            const existing = document.querySelector("video");
            if (existing) return resolve(existing);

            const observer = new MutationObserver(() => {
            if (document.querySelector("main[data-theatre-mode-container]").textContent.includes("オフラインです")) {
                console.log("[Kick Extension] Video is offline"); 
                observer.disconnect();
                resolve(null);
            }
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
    const videoEl = await waitForVideoElement();
    console.log("[Kick Extension] waitForVideoElement resolved:", videoEl);
    if (!videoEl) { await InitManager.run("init_toppage"); return; }
    window.AppState.videoEl = videoEl;
    if (islive(videoEl)) {
        console.log("[Kick Extension] detected live stream");
        await InitManager.run("init_live");
    } else {
        console.log("[Kick Extension] detected archive video");
        const videoId = await resolveVideoId();
        window.AppState.videoId = videoId;
        await InitManager.run("init_archive", { videoId, videoEl })
    };
    }

    async function reInit() {
    const prevideoId = window.AppState.videoId;
    const prevideoEl = window.AppState.videoEl;
    
    await InitManager.run("beforeunload", {
        videoId: prevideoId,
        videoEl: prevideoEl
    });
    const videoEl = await waitForVideoElement();
    if (!videoEl) { await InitManager.run("init_toppage"); return; }
    window.AppState.videoEl = videoEl;
    if (islive(videoEl)) {
        console.log("[Kick Extension] detected live stream");
        await InitManager.run("init_live");
    } else {
        console.log("[Kick Extension] detected archive video");
        const videoId = await resolveVideoId();
        window.AppState.videoId = videoId;
        await InitManager.run("init_archive", { videoId, videoEl })
    };
    }

    // 初回
    runInit();
    

    // SPA遷移対応
    observeUrlChange(async () => {
    console.log("[InitManager] URL changed → re-init");
    await reInit();
    });
})();
