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

type Variables = {
  family_id: number
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use(renderer)

// Helper: Hash password
async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Middleware: Check Session and Family context
const authMiddleware = async (c: any, next: any) => {
  const session = getCookie(c, 'session')
  const familyIdFromCookie = getCookie(c, 'family_id')
  
  if (!session && !c.req.path.startsWith('/login') && c.req.path !== '/api/login' && c.req.path !== '/api/register-family') {
    return c.redirect('/login')
  }
  
  if (session && familyIdFromCookie) {
    c.set('family_id', parseInt(familyIdFromCookie))
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
  const { familyName, username, password } = await c.req.json()
  
  let familyId = 0
  let authenticated = false
  let role = 'member'

  // 1. 家族を特定
  if (familyName) {
    const family = await c.env.DB.prepare('SELECT id FROM families WHERE name = ?').bind(familyName).first() as any
    if (family) {
      familyId = family.id
    }
  }

  // 2. 認証処理
  if (familyId > 0) {
    // 一般ユーザーの検索
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND family_id = ?').bind(username, familyId).first() as any
    if (user) {
      const hashed = await hashPassword(password)
      if (user.password_hash === hashed) {
        authenticated = true
        role = user.role
      }
    }
  }

  // 3. システム管理者のフォールバック
  if (!authenticated && username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    // 家族名が空、または Default Family 指定、またはシステム管理者情報が一致
    authenticated = true
    role = 'admin'
    familyId = 1 // Default Family
    
    // 初回のみ管理者ユーザーを作成
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND family_id = 1').bind(username).first() as any
    if (!existing) {
      const hashed = await hashPassword(password)
      await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, 1)')
        .bind(username, hashed, 'admin').run()
    }
  }

  if (authenticated) {
    setCookie(c, 'session', username, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    setCookie(c, 'family_id', familyId.toString(), { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    setCookie(c, 'role', role, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    return c.json({ success: true, role })
  }
  
  return c.json({ success: false, error: 'Invalid credentials or family name' }, 401)
})

// Debug Route
app.get('/api/check', (c) => c.json({ status: 'ok' }))

// Family Registration API
app.post('/api/register-family', async (c) => {
  try {
    const { familyName, username, password } = await c.req.json()
    
    if (!familyName || !username || !password) {
      return c.json({ success: false, error: 'Missing required fields' }, 400)
    }

    // 1. 家族を登録
    const result = await c.env.DB.prepare('INSERT INTO families (name) VALUES (?) RETURNING id')
      .bind(familyName)
      .first() as { id: number } | null
    
    if (!result || !result.id) {
      throw new Error('Failed to create family record')
    }
    const familyId = result.id

    // 2. その家族の管理者ユーザーを登録
    const hashed = await hashPassword(password)
    await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, ?)')
      .bind(username, hashed, 'admin', familyId).run()

    return c.json({ success: true, familyId })
  } catch (err: any) {
    console.error('Registration Error:', err)
    return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500)
  }
})

// Logout API
app.post('/api/logout', (c) => {
  deleteCookie(c, 'session'); deleteCookie(c, 'role'); deleteCookie(c, 'family_id')
  return c.json({ success: true })
})

// User Management API
app.get('/api/admin/users', adminMiddleware, authMiddleware, async (c) => {
  const session = getCookie(c, 'session')
  if (session === c.env.ADMIN_USER) {
    // Super Admin: get all users from all families
    const users = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.role, f.name as family_name 
      FROM users u 
      LEFT JOIN families f ON u.family_id = f.id
    `).all()
    return c.json(users.results || [])
  } else {
    // Family Admin: get users from current family
    const familyId = c.get('family_id')
    const users = await c.env.DB.prepare('SELECT id, username, role FROM users WHERE family_id = ?').bind(familyId).all()
    return c.json(users.results || [])
  }
})

app.post('/api/admin/users', adminMiddleware, authMiddleware, async (c) => {
  const { username, password } = await c.req.json()
  const familyId = c.get('family_id')
  const hashed = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, ?)')
    .bind(username, hashed, 'member', familyId).run()
  return c.json({ success: true })
})

app.delete('/api/admin/users/:id', adminMiddleware, authMiddleware, async (c) => {
  const id = c.req.param('id')
  const session = getCookie(c, 'session')
  if (session === c.env.ADMIN_USER) {
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  } else {
    const familyId = c.get('family_id')
    await c.env.DB.prepare('DELETE FROM users WHERE id = ? AND family_id = ?').bind(id, familyId).run()
  }
  return c.json({ success: true })
})

// Item Management API
app.get('/api/items', authMiddleware, async (c) => {
  const familyId = c.get('family_id')
  const { results } = await c.env.DB.prepare('SELECT * FROM items WHERE family_id = ? ORDER BY created_at DESC').bind(familyId).all()
  return c.json(results || [])
})

app.post('/api/items', authMiddleware, async (c) => {
  const { name, count, unit, category, image_url } = await c.req.json()
  const familyId = c.get('family_id')
  await c.env.DB.prepare('INSERT INTO items (name, count, unit, category, image_url, family_id) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, count, unit, category, image_url || null, familyId).run()
  return c.json({ success: true }, 201)
})

app.patch('/api/items/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { bought } = await c.req.json()
  const familyId = c.get('family_id')
  await c.env.DB.prepare('UPDATE items SET bought = ? WHERE id = ? AND family_id = ?').bind(bought ? 1 : 0, id, familyId).run()
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
  const familyId = c.get('family_id')
  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ? AND family_id = ?').bind(id, familyId).first() as any
  
  if (item && item.image_url && c.env.CLOUDINARY_API_KEY && c.env.CLOUDINARY_API_SECRET) {
    const parts = item.image_url.split('/')
    const fileName = parts.pop()
    const publicId = fileName.split('.')[0]
    
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

  await c.env.DB.prepare('DELETE FROM items WHERE id = ? AND family_id = ?').bind(id, familyId).run()
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
          <input type="text" id="family-name" placeholder="家族の名前（空欄で管理者ログイン）" class="full-width" style="margin-bottom: 10px;" />
          <input type="text" id="username" placeholder="ユーザー名" required class="full-width" style="margin-bottom: 10px;" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck={false} />
          <input type="password" id="password" placeholder="パスワード" required class="full-width" style="margin-bottom: 10px;" />
        </div>
        <button type="submit" class="primary full-width">ログイン</button>
      </form>
      <div style="margin-top: 20px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
        <a href="#" id="show-register" style="font-size: 0.9em; color: #6c5ce7; text-decoration: none;">新しい家族（グループ）を作成する</a>
        <form id="register-family-form" style="display: none; margin-top: 15px; text-align: left;">
          <h2 style="font-size: 1em; margin-bottom: 10px;">新規家族登録</h2>
          <input type="text" id="reg-family-name" placeholder="家族の名前（例：松谷家）" required class="full-width" style="margin-bottom: 10px;" />
          <input type="text" id="reg-username" placeholder="管理者名（英字推奨）" required class="full-width" style="margin-bottom: 10px;" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck={false} />
          <input type="password" id="reg-password" placeholder="パスワード" required class="full-width" style="margin-bottom: 10px;" />
          <button type="submit" class="full-width" style="background: #6c5ce7; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">登録して開始</button>
        </form>
      </div>
      <script src="/static/js/login.js"></script>
    </div>
  )
})

app.get('/admin', adminMiddleware, authMiddleware, async (c) => {
  const user = getCookie(c, 'session')
  const familyId = c.get('family_id')
  const family = await c.env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first() as any
  
  return c.render(
    <div class="admin-page">
      <div class="card">
        <h1>{family?.name || '家族'} 管理設定</h1>
        <p><a href="/">← メインページへ戻る</a></p>
        <section style="margin-top: 20px;">
          <h2>家族ユーザー管理</h2>
          <form id="user-form" class="input-group">
            <input type="text" id="new-username" placeholder="名前" required inputmode="email" autocapitalize="none" autocorrect="off" spellcheck={false} />
            <input type="password" id="new-password" placeholder="パスワード" required />
            <button type="submit" class="primary">追加</button>
          </form>
          <ul id="user-list" class="item-list" style="margin-top: 10px;"></ul>
        </section>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.CURRENT_USER = '${user}';` }} />
      <script src="/static/js/admin.js"></script>
    </div>
  )
})

app.get('/', authMiddleware, async (c) => {
  const user = getCookie(c, 'session')
  const role = getCookie(c, 'role')

  // システム管理者は管理画面へ強制リダイレクト
  if (user === c.env.ADMIN_USER && role === 'admin') {
    return c.redirect('/admin')
  }

  const familyId = c.get('family_id')
  
  // 家族名を取得
  const family = await c.env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first() as any

  return c.render(
    <>
      <div class="user-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div>
          <span style="font-weight: 600; color: #333;">🏠 {family?.name || '家族'} / 👤 {user} さん</span>
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
      <script src="/static/js/main.js"></script>
    </>
  )
})

export default app
