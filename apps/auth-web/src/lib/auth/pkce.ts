/**
 * PKCE (Proof Key for Code Exchange) utilities
 * OAuth 2.1 compliant implementation
 */

/**
 * Generate a random string for use as code verifier
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], '')
}

/**
 * SHA-256 hash function for browser
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest('SHA-256', data as BufferSource)
}

/**
 * Base64 URL encode without padding
 */
function base64URLEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)
  let str = ''
  for (const byte of bytes) {
    str += String.fromCharCode(byte)
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate PKCE challenge and verifier pair
 * @returns {Promise<{verifier: string, challenge: string, method: 'S256'}>}
 */
export async function generatePKCE(): Promise<{
  verifier: string
  challenge: string
  method: 'S256'
}> {
  // Generate code verifier (43-128 characters)
  const verifier = generateRandomString(64)
  
  // Generate code challenge using SHA-256
  const hashed = await sha256(verifier)
  const challenge = base64URLEncode(hashed)
  
  return {
    verifier,
    challenge,
    method: 'S256'
  }
}

/**
 * Store PKCE verifier in session storage
 * @param authCode - The auth code to associate with the verifier
 * @param verifier - The PKCE code verifier
 */
export function storePKCEVerifier(authCode: string, verifier: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const key = `pkce_verifier_${authCode}`
    sessionStorage.setItem(key, verifier)
    
    // Set expiration for 10 minutes
    const expirationKey = `${key}_expiration`
    const expirationTime = Date.now() + (10 * 60 * 1000)
    sessionStorage.setItem(expirationKey, expirationTime.toString())
  }
}

/**
 * Retrieve PKCE verifier from session storage
 * @param authCode - The auth code to retrieve the verifier for
 * @returns The PKCE verifier or null if not found/expired
 */
export function getPKCEVerifier(authCode: string): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null
  }
  
  const key = `pkce_verifier_${authCode}`
  const expirationKey = `${key}_expiration`
  
  const expiration = sessionStorage.getItem(expirationKey)
  if (!expiration || parseInt(expiration) < Date.now()) {
    // Clean up expired data
    sessionStorage.removeItem(key)
    sessionStorage.removeItem(expirationKey)
    return null
  }
  
  return sessionStorage.getItem(key)
}

/**
 * Clear PKCE verifier from session storage
 * @param authCode - The auth code to clear the verifier for
 */
export function clearPKCEVerifier(authCode: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const key = `pkce_verifier_${authCode}`
    const expirationKey = `${key}_expiration`
    sessionStorage.removeItem(key)
    sessionStorage.removeItem(expirationKey)
  }
}