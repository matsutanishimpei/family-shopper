console.log('app.js: Script started');

let items = [];
let currentFilter = 'all';
let imageUrl = '';

const form = document.getElementById('add-form');
const list = document.getElementById('item-list');
const filters = document.querySelectorAll('.filter-btn');
const uploadBtn = document.getElementById('upload-button');
const previewDiv = document.getElementById('image-preview');
const previewImg = previewDiv.querySelector('img');

// Cloudinary Widget Setup
let myWidget;
function initWidget() {
  if (myWidget) return true;
  if (typeof cloudinary === 'undefined') {
    console.error('Cloudinary SDK not loaded');
    return false;
  }
  
  const config = window.APP_CONFIG || {};
  console.log('Initializing Cloudinary widget with:', config);
  
  try {
    myWidget = cloudinary.createUploadWidget({
      cloudName: config.CLOUD_NAME,
      uploadPreset: config.UPLOAD_PRESET
    }, (error, result) => {
      if (error) console.error('Cloudinary Error:', error);
      if (result && result.event === "success") {
        console.log('Upload success:', result.info);
        imageUrl = result.info.secure_url;
        previewImg.src = imageUrl;
        previewDiv.style.display = 'block';
        document.getElementById('item-image-url').value = imageUrl;
      }
    });
    return true;
  } catch (e) {
    console.error('Failed to create widget:', e);
    return false;
  }
}

// Initial init attempt
initWidget();

uploadBtn.onclick = () => {
  console.log('Upload button clicked');
  if (initWidget()) {
    console.log('Opening widget...');
    myWidget.open();
  } else {
    alert('Cloudinaryの初期化に失敗しました。SDKが読み込まれていないか、設定が正しくありません。');
  }
};

async function fetchItems() {
  const res = await fetch('/api/items');
  items = await res.json();
  render();
}

function render() {
  list.innerHTML = '';
  const filtered = currentFilter === 'all' ? items : items.filter(i => i.category === currentFilter);
  
  filtered.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'item' + (item.bought ? ' bought' : '');
    li.innerHTML = `
      <div class="checkbox"></div>
      ${item.image_url ? `<img src="${item.image_url}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" />` : ''}
      <div class="item-info">
        <span class="item-name">${item.name}</span>
        <span class="item-meta">${item.count}${item.unit}</span>
        <span class="badge badge-${item.category}">${getCategoryName(item.category)}</span>
      </div>
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

form.onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('item-name').value;
  const count = parseInt(document.getElementById('item-count').value);
  const unit = document.getElementById('item-unit').value;
  const category = document.getElementById('item-category').value;
  const image_url = document.getElementById('item-image-url').value;
  
  await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, count, unit, category, image_url })
  });
  
  form.reset();
  previewDiv.style.display = 'none';
  imageUrl = '';
  await fetchItems();
};

filters.forEach(btn => {
  btn.onclick = () => {
    filters.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  };
});

fetchItems();
