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
