/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.1 compliance
 * Required for all OAuth clients as of 2025
 */

/**
 * Generate a cryptographically random string
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues)
    .map(v => charset[v % charset.length])
    .join('')
}

/**
 * Base64 URL encoding (no padding)
 */
function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * SHA-256 hash function
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return await crypto.subtle.digest('SHA-256', data)
}

/**
 * Generate PKCE challenge and verifier pair
 * @returns Object containing the verifier and challenge
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
 * Verify PKCE challenge
 * Used server-side to validate the code exchange
 */
export async function verifyPKCE(
  verifier: string,
  challenge: string
): Promise<boolean> {
  const hashed = await sha256(verifier)
  const computedChallenge = base64URLEncode(hashed)
  return computedChallenge === challenge
}

/**
 * Store PKCE verifier securely in browser
 */
export function storePKCEVerifier(verifier: string): void {
  // Use sessionStorage for single-session security
  // The verifier should be cleared after use
  sessionStorage.setItem('pkce_verifier', verifier)
}

/**
 * Retrieve and clear PKCE verifier
 */
export function retrievePKCEVerifier(): string | null {
  const verifier = sessionStorage.getItem('pkce_verifier')
  if (verifier) {
    sessionStorage.removeItem('pkce_verifier')
  }
  return verifier
}

/**
 * Generate a secure state parameter for OAuth flow
 * Prevents CSRF attacks
 */
export function generateState(): string {
  return generateRandomString(32)
}

/**
 * Store OAuth state for verification
 */
export function storeOAuthState(state: string): void {
  sessionStorage.setItem('oauth_state', state)
}

/**
 * Verify and clear OAuth state
 */
export function verifyOAuthState(state: string): boolean {
  const storedState = sessionStorage.getItem('oauth_state')
  if (storedState) {
    sessionStorage.removeItem('oauth_state')
    return storedState === state
  }
  return false
}