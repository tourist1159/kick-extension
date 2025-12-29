// Clean NG management UI implementation

let ngList = [];
let ngEnabled = true;
let ngEditMode = false;

function createModal() {
  const existing = document.querySelector('#ng-modal');
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = 'ng-modal';
  modal.style.cssText = [
    'position: fixed',
    'top: 50%',
    'left: 50%',
    'transform: translate(-50%, -50%)',
    'background: #222',
    'color: #fff',
    'padding: 20px',
    'border-radius: 10px',
    'z-index: 999999',
    'width: 320px',
    'font-size: 14px',
    'display: none'
  ].join(';');

  modal.innerHTML = `
    <div style="position:relative;">
      <h3 style="margin:0 0 8px 0">NGワード設定</h3>
      <button id="ng-edit-btn" style="position:absolute;top:0;right:0;padding:4px 8px;border-radius:4px;">編集</button>
    </div>

    <label style="display:flex;align-items:center;gap:8px;margin:8px 0;">
      <input type="checkbox" id="ng-global-toggle">
      <span>NGフィルタを有効にする</span>
    </label>

    <ul id="ng-list" style="list-style:none;padding:0;margin:6px 0 10px 0;max-height:240px;overflow:auto;"></ul>

    <div style="display:flex;gap:8px;margin-top:6px;">
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

function renderList() {
  const ul = document.querySelector('#ng-list');
  if (!ul) return;
  ul.innerHTML = '';

  ngList.forEach((item, index) => {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = !!item.enabled;
    toggle.addEventListener('change', () => {
      ngList[index].enabled = toggle.checked;
      chrome.storage.local.set({ ngList });
    });

    const span = document.createElement('span');
    span.textContent = item.pattern;
    span.style.maxWidth = '160px';
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    span.style.whiteSpace = 'nowrap';

    const moveWrap = document.createElement('div');
    moveWrap.style.cssText = 'margin-left:auto;display:flex;gap:6px;align-items:center;';

    if (ngEditMode) {
      const upBtn = document.createElement('button');
      upBtn.textContent = '↑';
      upBtn.title = '上へ移動';
      upBtn.disabled = index <= 0;
      upBtn.addEventListener('click', () => {
        if (index <= 0) return;
        const tmp = ngList[index - 1];
        ngList[index - 1] = ngList[index];
        ngList[index] = tmp;
        chrome.storage.local.set({ ngList });
        renderList();
      });

      const downBtn = document.createElement('button');
      downBtn.textContent = '↓';
      downBtn.title = '下へ移動';
      downBtn.disabled = index >= ngList.length - 1;
      downBtn.addEventListener('click', () => {
        if (index >= ngList.length - 1) return;
        const tmp = ngList[index + 1];
        ngList[index + 1] = ngList[index];
        ngList[index] = tmp;
        chrome.storage.local.set({ ngList });
        renderList();
      });

      moveWrap.appendChild(upBtn);
      moveWrap.appendChild(downBtn);
    }

    const del = document.createElement('button');
    del.textContent = '削除';
    del.addEventListener('click', () => {
      ngList.splice(index, 1);
      chrome.storage.local.set({ ngList });
      renderList();
    });

    moveWrap.appendChild(del);

    li.appendChild(toggle);
    li.appendChild(span);
    li.appendChild(moveWrap);

    ul.appendChild(li);
  });
}

function initModal() {
  const modal = createModal();
  const globalToggle = modal.querySelector('#ng-global-toggle');
  const editBtn = modal.querySelector('#ng-edit-btn');
  const addBtn = modal.querySelector('#add-btn');
  const input = modal.querySelector('#ng-input');
  const closeBtn = modal.querySelector('#close-btn');

  editBtn.addEventListener('click', () => {
    ngEditMode = !ngEditMode;
    editBtn.textContent = ngEditMode ? '完了' : '編集';
    renderList();
  });

  addBtn.addEventListener('click', () => {
    const pat = input.value.trim();
    if (!pat) return;
    ngList.push({ pattern: pat, enabled: true });
    chrome.storage.local.set({ ngList });
    input.value = '';
    renderList();
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (ngEditMode) {
      ngEditMode = false;
      editBtn.textContent = '編集';
      renderList();
    }
  });

  globalToggle.addEventListener('change', (e) => {
    ngEnabled = e.target.checked;
    chrome.storage.local.set({ ngEnabled });
  });

  chrome.storage.local.get(['ngList', 'ngEnabled'], (data) => {
    ngList = Array.isArray(data.ngList) ? data.ngList : [];
    ngEnabled = data.ngEnabled ?? true;
    globalToggle.checked = ngEnabled;
    renderList();
  });
}

function addOpenButton() {
  if (document.querySelector('#ng-button')) return;
  const btn = document.createElement('button');
  btn.id = 'ng-button';
  btn.textContent = '⚙️';
  btn.title = 'NG設定';
  btn.style.cssText = 'position:fixed;top:0;right:0;z-index:999999;padding:8px 10px;background:#222;color:#fff;border:1px solid #666;border-radius:8px;cursor:pointer;font-size:18px;';
  btn.addEventListener('click', () => {
    const modal = createModal();
    modal.style.display = 'block';
  });
  document.body.appendChild(btn);
}

window.addEventListener('load', () => {
  initModal();
  addOpenButton();
});

