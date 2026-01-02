console.log("[Kick Extension] content_script.js loaded");

let cleanupFns = [];
/* =========================
 * async 初期化エントリポイント
 * ========================= */
InitManager.register("init_archive", async ({videoId, videoEl}) => {
  try {
    console.log("[Kick Extension]commentchart: init start", { videoId });
    if (!videoId) return;

    // クリーンアップ
    cleanupFns.forEach(fn => {try { fn(); } catch (e) {}});
    cleanupFns = [];
    cleanupFns.push(await renderCommentChart(videoEl, videoId));
    console.log("[Kick Extension] init completed");
  } catch (e) {
    console.error("[Kick Extension] init failed:", e);
  }
});


async function loadCommentData(videoId) {
  const PAGES_BASE = "https://tourist1159.github.io/kick-comment-fetcher/comments_github/";
  const commentsUrl = `${PAGES_BASE}${videoId}_comments.json`;
  const res = await fetch(commentsUrl);
  if (res.ok) {
    const data= await res.json();
    const comments = data.comments || [];
    const start_time = data.start_time || null;
    if (comments.length) {
      console.log("[Kick Extension] found comments data in remote JSON:", commentsUrl);
      return { comments, start_time };
    }
    else {
      console.log("[Kick Extension] No comments data found in remote JSON:", commentsUrl);
      return { comments: null, start_time: null };
    }
  } else {
    console.warn("[Kick Extension] couldn't fetch remote comments JSON: HTTP " + res.status);
    // ローカルサーバーからの取得を試みる
    const Local_Comments_Url = `http://localhost:8000/comments_local/${videoId}_comments.json`;
    console.log("[Kick Extension] No comments data found in remote JSON, trying local:", Local_Comments_Url);
    const localRes = await fetch(Local_Comments_Url);
    if (!localRes.ok) {
      throw new Error("[Kick Extension] couldn't fetch local comments JSON: HTTP " + localRes.status);
    }
    const localData = await localRes.json();
    const localComments = localData.comments || [];
    if (localComments.length) {
      console.log("[Kick Extension] found comments data in local JSON:", Local_Comments_Url);
      return { comments: localComments, start_time: localData.start_time || null };
    } else {
      console.warn("[Kick Extension] No comments data found in local JSON either.");
      return null;
    }
  }
}


async function renderCommentChart(videoEl, videoId) {
  if (document.getElementById("kick-comments-chart-container")) return;

  const { comments, start_time } = await loadCommentData(videoId);
  if (!comments || !comments.length) {
    console.warn("[Kick Extension] no comments");
    return;
  }

  console.log("[Kick Extension] comments loaded:", comments.length);

  // グラフ表示用のコンテナ
  const container = document.createElement("div");
  container.id = "kick-comments-chart-container";
  // スタイル調整
  container.style.width = "100%";
  container.style.boxSizing = "border-box";
  container.style.marginTop = "12px";
  container.style.padding = "8px";
  container.style.background = "rgba(255,255,255,0.95)";
  container.style.borderRadius = "6px";
  container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
  // 重なり回避
  container.style.position = "relative";
  container.style.zIndex = "1000";   // 上に表示
  container.style.clear = "both";    // 横並び禁止
  container.style.display = "block"; // 強制ブロック要素

  let aftervideoEl = document.querySelector("main[data-theatre-mode-container] > div:nth-child(2)");
  if (!aftervideoEl) {console.warn("[Kick Extension] could not find insertion point for comment chart."); return;}
  aftervideoEl.insertAdjacentElement("afterbegin", container);
  
  // 描画領域を用意して描画
  // inner container to size with video width. We'll set width: videoEl.clientWidth px if possible.
  const inner = document.createElement("div");
  inner.style.width = "100%";
  inner.style.boxSizing = "border-box";
  inner.style.minHeight = "200px";
  inner.style.position = "relative";
  // clear host and append
  container.innerHTML = "";
  container.appendChild(inner);

  // 既にチャート領域がある場合は上書きしない（または更新）
  const EXISTING_ID = "kick-comments-chart-canvas";
  let canvas = inner.querySelector(`#${EXISTING_ID}`);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = EXISTING_ID;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "200px";
    inner.appendChild(canvas);
  }

  window.addEventListener("resize", () => {
    if (!inner) return;
    const canvas = inner.querySelector("canvas");
    if (canvas && canvas._chartInstance) {
      try { canvas._chartInstance.resize(); } catch (e) {}
    }
  });

    const ngwords = /^(\[emote:(\d+):(\w+)\])+$|同接/;
    // コメントを時刻順にソート
    comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const filteredComments = [];
    const lastByUser = new Map();

    function normalizeText(text) {
      return text
        .toLowerCase()
        .replace(/[！!？?\s]/g, "")
        .replace(/[ｗw]+/g, "w")
        .normalize("NFKC");
    }

    for (const c of comments) {
      const uid = c.id;
      const text = c.text.trim();
      const norm = normalizeText(text);
      const time = new Date(c.timestamp);
      let skip = false;

      if (ngwords.test(text)) skip = true;

      // 🔹 30秒以上前の記録を削除してメモリ節約
      for (const [key, value] of lastByUser.entries()) {
        if ((time - value.time) / 1000 > 30) {
          lastByUser.delete(key);
        }
        else break;
      }

      const last = lastByUser.get(uid);

      if (last) {
        const diffSec = (time - last.time) / 1000;
        const lastNorm = normalizeText(last.text);

        if (diffSec <= 10) skip = true;
        if (diffSec <= 30 && (lastNorm.includes(norm) || norm.includes(lastNorm))) skip = true;
      }

      // 最新のコメント情報を保存（次回判定用）
      lastByUser.set(uid, { time, text });

      if (!skip) filteredComments.push(c);
    }

    console.log(`コメント総数: ${comments.length}, フィルタ後: ${filteredComments.length}`);


    // 🔹 アーカイブ情報のJSON (kick_archives.json) に start_time か created_at を含めておく
    // const videoStartTime = new Date(archive.created_at); などとして取得

    // 例: コメントデータのJSONにも start_time が含まれている場合
    const videoStartTime = new Date(start_time || comments[0].timestamp);


    // 全体の終了時間（最後のコメント時刻）
    const endTime = new Date(comments[comments.length - 1].timestamp);

    // 🔹 配信開始〜最後のコメントまで、1分ごとの等間隔ラベルを作成
    const labels = [];
    let t = new Date(videoStartTime);
    while (t <= endTime) {
      labels.push(new Date(t));
      t.setMinutes(t.getMinutes() + 1);
    }

    // コメント総数の配列（1分単位）
    const totalCounts = new Array(labels.length).fill(0);

    // 🔹 キーワード別の配列も作成
    const keywords = ["w", "^あ$"];
    const keywordCounts = {};

    for (const word of keywords) {
      keywordCounts[word] = new Array(labels.length).fill(0);
    }

    // 1分ごとのインデックスにコメントを集計
    for (const comment of filteredComments) {
      const t = new Date(comment.timestamp);
      const diffMin = Math.floor((t - videoStartTime) / 60000); // 経過分数
      if (diffMin < 0 || diffMin >= labels.length) continue;

      const text = comment.text || "";
      totalCounts[diffMin]++;

      for (const word of keywords) {
        try {
          const regex = new RegExp(word, "gi");
          const matches = text.match(regex);
          if (matches && matches.length < 10) keywordCounts[word][diffMin] += matches.length;
        } catch (e) {
          console.warn(`無効な正規表現: ${word}`, e);
        }
      }
    }
    // 🔹 横軸：配信開始からの経過時間 (00:00, 00:01, 00:02 ...)
    const formattedLabels = labels.map((_, i) => {
      const totalMinutes = i;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    });

    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: formattedLabels,
        datasets: [
          {
            label: "全コメント",
            data: totalCounts,
            borderColor: "lime",
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            yAxisID: "yTotal",
            hidden: false
          },
          ...keywords.map((word, i) => ({
            label: `${word}`,
            data: keywordCounts[word],
            borderColor: ["red", "orange", "cyan", "magenta", "yellow"][i % 5],
            borderWidth: 1.5,
            fill: false,
            tension: 0.3,
            yAxisID: "yKeyword",
            hidden: false
          }))
        ]
      },
      options: {
        plugins: {
          legend: {
            labels: { color: "#ccc" },
            onClick: (e, legendItem, legend) => {
              const chart = legend.chart;
              const datasetIndex = legendItem.datasetIndex;
              const meta = chart.getDatasetMeta(datasetIndex);

              // ✅ v4対応：meta.hiddenではなく setDatasetVisibility() を使用
              chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
              chart.update();
            }
          },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "x"
            },
            pan: { enabled: true, mode: "x" }
          }
        },
        scales: {
          x: { display: false },
          yTotal: {
            type: "linear",
            position: "left",
            //beginAtZero: true,
            ticks: { color: "lime"},
            grid: { color: "#333" },
            title: { display: true, text: "全コメント数", color: "lime" },
            display: false,
            //min: 10
          },
          yKeyword: {
            type: "linear",
            position: "right",
            //beginAtZero: true,
            ticks: { color: "orange" },
            grid: { drawOnChartArea: false },
            title: { display: true, text: "キーワード出現数", color: "orange" },
            display: false,
            min: 10
          }
        },
        responsive: true,
        maintainAspectRatio: false,
        onClick: (evt, activeEls) => {
          const chart = canvas._chartInstance;
          const points = chart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);

          if (!points.length) return;

          const firstPoint = points[0];
          const index = firstPoint.index;  // ←クリックされた点の index

          // index = 経過分数 なので、秒に変換
          const seconds = index * 60;

          // video 要素を取得
          const video = document.querySelector("video");
          if (!video) return;

          video.currentTime = seconds;
          video.pause();   //（任意）ジャンプ後に一瞬止める
          video.play();    //（任意）そのまま再生
        },

      }
    });

    canvas._chartInstance = chart;
    console.log("[Kick Extension] グラフ描画完了");
}