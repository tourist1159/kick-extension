/* content.js
   Danmaku rendering (DOM/GPU) + NG-word integration via chrome.storage.local
*/
(() => {
  // NG handling
  let ngList = [];
  let ngEnabled = true; // 全体ON/OFFスイッチ
  let logcomments = [];
  let ngRegexp = null;  
  
  let cleanupFns = [];
  
  function rebuildRegexp(){
    if(!ngList || ngList.length === 0){ ngRegexp = null; return; }
    // 有効なパターンだけ集める
    const enabledPatterns = ngList
      .filter(item => item.enabled)
      .map(item => item.pattern);

    try {
      ngRegexp = new RegExp(enabledPatterns.join("|"), "iu");
    } catch (e) {
      console.warn("NG正規表現の構築に失敗:", e);
      ngRegexp = null;
    }
  }

  chrome.storage.local.get(["ngList", "ngEnabled"], (data) => {
    ngList = data.ngList ?? [];
    ngEnabled = data.ngEnabled ?? true;
    rebuildRegexp();
  });

  // listen to changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.ngList) {
      ngList = changes.ngList.newValue ?? [];
      rebuildRegexp();
    }
  });

  function isNG(data){
    // 連投NG
    if(logcomments.find(logcomment => (logcomment.content.includes(data.content) || data.content.includes(logcomment.content)) && logcomment.id == data.id))  return true;
    if(!data || !ngRegexp) return false;
    return ngRegexp.test(data.content);
  }

  /* Danmaku core (DOM + Web Animations API) - adapted from prior version */
  const SPEED_PX_PER_SEC = 300;
  const MAX_LANES = 16;
  const LINE_HEIGHT_SCALE = 2.0;
  const FONT_FAMILY = 'sans-serif';
  const FONT_WEIGHT = 'bold';
  const OPACITY = 0.95;
  const TEXT_COLOR = '#fff';
  const OUTLINE = true;
  const OUTLINE_PX = 2;
  const GAP_PX = 32;

  const site = {
    getScreen: () => document.querySelector('#injected-embedded-channel-player-video > div'),
    getBoard: () => document.querySelector('#channel-chatroom'),
    isChatMutationTarget: (node) => node?.className === 'no-scrollbar relative',
    parseComment: (el) => {
      try {
        const dom = new DOMParser().parseFromString(el.innerHTML, 'text/html');
        const content = dom.querySelector('.font-normal')?.innerHTML?.trim(); // ← innerHTML
        const id = dom.querySelector('.inline')?.textContent?.trim();
        return content ? { content, id } : null;
      } catch(e) { return null; }
    }
  };

  let overlay = null;
  let W = 0, H = 0, fontPx = 16, laneHeight = 24;
  const lanes = Array.from({ length: MAX_LANES }, () => ({ lastStartTime: 0, lastWidth: 0, speed: SPEED_PX_PER_SEC }));

  function ensureOverlay(){
    if(overlay) return overlay;
    const screen = site.getScreen();
    if(!screen) return null;
    overlay = document.createElement('div');
    overlay.id = 'danmaku-overlay';
    overlay.style.cssText = `position:absolute; inset:0; pointer-events:none; z-index:99999; display:block; overflow:hidden; opacity:${OPACITY}; font-family:${FONT_FAMILY}; font-weight:${FONT_WEIGHT};`;
    if (!screen.style.position) screen.style.position = 'relative';
    screen.appendChild(overlay);
    injectStyle();
    recalcMetrics();
    window.addEventListener('resize', recalcMetrics);
    return overlay;
  }

  function injectStyle(){
    if(document.getElementById('danmaku-style')) return;
    const style = document.createElement('style');
    style.id = 'danmaku-style';
    style.textContent = `
      #danmaku-overlay .dm {
        position:absolute; top:0; left:0; white-space:nowrap; transform: translate3d(0,0,0); will-change: transform; color: ${TEXT_COLOR}; user-select:none;
      }
      #danmaku-overlay .dm.hide { display:none; }
      @media (prefers-reduced-motion: reduce) {
        #danmaku-overlay .dm { animation: none !important; transition:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function recalcMetrics(){
    if(!overlay) return;
    W = overlay.clientWidth;
    H = overlay.clientHeight;
    fontPx = Math.max(12, Math.floor((H / MAX_LANES) / LINE_HEIGHT_SCALE));
    laneHeight = Math.ceil(fontPx * LINE_HEIGHT_SCALE);
  }

  function pickLane(itemWidth){
    const now = performance.now();
    for(let i=0;i<MAX_LANES;i++){
      const lane = lanes[i];
      const elapsed = Math.max(0, now - lane.lastStartTime);
      const moved = (elapsed / 1000) * lane.speed;
      const leaderRight = (W + lane.lastWidth) - moved;
      if (lane.lastStartTime === 0 || leaderRight < (W - GAP_PX)) {
        lanes[i].lastStartTime = now;
        lanes[i].lastWidth = itemWidth;
        return i;
      }
    }
    // fallback: choose lane with minimum leaderRight
    let best = 0, min = Infinity, now2 = performance.now();
    for(let i=0;i<MAX_LANES;i++){
      const lane = lanes[i];
      const moved = ((now2 - lane.lastStartTime) / 1000) * lane.speed;
      const leaderRight = (W + lane.lastWidth) - moved;
      if(leaderRight < min){ min = leaderRight; best = i; }
    }
    lanes[best].lastStartTime = now2;
    lanes[best].lastWidth = itemWidth;
    return best;
  }

  function spawnComment(data){
    if(!data) return;
    if(isNG(data)) {
      //console.log("Blocked NG comment:", data.content);
      return;
    }
    ensureOverlay();
    if(!overlay) return;
    const el = document.createElement('div');
    el.className = 'dm';
    el.innerHTML = data.content;     // ← HTMLをそのまま挿入（絵文字<img>も反映）

    // apply styles
    el.style.fontSize = fontPx + 'px';
    el.style.lineHeight = laneHeight + 'px';
    if (OUTLINE) {
      el.style.textShadow = `-${OUTLINE_PX}px 0 0 #000, ${OUTLINE_PX}px 0 0 #000, 0 -${OUTLINE_PX}px 0 #000, 0 ${OUTLINE_PX}px 0 #000`;
    }
    overlay.appendChild(el);
    // measure width (force layout)
    const itemWidth = Math.max(1, el.clientWidth || Math.ceil(window.getComputedStyle(el).width.replace('px','')||0));
    const laneIndex = pickLane(itemWidth);
    const top = laneIndex * laneHeight;
    el.style.top = top + 'px';
    el.style.left = W + 'px';
    // compute animation
    const totalDistance = W + itemWidth;
    const durationMs = (totalDistance / SPEED_PX_PER_SEC) * 1000;
    // animate via Web Animations API (GPU)
    const anim = el.animate(
      [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-totalDistance}px,0,0)` }],
      { duration: durationMs, iterations: 1, easing: 'linear', fill: 'forwards' }
    );
    anim.onfinish = () => { el.remove(); };
  }

  // MutationObserver to detect chat messages
  function startObserver(){
    const board = site.getBoard();
    if(!board) return;
    const mo = new MutationObserver((records) => {
      if(!overlay) ensureOverlay();
      recalcMetrics();
      for(const rec of records){
        if(!site.isChatMutationTarget(rec.target)) continue;
        rec.addedNodes?.forEach((node) => {
          const data = site.parseComment(node);
          if(!data) return;
          spawnComment(data);
          logcomments.push(data);
          if(logcomments.length>50) logcomments.shift();
        });
      }
    });
    mo.observe(board, { subtree: true, childList: true });
  }

  InitManager.register("init_archive", () => {
    console.log("[Kick Extension] InitManager triggered danmaku init");
    // cleanup previous
    cleanupFns.forEach(fn => {try { fn(); } catch (e) {}});
    cleanupFns = [];
    // start observer
    startObserver();
  });

  InitManager.register("init_live", () => {
  console.log("[Kick Extension] InitManager triggered danmaku init");
  // cleanup previous
  cleanupFns.forEach(fn => {try { fn(); } catch (e) {}});
  cleanupFns = [];
  // start observer
  startObserver();
  });

})();