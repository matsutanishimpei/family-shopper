import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { AdminPage } from '../components/AdminPage'
import { authMiddleware, adminMiddleware } from '../lib/middleware'
import { hashPassword } from '../lib/utils'
import type { Bindings, Variables, Family, User } from '../types'

const admin = new Hono<{ Bindings: Bindings, Variables: Variables }>()

admin.use('/admin', authMiddleware, adminMiddleware)
admin.use('/api/admin/*', authMiddleware, adminMiddleware)

admin.get('/admin', async (c) => {
  const user = getCookie(c, 'session')!
  const familyId = c.get('family_id')
  const family = await c.env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first<Family>()
  return c.render(<AdminPage familyName={family?.name || ''} user={user} />)
})

admin.get('/api/admin/users', async (c) => {
  const session = getCookie(c, 'session')
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
  const familyId = c.get('family_id')
  const hashed = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, ?)')
    .bind(username, hashed, 'member', familyId).run()
  return c.json({ success: true })
})

admin.delete('/api/admin/users/:id', async (c) => {
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

export default admin
