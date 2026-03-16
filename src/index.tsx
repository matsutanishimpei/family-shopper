import { Hono } from 'hono'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database
  CLOUD_NAME: string
  UPLOAD_PRESET: string
}


const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

// API: Get all items
app.get('/api/items', async (c) => {
  try {
    if (!c.env?.DB) {
      console.error('D1 Binding "DB" is not found in c.env')
      return c.json({ error: 'Database binding missing' }, 500)
    }
    const { results } = await c.env.DB.prepare('SELECT * FROM items ORDER BY created_at DESC').all()
    return c.json(results || [])
  } catch (err: any) {
    console.error('Error fetching items:', err)
    return c.json({ error: err.message }, 500)
  }
})

// API: Add new item
app.post('/api/items', async (c) => {
  try {
    const { name, count, unit, category, image_url } = await c.req.json()
    if (!c.env?.DB) {
      return c.json({ error: 'Database binding missing' }, 500)
    }
    await c.env.DB.prepare(
      'INSERT INTO items (name, count, unit, category, image_url) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(name, count, unit, category, image_url || null)
      .run()
    return c.json({ success: true }, 201)
  } catch (err: any) {
    console.error('Error adding item:', err)
    return c.json({ error: err.message }, 500)
  }
})

// API: Toggle bought state
app.patch('/api/items/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { bought } = await c.req.json()
    if (!c.env?.DB) {
      return c.json({ error: 'Database binding missing' }, 500)
    }
    await c.env.DB.prepare('UPDATE items SET bought = ? WHERE id = ?')
      .bind(bought ? 1 : 0, id)
      .run()
    return c.json({ success: true })
  } catch (err: any) {
    console.error('Error updating item:', err)
    return c.json({ error: err.message }, 500)
  }
})


app.get('/', (c) => {
  return c.render(
    <>
      <div class="card">
        <h1>Family Shopper</h1>
        
        <form id="add-form">
          <div class="input-group">
            <input type="text" id="item-name" placeholder="何を買う？" required class="full-width" />
            <input type="number" id="item-count" placeholder="個数" min="1" value="1" />
            <select id="item-unit">
              <option value="個">個</option>
              <option value="袋">袋</option>
              <option value="本">本</option>
              <option value="パック">パック</option>
              <option value="枚">枚</option>
              <option value="台">台</option>
              <option value="その他">その他</option>
            </select>
            <select id="item-category" class="full-width">
              <option value="dad">父用</option>
              <option value="mom">母用</option>
              <option value="kids">子ども用</option>
              <option value="other">その他</option>
            </select>
            <input type="hidden" id="item-image-url" />
            <button type="button" id="upload-button" class="filter-btn full-width" style="margin-top: 10px;">
              📷 画像をアップロード
            </button>
            <div id="image-preview" style="display: none; width: 100%; text-align: center; margin-top: 10px;">
              <img src="" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />
            </div>
          </div>
          <button type="submit" class="primary full-width">リストに追加</button>
        </form>
      </div>

      <div class="card">
        <div class="filters">
          <button class="filter-btn active" data-filter="all">すべて</button>
          <button class="filter-btn" data-filter="dad">父用</button>
          <button class="filter-btn" data-filter="mom">母用</button>
          <button class="filter-btn" data-filter="kids">子ども用</button>
          <button class="filter-btn" data-filter="other">その他</button>
        </div>
        
        <ul id="item-list" class="item-list">
        </ul>
      </div>

      <script src="https://upload-widget.cloudinary.com/global/all.js" type="text/javascript"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          console.log('App initialization started');
          let items = [];
          let currentFilter = 'all';
          let imageUrl = '';
          let myWidget = null;

          const config = {
            cloudName: '${c.env.CLOUD_NAME}',
            uploadPreset: '${c.env.UPLOAD_PRESET}'
          };

          function init() {
            console.log('DOM Content Loaded - setting up events');
            const uploadBtn = document.getElementById('upload-button');
            const previewDiv = document.getElementById('image-preview');
            const previewImg = previewDiv.querySelector('img');

            if (!uploadBtn) {
              console.error('Upload button not found!');
              return;
            }

            // Remove any existing listener and add a new robust one
            const newBtn = uploadBtn.cloneNode(true);
            uploadBtn.parentNode.replaceChild(newBtn, uploadBtn);

            newBtn.addEventListener('click', function() {
              console.log('Upload button clicked via EventListener');
              alert('アップロードボタンが押されました。ウィジェットを起動します。'); 
              
              if (typeof cloudinary === 'undefined') {
                console.error('Cloudinary SDK is undefined');
                alert('Cloudinary SDKが読み込まれていません。ネットワーク状況を確認してください。');
                return;
              }

              if (!myWidget) {
                console.log('Creating widget with config:', config);
                myWidget = cloudinary.createUploadWidget(config, (error, result) => {
                  if (error) console.error('Cloudinary Error:', error);
                  if (result && result.event === "success") {
                    console.log('Upload success:', result.info);
                    imageUrl = result.info.secure_url;
                    previewImg.src = imageUrl;
                    previewDiv.style.display = 'block';
                    document.getElementById('item-image-url').value = imageUrl;
                  }
                });
              }
              console.log('Opening widget...');
              myWidget.open();
            });

            // Re-bind form and filters to the new context if needed
            const form = document.getElementById('add-form');
            const list = document.getElementById('item-list');
            const filters = document.querySelectorAll('.filter-btn');

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
                li.innerHTML = \`
                  <div class="checkbox"></div>
                  \${item.image_url ? \`<img src="\${item.image_url}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" />\` : ''}
                  <div class="item-info">
                    <span class="item-name">\${item.name}</span>
                    <span class="item-meta">\${item.count}\${item.unit}</span>
                    <span class="badge badge-\${item.category}">\${getCategoryName(item.category)}</span>
                  </div>
                \`;
                li.onclick = () => toggleBought(item.id, !item.bought);
                list.appendChild(li);
              });
            }

            function getCategoryName(cat) {
              const names = { dad: '父用', mom: '母用', kids: '子ども用', other: 'その他' };
              return names[cat] || cat;
            }

            async function toggleBought(id, bought) {
              await fetch(\`/api/items/\${id}\`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bought })
              });
              await fetchItems();
            }

            fetchItems();
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
          } else {
            init();
          }
        })();
      ` }} />
    </>
  )
})

export default app



