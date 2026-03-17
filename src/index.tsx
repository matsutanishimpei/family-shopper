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

/**
 * API Routes
 */

// Login API
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json()
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first() as any

  let authenticated = false
  let role = 'member'

  if (user) {
    const hashed = await hashPassword(password)
    if (user.password_hash === hashed) {
      authenticated = true
      role = user.role
    }
  } else if (username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    authenticated = true
    role = 'admin'
    const hashed = await hashPassword(password)
    await c.env.DB.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .bind(username, hashed, 'admin').run()
  }

  if (authenticated) {
    setCookie(c, 'session', username, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    setCookie(c, 'role', role, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    return c.json({ success: true, role })
  }
  return c.json({ success: false, error: 'Invalid credentials' }, 401)
})

// Logout API
app.post('/api/logout', (c) => {
  deleteCookie(c, 'session'); deleteCookie(c, 'role')
  return c.json({ success: true })
})

// User Management API
app.get('/api/admin/users', adminMiddleware, async (c) => {
  const users = await c.env.DB.prepare('SELECT id, username, role FROM users').all()
  return c.json(users.results || [])
})

app.post('/api/admin/users', adminMiddleware, async (c) => {
  const { username, password, role } = await c.req.json()
  const hashed = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .bind(username, hashed, role || 'member').run()
  return c.json({ success: true })
})

app.delete('/api/admin/users/:id', adminMiddleware, async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Item Management API
app.get('/api/items', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM items ORDER BY created_at DESC').all()
  return c.json(results || [])
})

app.post('/api/items', authMiddleware, async (c) => {
  const { name, count, unit, category, image_url } = await c.req.json()
  await c.env.DB.prepare('INSERT INTO items (name, count, unit, category, image_url) VALUES (?, ?, ?, ?, ?)')
    .bind(name, count, unit, category, image_url || null).run()
  return c.json({ success: true }, 201)
})

app.patch('/api/items/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { bought } = await c.req.json()
  await c.env.DB.prepare('UPDATE items SET bought = ? WHERE id = ?').bind(bought ? 1 : 0, id).run()
  return c.json({ success: true })
})

app.post('/api/images/delete', authMiddleware, async (c) => {
  const { public_id } = await c.req.json()
  if (!public_id || !c.env.CLOUDINARY_API_KEY || !c.env.CLOUDINARY_API_SECRET) {
    return c.json({ success: false, error: 'Missing credentials or public_id' }, 400)
  }

  const timestamp = Math.round(new Date().getTime() / 1000)
  const str = `public_id=${public_id}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`
  const msgUint8 = new TextEncoder().encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8)
  const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_id, timestamp, api_key: c.env.CLOUDINARY_API_KEY, signature })
  })
  
  const data = await res.json() as any
  return c.json({ success: data.result === 'ok' })
})

app.delete('/api/items/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first() as any
  
  if (item && item.image_url && c.env.CLOUDINARY_API_KEY && c.env.CLOUDINARY_API_SECRET) {
    const parts = item.image_url.split('/')
    const fileName = parts.pop()
    const publicId = fileName.split('.')[0]
    
    // If there are folders, we might need them, but Cloudinary upload usually returns just the filename if no folder is specified.
    // However, the current code just takes the last part. Let's stick with that for now as it matches the upload logic.
    
    const timestamp = Math.round(new Date().getTime() / 1000)
    const str = `public_id=${publicId}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`
    const msgUint8 = new TextEncoder().encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8)
    const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUD_NAME}/image/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicId, timestamp, api_key: c.env.CLOUDINARY_API_KEY, signature })
    })
  }

  await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

/**
 * Page Renders
 */

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
      <script src="/js/login.js"></script>
    </div>
  )
})

app.get('/admin', adminMiddleware, (c) => {
  const user = getCookie(c, 'session')
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
      <script dangerouslySetInnerHTML={{ __html: `window.CURRENT_USER = '${user}';` }} />
      <script src="/js/admin.js"></script>
    </div>
  )
})

app.get('/', authMiddleware, (c) => {
  const user = getCookie(c, 'session')
  const role = getCookie(c, 'role')
  
  return c.render(
    <>
      <div class="user-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div>
          <span style="font-weight: 600; color: #333;">👤 {user} さん</span>
          {role === 'admin' && <a href="/admin" style="margin-left: 15px; font-size: 0.9em; color: #6c5ce7; text-decoration: none;">⚙️ 管理者ページ</a>}
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
              <option value="個">個</option><option value="袋">袋</option><option value="本">本</option>
              <option value="パック">パック</option><option value="枚">枚</option><option value="台">台</option>
              <option value="その他">その他</option>
            </select>
            <select id="item-category" class="full-width">
              <option value="dad">父用</option><option value="mom">母用</option>
              <option value="kids">子ども用</option><option value="other">その他</option>
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

      <div id="reset-trigger" style="text-align: center; margin-top: 40px; padding: 20px; color: #aaa; font-size: 0.8em; cursor: pointer; user-select: none;">
        &copy; 2026-03-16 matsutani shinpei. All Rights Reserved.
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        window.APP_CONFIG = {
          cloudName: '${c.env.CLOUD_NAME}',
          uploadPreset: '${c.env.UPLOAD_PRESET}'
        };
      ` }} />
      <script src="/js/main.js"></script>
    </>
  )
})

export default app
