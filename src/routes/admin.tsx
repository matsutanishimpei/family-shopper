import { Hono } from 'hono'
import { getSignedCookie } from 'hono/cookie'
import { AdminPage } from '../components/AdminPage'
import { authMiddleware, adminMiddleware } from '../lib/middleware'
import { hashPassword } from '../lib/utils'
import type { Bindings, Variables, Family, User } from '../types'

const admin = new Hono<{ Bindings: Bindings, Variables: Variables }>()

const getCookieSecret = (c: any) => {
  return c.env.COOKIE_SECRET || 'default-secure-cookie-secret-fallback-key-2026'
}

admin.use('/admin', authMiddleware, adminMiddleware)
admin.use('/api/admin/*', authMiddleware, adminMiddleware)

admin.get('/admin', async (c) => {
  const secret = getCookieSecret(c)
  const user = (await getSignedCookie(c, secret, 'session')) || ''
  const familyId = c.get('family_id')
  const family = await c.env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first<Family>()
  return c.render(<AdminPage familyName={family?.name || ''} user={user} />)
})

admin.get('/api/admin/users', async (c) => {
  const secret = getCookieSecret(c)
  const session = await getSignedCookie(c, secret, 'session')
  if (session === c.env.ADMIN_USER) {
    const users = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.role, f.name as family_name 
      FROM users u 
      LEFT JOIN families f ON u.family_id = f.id
    `).all()
    return c.json(users.results || [])
  } else {
    const familyId = c.get('family_id')
    const users = await c.env.DB.prepare('SELECT id, username, role FROM users WHERE family_id = ?').bind(familyId).all()
    return c.json(users.results || [])
  }
})

admin.post('/api/admin/users', async (c) => {
  const { username, password } = await c.req.json()
  
  if (!username || typeof username !== 'string' || username.trim() === '') {
    return c.json({ success: false, error: 'ユーザー名は必須項目です。' }, 400)
  }
  if (username.length > 50) {
    return c.json({ success: false, error: 'ユーザー名は50文字以内で入力してください。' }, 400)
  }
  if (!password || typeof password !== 'string' || password.length < 4) {
    return c.json({ success: false, error: 'パスワードは4文字以上で指定してください。' }, 400)
  }

  const familyId = c.get('family_id')
  const hashed = await hashPassword(password)
  
  try {
    await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, ?)')
      .bind(username, hashed, 'member', familyId).run()
    return c.json({ success: true })
  } catch (dbErr: any) {
    if (dbErr.message && dbErr.message.includes('UNIQUE constraint failed')) {
      return c.json({ success: false, error: 'このユーザー名はすでにこの家族に登録されています。' }, 400)
    }
    console.error('Failed to create user:', dbErr)
    return c.json({ success: false, error: 'ユーザーの登録に失敗しました。' }, 500)
  }
})

admin.delete('/api/admin/users/:id', async (c) => {
  const id = c.req.param('id')
  const secret = getCookieSecret(c)
  const session = await getSignedCookie(c, secret, 'session')
  if (session === c.env.ADMIN_USER) {
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  } else {
    const familyId = c.get('family_id')
    await c.env.DB.prepare('DELETE FROM users WHERE id = ? AND family_id = ?').bind(id, familyId).run()
  }
  return c.json({ success: true })
})

export default admin

