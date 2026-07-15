export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  
  const passUint8 = new TextEncoder().encode(password)
  const saltUint8 = new TextEncoder().encode(saltHex)
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passUint8,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltUint8,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  )
  
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('pbkdf2_sha256$')) {
    // Fallback to legacy SHA-256 hash for backward compatibility
    const legacyHashed = await legacyHashPassword(password)
    return legacyHashed === storedHash
  }
  
  const parts = storedHash.split('$')
  if (parts.length !== 4) return false
  const [, iterationsStr, saltHex, hashHex] = parts
  const iterations = parseInt(iterationsStr, 10)
  
  const passUint8 = new TextEncoder().encode(password)
  const saltUint8 = new TextEncoder().encode(saltHex)
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passUint8,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltUint8,
      iterations: iterations,
      hash: 'SHA-256'
    },
    baseKey,
    256
  )
  
  const currentHashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return currentHashHex === hashHex
}

async function legacyHashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

