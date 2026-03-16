(function() {
  let items = [];
  let currentFilter = 'all';
  let imageUrl = '';
  let purchaseHistory = JSON.parse(localStorage.getItem('purchase_history') || '[]');

  // window.APP_CONFIG should be defined via inline script in the HTML
  const config = window.APP_CONFIG || { cloudName: '', uploadPreset: '' };

  function init() {
    const form = document.getElementById('add-form');
    const list = document.getElementById('item-list');
    const filters = document.querySelectorAll('.filter-btn');
    const uploadBtn = document.getElementById('upload-button');
    const imageInput = document.getElementById('image-input');
    const previewDiv = document.getElementById('image-preview');
    const previewImg = previewDiv ? previewDiv.querySelector('img') : null;
    const dataList = document.getElementById('item-history');
    const resetTrigger = document.getElementById('reset-trigger');

    updateHistoryUI();

    if (!form) return;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
      };
    }

    // Hidden reset function (3 taps)
    let tapCount = 0;
    let lastTap = 0;
    if (resetTrigger) {
      resetTrigger.onclick = () => {
        const now = Date.now();
        if (now - lastTap < 500) {
          tapCount++;
        } else {
          tapCount = 1;
        }
        lastTap = now;

        if (tapCount >= 3) {
          if (confirm('ローカルのデータをすべて初期化しますか？')) {
            localStorage.clear();
            document.cookie.split(";").forEach(function(c) { 
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            window.location.reload();
          }
          tapCount = 0;
        }
      };
    }

    if (uploadBtn && imageInput) {
      uploadBtn.onclick = () => imageInput.click();

      imageInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadBtn.innerText = '⌛ アップロード中...';
        uploadBtn.disabled = true;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', config.uploadPreset);
        try {
          const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.secure_url) {
            imageUrl = data.secure_url;
            if (previewImg) previewImg.src = imageUrl;
            if (previewDiv) previewDiv.style.display = 'block';
            const hiddenInput = document.getElementById('item-image-url');
            if (hiddenInput) hiddenInput.value = imageUrl;
            uploadBtn.innerText = '✅ 完了 (変更するには再度タップ)';
          } else {
            alert('アップロードに失敗しました。');
            uploadBtn.innerText = '📷 写真を撮る・選ぶ';
          }
        } catch (err) {
          alert('通信エラーが発生しました。');
          uploadBtn.innerText = '📷 写真を撮る・選ぶ';
        } finally {
          uploadBtn.disabled = false;
        }
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('item-name').value;
      const count = parseInt(document.getElementById('item-count').value);
      const unit = document.getElementById('item-unit').value;
      const category = document.getElementById('item-category').value;
      const image_url = document.getElementById('item-image-url').value;
      
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, count, unit, category, image_url })
      });
      
      if (res.ok) {
        // Add to history
        if (!purchaseHistory.includes(name)) {
          purchaseHistory.unshift(name);
          if (purchaseHistory.length > 20) purchaseHistory.pop();
          localStorage.setItem('purchase_history', JSON.stringify(purchaseHistory));
          updateHistoryUI();
        }
        form.reset();
        if (previewDiv) previewDiv.style.display = 'none';
        imageUrl = '';
        if (uploadBtn) uploadBtn.innerText = '📷 写真を撮る・選ぶ';
        await fetchItems();
      }
    };

    function updateHistoryUI() {
      if (dataList) {
        dataList.innerHTML = purchaseHistory.map(h => `<option value="${h}">`).join('');
      }
    }

    if (filters) {
      filters.forEach(btn => {
        btn.onclick = () => {
          filters.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentFilter = btn.dataset.filter;
          render();
        };
      });
    }

    async function fetchItems() {
      const res = await fetch('/api/items');
      items = await res.json();
      render();
    }

    function render() {
      if (!list) return;
      list.innerHTML = '';
      const filtered = currentFilter === 'all' ? items : items.filter(i => i.category === currentFilter);
      filtered.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'item' + (item.bought ? ' bought' : '');
        li.innerHTML = `
          <div class="checkbox"></div>
          ${item.image_url ? `<img src="${item.image_url}" onclick="event.stopPropagation(); showModal('${item.image_url}')" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; cursor: zoom-in;" title="タップで拡大" />` : ''}
          <div class="item-info">
            <span class="item-name">${item.name}</span>
            <span class="item-meta">購入数: <span class="item-count-label">${item.count}${item.unit}</span></span>
            <span class="badge badge-${item.category}">${getCategoryName(item.category)}</span>
          </div>
          <button onclick="event.stopPropagation(); deleteItem(${item.id})" style="margin-left:auto; background:none; border:none; font-size:1.2em; cursor:pointer; padding:5px;">🗑️</button>
        `;
        li.onclick = () => toggleBought(item.id, !item.bought);
        list.appendChild(li);
      });
    }

    function getCategoryName(cat) {
      const names = { dad: '父用', mom: '母用', kids: '子ども用', other: 'その他' };
      return names[cat] || cat;
    }

    async function toggleBought(id, bought) {
      await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bought })
      });
      await fetchItems();
    }

    window.deleteItem = async function(id) {
      if (!confirm('画像をCloudinaryからも完全に削除しますか？')) return;
      await fetch('/api/items/' + id, { method: 'DELETE' });
      await fetchItems();
    };

    window.showModal = function(url) {
      const modal = document.getElementById('image-modal');
      const modalImg = document.getElementById('modal-img');
      if (modal && modalImg) {
        modalImg.src = url;
        modal.style.display = 'flex';
      }
    };

    window.closeModal = function() {
      const modal = document.getElementById('image-modal');
      if (modal) modal.style.display = 'none';
    };

    fetchItems();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
