(async () => {

    // ---------- SPA URL 監視 ----------
    function observeUrlChange(onChange) {
    let lastUrl = location.href;
    const mo = new MutationObserver(() => {
        if (location.href !== lastUrl) {
        lastUrl = location.href;
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

    async function runInit() {
    const videoId = await resolveVideoId();
    await InitManager.run("init", { videoId });
    }

    // 初回
    runInit();

    // SPA遷移対応
    observeUrlChange(async () => {
    console.log("[InitManager] URL changed → re-init");
    await runInit();
    });
})();
