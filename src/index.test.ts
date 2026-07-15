import { describe, it, expect } from 'vitest'
import { renderer } from './renderer'
import { hashPassword, verifyPassword } from './lib/utils'

describe('Renderer', () => {
  it('should be a function', () => {
    expect(typeof renderer).toBe('function')
  })
})

describe('Password Hashing Utility', () => {
  it('should generate hash starting with pbkdf2_sha256$', async () => {
    const pass = 'super-secret-password-123'
    const hash = await hashPassword(pass)
    expect(hash.startsWith('pbkdf2_sha256$100000$')).toBe(true)
    
    const parts = hash.split('$')
    expect(parts.length).toBe(4)
  })

  it('should verify correct password using new PBKDF2 hash', async () => {
    const pass = 'my-secure-password'
    const hash = await hashPassword(pass)
    const result = await verifyPassword(pass, hash)
    expect(result).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const pass = 'my-secure-password'
    const hash = await hashPassword(pass)
    const result = await verifyPassword('wrong-password', hash)
    expect(result).toBe(false)
  })

  it('should fall back and verify legacy SHA-256 hash for backward compatibility', async () => {
    // Generate legacy SHA-256 hash for 'legacy-pass-456'
    // SHA-256('legacy-pass-456') = "dff06b8e97d6614020f7a144286299344d359e3ae89a17962edb7a7cb648fc7d"
    const legacyHash = 'dff06b8e97d6614020f7a144286299344d359e3ae89a17962edb7a7cb648fc7d'
    const result = await verifyPassword('legacy-pass-456', legacyHash)
    expect(result).toBe(true)
    
    const resultWrong = await verifyPassword('wrong-pass', legacyHash)
    expect(resultWrong).toBe(false)
  })
})

