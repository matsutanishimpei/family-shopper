import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { ShoppingList } from '../components/ShoppingList'
import { authMiddleware } from '../lib/middleware'
import type { Bindings, Variables, Item, Family, CloudinaryResponse } from '../types'

const items = new Hono<{ Bindings: Bindings, Variables: Variables }>()

items.use('*', authMiddleware)

items.get('/', async (c) => {
  const user = getCookie(c, 'session')!
  const role = getCookie(c, 'role')!

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
  const familyId = c.get('family_id')
  await c.env.DB.prepare('INSERT INTO items (name, count, unit, category, image_url, family_id) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, count, unit, category, image_url || null, familyId).run()
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
    return c.json({ success: false, error: 'Missing credentials' }, 400)
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
