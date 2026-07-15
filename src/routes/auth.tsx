import { Hono } from 'hono'
import { setSignedCookie, deleteCookie } from 'hono/cookie'
import { LoginForm } from '../components/LoginForm'
import { hashPassword, verifyPassword } from '../lib/utils'
import type { Bindings, Variables, Family, User } from '../types'

const auth = new Hono<{ Bindings: Bindings, Variables: Variables }>()

const getCookieSecret = (c: any) => {
  return c.env.COOKIE_SECRET || 'default-secure-cookie-secret-fallback-key-2026'
}

auth.get('/login', (c) => c.render(<LoginForm />))

auth.post('/api/login', async (c) => {
  const { familyName, username, password } = await c.req.json()
  
  if (!username || typeof username !== 'string' || username.trim() === '') {
    return c.json({ success: false, error: 'ユーザー名は必須です。' }, 400)
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    return c.json({ success: false, error: 'パスワードは必須です。' }, 400)
  }

  let familyId = 0
  let authenticated = false
  let role = 'member'

  if (familyName) {
    const family = await c.env.DB.prepare('SELECT id FROM families WHERE name = ?').bind(familyName).first<Family>()
    if (family) {
      familyId = family.id
    }
  }

  if (familyId > 0) {
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND family_id = ?').bind(username, familyId).first<User>()
    if (user) {
      const match = await verifyPassword(password, user.password_hash)
      if (match) {
        authenticated = true
        role = user.role
      }
    }
  }

  if (!authenticated && username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    authenticated = true
    role = 'admin'
    familyId = 1
    
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND family_id = 1').bind(username).first<User>()
    if (!existing) {
      const hashed = await hashPassword(password)
      await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, 1)')
        .bind(username, hashed, 'admin').run()
    }
  }

  if (authenticated) {
    const secret = getCookieSecret(c)
    await setSignedCookie(c, 'session', username, secret, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    await setSignedCookie(c, 'family_id', familyId.toString(), secret, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    await setSignedCookie(c, 'role', role, secret, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
    return c.json({ success: true, role, isSuperAdmin: username === c.env.ADMIN_USER })
  }
  
  return c.json({ success: false, error: '家族名、ユーザー名、またはパスワードが正しくありません。' }, 401)
})

auth.post('/api/register-family', async (c) => {
  try {
    const { familyName, username, password } = await c.req.json()
    
    if (!familyName || typeof familyName !== 'string' || familyName.trim() === '') {
      return c.json({ success: false, error: '家族名は必須項目です。' }, 400)
    }
    if (familyName.length > 50) {
      return c.json({ success: false, error: '家族名は50文字以内で入力してください。' }, 400)
    }
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return c.json({ success: false, error: '管理者名は必須項目です。' }, 400)
    }
    if (username.length > 50) {
      return c.json({ success: false, error: '管理者名は50文字以内で入力してください。' }, 400)
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      return c.json({ success: false, error: 'パスワードは4文字以上で指定してください。' }, 400)
    }

    // Insert family
    let familyId: number
    try {
      const result = await c.env.DB.prepare('INSERT INTO families (name) VALUES (?) RETURNING id')
        .bind(familyName)
        .first<Family>()
      if (!result || !result.id) {
        throw new Error('Failed to retrieve family ID')
      }
      familyId = result.id
    } catch (dbErr: any) {
      if (dbErr.message && dbErr.message.includes('UNIQUE constraint failed')) {
        return c.json({ success: false, error: 'この家族名はすでに使われています。別の名前を指定してください。' }, 400)
      }
      throw dbErr
    }

    const hashed = await hashPassword(password)
    await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, ?)')
      .bind(username, hashed, 'admin', familyId).run()

    return c.json({ success: true, familyId })
  } catch (err: unknown) {
    console.error('Family registration failed:', err)
    return c.json({ success: false, error: 'システムエラーが発生しました。時間を置いて再度お試しください。' }, 500)
  }
})

auth.post('/api/logout', (c) => {
  deleteCookie(c, 'session')
  deleteCookie(c, 'role')
  deleteCookie(c, 'family_id')
  return c.json({ success: true })
})

export default auth

