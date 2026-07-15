import { Hono } from 'hono'
import { getSignedCookie } from 'hono/cookie'
import { ShoppingList } from '../components/ShoppingList'
import { authMiddleware } from '../lib/middleware'
import type { Bindings, Variables, Item, Family, CloudinaryResponse } from '../types'

const items = new Hono<{ Bindings: Bindings, Variables: Variables }>()

const getCookieSecret = (c: any) => {
  return c.env.COOKIE_SECRET || 'default-secure-cookie-secret-fallback-key-2026'
}

items.use('*', authMiddleware)

items.get('/', async (c) => {
  const secret = getCookieSecret(c)
  const user = (await getSignedCookie(c, secret, 'session')) || ''
  const role = (await getSignedCookie(c, secret, 'role')) || ''

  if (user === c.env.ADMIN_USER && role === 'admin') {
    return c.redirect('/admin')
  }

  const familyId = c.get('family_id')
  const family = await c.env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first<Family>()

  return c.render(
    <ShoppingList 
      familyName={family?.name || ''} 
      user={user} 
      role={role} 
      cloudName={c.env.CLOUD_NAME} 
      uploadPreset={c.env.UPLOAD_PRESET} 
    />
  )
})

items.get('/api/items', async (c) => {
  const familyId = c.get('family_id')
  const { results } = await c.env.DB.prepare('SELECT * FROM items WHERE family_id = ? ORDER BY created_at DESC').bind(familyId).all<Item>()
  return c.json(results || [])
})

items.post('/api/items', async (c) => {
  const { name, count, unit, category, image_url } = await c.req.json()
  
  // Validation
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return c.json({ success: false, error: '商品名は必須です。' }, 400)
  }
  if (name.length > 100) {
    return c.json({ success: false, error: '商品名は100文字以内で入力してください。' }, 400)
  }
  const parsedCount = parseInt(count, 10)
  if (isNaN(parsedCount) || parsedCount <= 0) {
    return c.json({ success: false, error: '個数は1以上の数値で指定してください。' }, 400)
  }
  if (unit && (typeof unit !== 'string' || unit.length > 20)) {
    return c.json({ success: false, error: '単位は20文字以内で入力してください。' }, 400)
  }
  const validCategories = ['dad', 'mom', 'kids', 'other']
  if (!validCategories.includes(category)) {
    return c.json({ success: false, error: '無効なカテゴリです。' }, 400)
  }

  const familyId = c.get('family_id')
  await c.env.DB.prepare('INSERT INTO items (name, count, unit, category, image_url, family_id) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, parsedCount, unit || '個', category, image_url || null, familyId).run()
  return c.json({ success: true }, 201)
})

items.patch('/api/items/:id', async (c) => {
  const id = c.req.param('id')
  const { bought } = await c.req.json()
  const familyId = c.get('family_id')
  await c.env.DB.prepare('UPDATE items SET bought = ? WHERE id = ? AND family_id = ?').bind(bought ? 1 : 0, id, familyId).run()
  return c.json({ success: true })
})

items.post('/api/images/delete', async (c) => {
  const { public_id } = await c.req.json()
  if (!public_id || !c.env.CLOUDINARY_API_KEY || !c.env.CLOUDINARY_API_SECRET) {
    return c.json({ success: false, error: '認証情報または画像IDが不足しています。' }, 400)
  }

  // Prevent unauthorized image deletion (Verify image belongs to this family)
  const familyId = c.get('family_id')
  const item = await c.env.DB.prepare('SELECT id FROM items WHERE family_id = ? AND image_url LIKE ?')
    .bind(familyId, `%/${public_id}.%`)
    .first<Item>()
  if (!item) {
    return c.json({ success: false, error: 'この画像を削除する権限がありません。' }, 403)
  }

  const timestamp = Math.round(new Date().getTime() / 1000)
  const str = `public_id=${public_id}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`
  const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)))).map(b => b.toString(16).padStart(2, '0')).join('')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_id, timestamp, api_key: c.env.CLOUDINARY_API_KEY, signature })
  })
  const data = await res.json<CloudinaryResponse>()
  return c.json({ success: data.result === 'ok' })
})

items.delete('/api/items/:id', async (c) => {
  const id = c.req.param('id')
  const familyId = c.get('family_id')
  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ? AND family_id = ?').bind(id, familyId).first<Item>()
  
  if (item && item.image_url && c.env.CLOUDINARY_API_KEY && c.env.CLOUDINARY_API_SECRET) {
    const parts = item.image_url.split('/')
    const fileName = parts.pop()
    if (fileName) {
      const publicId = fileName.split('.')[0]
      const timestamp = Math.round(new Date().getTime() / 1000)
      const str = `public_id=${publicId}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`
      const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)))).map(b => b.toString(16).padStart(2, '0')).join('')

      await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUD_NAME}/image/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: publicId, timestamp, api_key: c.env.CLOUDINARY_API_KEY, signature })
      })
    }
  }

  await c.env.DB.prepare('DELETE FROM items WHERE id = ? AND family_id = ?').bind(id, familyId).run()
  return c.json({ success: true })
})

export default items

