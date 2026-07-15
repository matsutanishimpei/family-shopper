import { getSignedCookie } from 'hono/cookie'
import type { Context, Next } from 'hono'
import type { Bindings, Variables } from '../types'

const getCookieSecret = (c: Context<{ Bindings: Bindings, Variables: any }>) => {
  return c.env.COOKIE_SECRET || 'default-secure-cookie-secret-fallback-key-2026'
}

export const authMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
  const secret = getCookieSecret(c)
  const session = await getSignedCookie(c, secret, 'session')
  const familyIdFromCookie = await getSignedCookie(c, secret, 'family_id')
  
  const isAuthenticated = typeof session === 'string' && session.length > 0
  
  if (!isAuthenticated && !c.req.path.startsWith('/login') && c.req.path !== '/api/login' && c.req.path !== '/api/register-family') {
    return c.redirect('/login')
  }
  
  if (isAuthenticated && typeof familyIdFromCookie === 'string') {
    c.set('family_id', parseInt(familyIdFromCookie, 10))
  }
  
  await next()
}

export const adminMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
  const secret = getCookieSecret(c)
  const role = await getSignedCookie(c, secret, 'role')
  if (role !== 'admin') {
    return c.text('Forbidden', 403)
  }
  await next()
}

