import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { LoginForm } from '../components/LoginForm'
import { hashPassword } from '../lib/utils'
import type { Bindings, Variables } from '../types'

const auth = new Hono<{ Bindings: Bindings, Variables: Variables }>()

auth.get('/login', (c) => c.render(<LoginForm />))

auth.post('/api/login', async (c) => {
  const { familyName, username, password } = await c.req.json()
  
  let familyId = 0
  let authenticated = false
  let role = 'member'

  if (familyName) {
    const family = await c.env.DB.prepare('SELECT id FROM families WHERE name = ?').bind(familyName).first() as any
    if (family) {
      familyId = family.id
    }
  }

  if (familyId > 0) {
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND family_id = ?').bind(username, familyId).first() as any
    if (user) {
      const hashed = await hashPassword(password)
      if (user.password_hash === hashed) {
        authenticated = true
        role = user.role
      }
    }
  }

  if (!authenticated && username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    authenticated = true
    role = 'admin'
    familyId = 1
    
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

auth.post('/api/register-family', async (c) => {
  try {
    const { familyName, username, password } = await c.req.json()
    if (!familyName || !username || !password) {
      return c.json({ success: false, error: 'Missing required fields' }, 400)
    }

    const result = await c.env.DB.prepare('INSERT INTO families (name) VALUES (?) RETURNING id')
      .bind(familyName)
      .first() as { id: number } | null
    
    if (!result || !result.id) throw new Error('Failed to create family record')
    const familyId = result.id
    const hashed = await hashPassword(password)
    await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, family_id) VALUES (?, ?, ?, ?)')
      .bind(username, hashed, 'admin', familyId).run()

    return c.json({ success: true, familyId })
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500)
  }
})

auth.post('/api/logout', (c) => {
  deleteCookie(c, 'session'); deleteCookie(c, 'role'); deleteCookie(c, 'family_id')
  return c.json({ success: true })
})

export default auth
