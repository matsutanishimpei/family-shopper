export type Bindings = {
  DB: D1Database
  CLOUD_NAME: string
  UPLOAD_PRESET: string
  ADMIN_USER: string
  ADMIN_PASS: string
  CLOUDINARY_API_KEY?: string
  CLOUDINARY_API_SECRET?: string
}

export type Variables = {
  family_id: number
}

export interface Family {
  id: number
  name: string
  created_at?: string
}

export interface User {
  id: number
  username: string
  password_hash: string
  role: 'admin' | 'member'
  family_id: number
  created_at?: string
}

export interface Item {
  id: number
  name: string
  count: number
  unit: string
  bought: number
  category: string
  image_url: string | null
  family_id: number
  created_at?: string
}

export interface CloudinaryResponse {
  result: 'ok' | 'error'
  [key: string]: any
}
