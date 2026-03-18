import { Hono } from 'hono'
import { renderer } from './renderer'
import type { Bindings, Variables } from './types'
import auth from './routes/auth'
import admin from './routes/admin'
import items from './routes/items'

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use(renderer)

// Mount Routes
app.route('/', auth)
app.route('/', admin)
app.route('/', items)

// Debug Route
app.get('/api/check', (c) => c.json({ status: 'ok' }))

export default app
