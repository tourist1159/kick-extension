// ===============================
// UI用共通変数
// ===============================
let ngList = [];
let ngEnabled = true; // 全体ON/OFFスイッチ

// ===============================
// モーダルを作成
// ===============================
function createModal() {
  const modal = document.createElement("div");
  modal.id = "ng-modal";
  modal.style = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #222;
    color: #fff;
    padding: 20px;
    border-radius: 10px;
    z-index: 999999;
    width: 300px;
    font-size: 14px;
    display: none;
  `;

  modal.innerHTML = `
    <h3 style="margin-top:0">NGワード設定</h3>

    <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <input type="checkbox" id="ng-global-toggle">
      <span>NGフィルタを有効にする</span>
    </label>

    <ul id="ng-list" style="list-style:none;padding:0;margin:6px 0 10px 0;"></ul>

    <div style="display:flex;gap:8px;">
      <input id="ng-input" placeholder="NGパターン（正規表現）" 
        style="flex:1;padding:6px;border:1px solid #ccc;border-radius:4px;color:#000;"/>
      <button id="add-btn" style="padding:6px 10px;border-radius:4px;">追加</button>
    </div>

    <div style="text-align:right;margin-top:10px;">
      <button id="close-btn" style="padding:6px 10px;border-radius:4px;">閉じる</button>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

// ===============================
// NGリスト表示（生成）
// ===============================
function renderList() {
  const ul = document.querySelector("#ng-list");
  if (!ul) return;

  ul.innerHTML = "";

  ngList.forEach((item, index) => {
    const li = document.createElement("li");
    li.style = "display:flex;align-items:center;gap:8px;margin-bottom:6px;";

    // ON/OFFスイッチ
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = item.enabled;
    toggle.addEventListener("change", () => {
      ngList[index].enabled = toggle.checked;
      chrome.storage.local.set({ ngList });
    });

    // パターン表示
    const span = document.createElement("span");
    span.textContent = item.pattern;

    // 削除ボタン
    const del = document.createElement("button");
    del.textContent = "削除";
    del.style = "margin-left:auto;";
    del.addEventListener("click", () => {
      ngList.splice(index, 1);
      chrome.storage.local.set({ ngList });
      renderList();
    });

    // 上へ移動ボタン
    const up = document.createElement("button");
    up.textContent = "↑";
    up.title = "上へ移動";
    up.addEventListener("click", () => {
      if (index <= 0) return;
      const tmp = ngList[index - 1];
      ngList[index - 1] = ngList[index];
      ngList[index] = tmp;
      chrome.storage.local.set({ ngList });
      renderList();
    });

    // 下へ移動ボタン
    const down = document.createElement("button");
    down.textContent = "↓";
    down.title = "下へ移動";
    down.addEventListener("click", () => {
      if (index >= ngList.length - 1) return;
      const tmp = ngList[index + 1];
      ngList[index + 1] = ngList[index];
      ngList[index] = tmp;
      chrome.storage.local.set({ ngList });
      renderList();
    });

    li.appendChild(toggle);
    li.appendChild(span);
    // 移動ボタンを右側にまとめて配置
    const moveWrap = document.createElement("div");
    moveWrap.style = "margin-left:auto;display:flex;gap:6px;";
    moveWrap.appendChild(up);
    moveWrap.appendChild(down);
    moveWrap.appendChild(del);
    li.appendChild(moveWrap);
    ul.appendChild(li);
  });
}

// ===============================
// モーダルの初期化
// ===============================
function initModal() {
  const modal = createModal();

  // NGフィルタ全体のトグル
  const globalToggle = modal.querySelector("#ng-global-toggle");

  // 追加ボタン
  modal.querySelector("#add-btn").addEventListener("click", () => {
    const input = modal.querySelector("#ng-input");
    const pat = input.value.trim();
    if (!pat) return;

    ngList.push({ pattern: pat, enabled: true });
    chrome.storage.local.set({ ngList });

    input.value = "";
    renderList();
  });

  // 閉じるボタン
  modal.querySelector("#close-btn").addEventListener("click", () => {
    modal.style.display = "none";
  });

  // 全体トグルの変更
  globalToggle.addEventListener("change", (e) => {
    ngEnabled = e.target.checked;
    chrome.storage.local.set({ ngEnabled });
  });

  // ストレージから初期値をロード
  chrome.storage.local.get(["ngList", "ngEnabled"], (data) => {
    ngList = data.ngList ?? [];
    ngEnabled = data.ngEnabled ?? true;

    globalToggle.checked = ngEnabled;

    renderList();
  });
}

// ===============================
// NG設定ボタンを画面右上に追加
// ===============================
function addOpenButton() {
  const btn = document.createElement("button");
  btn.id = "ng-button";
  btn.innerHTML = "⚙️"; // ← アイコンに変更可能
  btn.title = "NG設定";
  btn.style = `
    position: fixed;
    top: 0px;
    right: 0px;
    z-index: 999999;
    padding: 8px 10px;
    background: #222;
    color: #fff;
    border: 1px solid #666;
    border-radius: 8px;
    cursor: pointer;
    font-size: 18px;
  `;

  btn.onclick = () => {
    const modal = document.querySelector("#ng-modal");
    if (modal) modal.style.display = "block";
  };

  document.body.appendChild(btn);
}

// ===============================
// 初期化
// ===============================
window.addEventListener("load", () => {
  initModal();
  addOpenButton();
});
