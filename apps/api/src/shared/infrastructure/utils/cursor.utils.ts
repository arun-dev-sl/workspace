/**
 * Encode an arbitrary JSON-serializable payload as a URL-safe Base64 cursor.
 */
export function encodeCursor<T>(payload: T): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

/**
 * Decode a Base64url cursor back into a typed payload.
 * Returns `null` for invalid/malformed cursors instead of throwing.
 */
export function decodeCursor<T>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}
