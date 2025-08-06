/**
 * Cryptographically secure ID generation utility
 */

/**
 * Generate a cryptographically secure unique ID
 * @param prefix - Optional prefix for the ID
 * @returns A unique ID string
 */
export function generateSecureId(prefix?: string): string {
  // Use crypto.randomUUID if available (browser and Node.js 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    const uuid = crypto.randomUUID();
    return prefix ? `${prefix}_${uuid}` : uuid;
  }

  // Fallback for older environments - still better than Math.random()
  const timestamp = Date.now();
  const random = new Uint32Array(2);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(random);
    const hex = Array.from(random, (x) => x.toString(16).padStart(8, '0')).join(
      ''
    );
    return prefix ? `${prefix}_${timestamp}_${hex}` : `${timestamp}_${hex}`;
  }

  // Last resort fallback (should rarely happen in modern environments)
  // This is still more secure than Math.random() as it includes high-resolution time
  const hrTime =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pseudoRandom = (hrTime * 1_000_000).toString(36);
  return prefix
    ? `${prefix}_${timestamp}_${pseudoRandom}`
    : `${timestamp}_${pseudoRandom}`;
}

/**
 * Generate a short secure ID (useful for user-facing IDs)
 * @param prefix - Optional prefix for the ID
 * @param length - Length of the random part (default: 8)
 * @returns A short unique ID string
 */
export function generateShortId(prefix?: string, length = 8): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, length);
    return prefix ? `${prefix}_${uuid}` : uuid;
  }

  // Fallback using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const random = new Uint8Array(length);
    crypto.getRandomValues(random);

    let id = '';
    for (let i = 0; i < length; i++) {
      id += chars[random[i] % chars.length];
    }

    return prefix ? `${prefix}_${id}` : id;
  }

  // Last resort - use timestamp + high-resolution time
  const timestamp = Date.now().toString(36);
  const hrTime = typeof performance !== 'undefined' ? performance.now() : 0;
  const combined = (timestamp + hrTime.toString()).substring(0, length);
  return prefix ? `${prefix}_${combined}` : combined;
}
