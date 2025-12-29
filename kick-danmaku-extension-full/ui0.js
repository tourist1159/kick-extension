/* ui.js
   Injects a small NG settings button and modal into the page.
*/
(function(){
  function createModalIfNeeded(){
    if(document.getElementById('ng-modal-bg')) return;
    const modalBg = document.createElement('div');
    modalBg.id = 'ng-modal-bg';
    modalBg.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; justify-content: center; align-items: center; z-index: 100001;';
    const modal = document.createElement('div');
    modal.id = 'ng-modal';
    modal.style.cssText = 'background:#fff; color:#000; padding:16px; border-radius:8px; width:340px; max-height:70vh; overflow:auto; box-shadow: 0 6px 18px rgba(0,0,0,0.4);';
    modal.innerHTML = '<h3 style="margin-top:0">NGワード設定</h3><ul id="ng-list" style="list-style:none;padding:0;margin:6px 0 10px 0;"></ul><div style="display:flex;gap:8px;"><input id="ng-input" placeholder="NGワードを追加" style="flex:1;padding:6px;border:1px solid #ccc;border-radius:4px;"/><button id="add-btn" style="padding:6px 10px;border-radius:4px;">追加</button></div><div style="text-align:right;margin-top:10px;"><button id="close-btn" style="padding:6px 10px;border-radius:4px;">閉じる</button></div>';
    modalBg.appendChild(modal);
    document.body.appendChild(modalBg);

    // handlers
    modal.querySelector('#close-btn').addEventListener('click',()=>{ modalBg.style.display = 'none'; });
    modal.querySelector('#add-btn').addEventListener('click', () => {
      const input = modal.querySelector('#ng-input');
      const v = input.value.trim();
      if(!v) return;
      chrome.storage.local.get('ngList', (data) => {
        const arr = data.ngList || [];
        arr.push(v);
        chrome.storage.local.set({ ngList: arr });
      });
      input.value = '';
    });

    // render list from storage
    const listEl = modal.querySelector('#ng-list');
    function render(words){
      listEl.innerHTML = '';
      (words || []).forEach((word, idx) => {
        const li = document.createElement('li');
        li.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-radius:4px;';
        const span = document.createElement('span'); span.textContent = word;
        const del = document.createElement('button'); del.textContent = '削除'; del.style.cssText='background:#c00;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;';
        del.addEventListener('click', () => {
          chrome.storage.local.get('ngList', (data) => {
            const arr = data.ngList || [];
            arr.splice(idx,1);
            chrome.storage.local.set({ ngList: arr });
          });
        });
        li.appendChild(span); li.appendChild(del);
        listEl.appendChild(li);
      });
    }

    chrome.storage.local.get('ngList', (data) => render(data.ngList || []));
    chrome.storage.onChanged.addListener((changes, area) => {
      if(area==='local' && changes.ngList) render(changes.ngList.newValue || []);
    });
  }

  function addButton(){
    if(document.getElementById('ng-button')) return;
    const btn = document.createElement('button');
    btn.id = 'ng-button';
    btn.textContent = '🚫';
    btn.style.cssText = 'position:absolute;top:5px;right:10px;z-index:100000;background:#222;color:#fff;padding:6px 10px;border-radius:6px;border:1px solid #666;cursor:pointer;';
    btn.addEventListener('click', () => {
      createModalIfNeeded();
      const bg = document.getElementById('ng-modal-bg');
      if(bg) bg.style.display = 'flex';
    });
    // attach when body exists
    function attach(){
      const screen = document.body;
      if(!screen) { setTimeout(attach, 300); return; }
      screen.appendChild(btn);
      createModalIfNeeded();
    }
    attach();
  }

  window.addEventListener('load', addButton);
  // also try earlier in case of SPA navigation
  setTimeout(addButton, 1500);
})();