import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database
  CLOUD_NAME: string
  UPLOAD_PRESET: string
  ADMIN_USER: string
  ADMIN_PASS: string
  CLOUDINARY_API_KEY?: string
  CLOUDINARY_API_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()
app.use(renderer)

// Helper: Hash password
async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Middleware: Check Session
const authMiddleware = async (c: any, next: any) => {
  const session = getCookie(c, 'session')
  if (!session && !c.req.path.startsWith('/login') && c.req.path !== '/api/login') {
    return c.redirect('/login')
  }
  await next()
}

// Middleware: Admin Only
const adminMiddleware = async (c: any, next: any) => {
  const role = getCookie(c, 'role')
  if (role !== 'admin') {
    return c.text('Forbidden', 403)
  }
  await next()
}

// API: Login
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json()
  
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first() as any

  let authenticated = false
  let role = 'member'

  if (user) {
    const hashed = await hashPassword(password)
    if (user.password_hash === hashed) {
      authenticated = true
      role = user.role
    }
  } else {
    if (username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
      authenticated = true
      role = 'admin'
      const hashed = await hashPassword(password)
      await c.env.DB.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
        .bind(username, hashed, 'admin')
        .run()
    }
  }

  if (authenticated) {
    setCookie(c, 'session', username, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    setCookie(c, 'role', role, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    return c.json({ success: true, role })
  }

  return c.json({ success: false, error: 'Invalid username or password' }, 401)
})

// API: Logout
app.post('/api/logout', (c) => {
  deleteCookie(c, 'session')
  deleteCookie(c, 'role')
  return c.json({ success: true })
})

app.get('/login', (c) => {
  return c.render(
    <div class="card login-card" style="max-width: 400px; margin: 100px auto;">
      <h1>Login</h1>
      <form id="login-form">
        <div class="input-group">
          <input type="text" id="username" placeholder="ユーザー名" required class="full-width" style="margin-bottom: 10px;" />
          <input type="password" id="password" placeholder="パスワード" required class="full-width" style="margin-bottom: 10px;" />
        </div>
        <button type="submit" class="primary full-width">ログイン</button>
      </form>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('login-form').onsubmit = async (e) => {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          if (res.ok) {
            window.location.href = '/';
          } else {
            alert('ログインに失敗しました。');
          }
        };
      ` }} />
    </div>
  )
})

app.use('*', authMiddleware)

// API: User Management (Admin Only)
app.get('/api/admin/users', adminMiddleware, async (c) => {
  const users = await c.env.DB.prepare('SELECT id, username, role FROM users').all()
  return c.json(users.results || [])
})

app.post('/api/admin/users', adminMiddleware, async (c) => {
  const { username, password, role } = await c.req.json()
  const hashed = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .bind(username, hashed, role || 'member')
    .run()
  return c.json({ success: true })
})

app.delete('/api/admin/users/:id', adminMiddleware, async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// API: Delete Item & Cloudinary Image (Available to all logged-in users)
app.delete('/api/items/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first() as any
  
  if (item && item.image_url && c.env.CLOUDINARY_API_KEY && c.env.CLOUDINARY_API_SECRET) {
    const parts = item.image_url.split('/')
    const filename = parts[parts.length - 1]
    const publicId = filename.split('.')[0]
    
    const timestamp = Math.round(new Date().getTime() / 1000)
    const signature = await (async () => {
      const str = `public_id=${publicId}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`
      const msgUint8 = new TextEncoder().encode(str)
      const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    })()

    await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUD_NAME}/image/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_id: publicId,
        timestamp: timestamp,
        api_key: c.env.CLOUDINARY_API_KEY,
        signature: signature
      })
    })
  }

  await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.get('/admin', adminMiddleware, (c) => {
  return c.render(
    <div class="admin-page">
      <div class="card">
        <h1>管理者ページ</h1>
        <p><a href="/">← メインページへ戻る</a></p>
        
        <section style="margin-top: 20px;">
          <h2>家族ユーザー管理</h2>
          <form id="user-form" class="input-group">
            <input type="text" id="new-username" placeholder="名前" required />
            <input type="password" id="new-password" placeholder="パスワード" required />
            <select id="new-role">
              <option value="member">家族メンバー</option>
              <option value="admin">管理者</option>
            </select>
            <button type="submit" class="primary">追加</button>
          </form>
          <ul id="user-list" class="item-list" style="margin-top: 10px;"></ul>
        </section>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        async function loadUsers() {
          const res = await fetch('/api/admin/users');
          const users = await res.json();
          const list = document.getElementById('user-list');
          list.innerHTML = users.map(u => \`
            <li class="item">
              <span class="item-name">\${u.username} (\${u.role})</span>
              \${u.username !== '${getCookie(c, 'session')}' ? \`<button onclick="deleteUser(\${u.id})" style="background:none;border:none;color:red;cursor:pointer;">削除</button>\` : ''}
            </li>
          \`).join('');
        }

        async function deleteUser(id) {
          if (!confirm('本当に削除しますか？')) return;
          await fetch('/api/admin/users/' + id, { method: 'DELETE' });
          loadUsers();
        }

        document.getElementById('user-form').onsubmit = async (e) => {
          e.preventDefault();
          const username = document.getElementById('new-username').value;
          const password = document.getElementById('new-password').value;
          const role = document.getElementById('new-role').value;
          await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
          });
          e.target.reset();
          loadUsers();
        };

        loadUsers();
      ` }} />
    </div>
  )
})

// API: Get items
app.get('/api/items', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM items ORDER BY created_at DESC').all()
  return c.json(results || [])
})

// API: Add item
app.post('/api/items', async (c) => {
  const { name, count, unit, category, image_url } = await c.req.json()
  await c.env.DB.prepare('INSERT INTO items (name, count, unit, category, image_url) VALUES (?, ?, ?, ?, ?)')
    .bind(name, count, unit, category, image_url || null)
    .run()
  return c.json({ success: true }, 201)
})

// API: Update item
app.patch('/api/items/:id', async (c) => {
  const id = c.req.param('id')
  const { bought } = await c.req.json()
  await c.env.DB.prepare('UPDATE items SET bought = ? WHERE id = ?').bind(bought ? 1 : 0, id).run()
  return c.json({ success: true })
})

app.get('/', (c) => {
  const user = getCookie(c, 'session')
  const role = getCookie(c, 'role')
  
  return c.render(
    <>
      <div class="user-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div>
          <span style="font-weight: 600; color: #333;">👤 {user} さん</span>
          {role === 'admin' && (
            <a href="/admin" style="margin-left: 15px; font-size: 0.9em; color: #6c5ce7; text-decoration: none;">⚙️ 管理者ページ</a>
          )}
        </div>
        <button id="logout-btn" style="background: none; border: 1px solid #ddd; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 0.9em; color: #666;">ログアウト</button>
      </div>

      <div class="card">
        <h1>Family Shopper</h1>
        <form id="add-form">
          <div class="input-group">
            <input type="text" id="item-name" placeholder="何を買う？" required class="full-width" list="item-history" />
            <datalist id="item-history"></datalist>
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
            <input type="file" id="image-input" accept="image/*" capture="environment" style="display: none;" />
            <button type="button" id="upload-button" class="upload-btn-ui full-width" style="margin-top: 10px; background: #f0f2f5; border: 1px solid #ddd; padding: 10px; border-radius: 8px; cursor: pointer;">
              📷 写真を撮る・選ぶ
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
        <ul id="item-list" class="item-list"></ul>
      </div>

      <div id="image-modal" class="modal-overlay" onclick="closeModal()">
        <img id="modal-img" class="modal-content" src="" alt="拡大画像" />
      </div>

      <div id="reset-trigger" style="text-align: center; margin-top: 40px; padding: 20px; color: #ccc; font-size: 0.8em; cursor: pointer; user-select: none;">
        &copy; 2026 Family Shopper
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          let items = [];
          let currentFilter = 'all';
          let imageUrl = '';
          let purchaseHistory = JSON.parse(localStorage.getItem('purchase_history') || '[]');

          const config = {
            cloudName: '${c.env.CLOUD_NAME}',
            uploadPreset: '${c.env.UPLOAD_PRESET}'
          };

          function init() {
            const form = document.getElementById('add-form');
            const list = document.getElementById('item-list');
            const filters = document.querySelectorAll('.filter-btn');
            const uploadBtn = document.getElementById('upload-button');
            const imageInput = document.getElementById('image-input');
            const previewDiv = document.getElementById('image-preview');
            const previewImg = previewDiv.querySelector('img');
            const dataList = document.getElementById('item-history');
            const resetTrigger = document.getElementById('reset-trigger');

            updateHistoryUI();

            if (!uploadBtn || !imageInput) return;

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
                const res = await fetch(\`https://api.cloudinary.com/v1_1/\${config.cloudName}/image/upload\`, {
                  method: 'POST',
                  body: formData
                });
                const data = await res.json();
                if (data.secure_url) {
                  imageUrl = data.secure_url;
                  previewImg.src = imageUrl;
                  previewDiv.style.display = 'block';
                  document.getElementById('item-image-url').value = imageUrl;
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
                previewDiv.style.display = 'none';
                imageUrl = '';
                uploadBtn.innerText = '📷 写真を撮る・選ぶ';
                await fetchItems();
              }
            };

            function updateHistoryUI() {
              if (dataList) {
                dataList.innerHTML = purchaseHistory.map(h => \`<option value="\${h}">\`).join('');
              }
            }

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
                  \${item.image_url ? \`<img src="\${item.image_url}" onclick="event.stopPropagation(); showModal('\${item.image_url}')" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; cursor: zoom-in;" title="タップで拡大" />\` : ''}
                  <div class="item-info">
                    <span class="item-name">\${item.name}</span>
                    <span class="item-meta">購入数: <span class="item-count-label">\${item.count}\${item.unit}</span></span>
                    <span class="badge badge-\${item.category}">\${getCategoryName(item.category)}</span>
                  </div>
                  <button onclick="event.stopPropagation(); deleteItem(\${item.id})" style="margin-left:auto; background:none; border:none; font-size:1.2em; cursor:pointer; padding:5px;">🗑️</button>
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

            window.deleteItem = async function(id) {
              if (!confirm('画像をCloudinaryからも完全に削除しますか？')) return;
              await fetch('/api/items/' + id, { method: 'DELETE' });
              await fetchItems();
            };

            window.showModal = function(url) {
              const modal = document.getElementById('image-modal');
              const modalImg = document.getElementById('modal-img');
              modalImg.src = url;
              modal.style.display = 'flex';
            };

            window.closeModal = function() {
              document.getElementById('image-modal').style.display = 'none';
            };

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
