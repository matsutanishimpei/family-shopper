import { getCookie } from 'hono/cookie'
import type { Context, Next } from 'hono'
import type { Bindings, Variables } from '../types'

export const authMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
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

export const adminMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
  const role = getCookie(c, 'role')
  if (role !== 'admin') {
    return c.text('Forbidden', 403)
  }
  await next()
}
