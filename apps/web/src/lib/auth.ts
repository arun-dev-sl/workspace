import type { AuthTokens } from '@/types/auth'

export const AUTH_TOKENS_CHANGED_EVENT = 'auth:tokens-changed'

/**
 * Auth routes that need to set cookies
 * These routes use route handlers, not proxy
 */
export const AUTH_WRITE_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh-token',
  '/api/auth/register',
  '/api/auth/webauthn/register/verify',
  '/api/auth/webauthn/login/verify',
] as const

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

/**
 * Store auth tokens in localStorage (client only)
 */
export function setStoredTokens(tokens: AuthTokens) {
  if (globalThis.window === undefined) {
    return
  }

  globalThis.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  globalThis.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  globalThis.dispatchEvent(new Event(AUTH_TOKENS_CHANGED_EVENT))
}

/**
 * Read auth tokens from localStorage (client only)
 */
export function getStoredTokens(): AuthTokens | null {
  if (globalThis.window === undefined) {
    return null
  }

  const accessToken = globalThis.localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = globalThis.localStorage.getItem(REFRESH_TOKEN_KEY)

  if (!accessToken || !refreshToken) {
    return null
  }

  return { accessToken, refreshToken }
}

export function getAccessToken(): string | null {
  return getStoredTokens()?.accessToken ?? null
}

export function getRefreshToken(): string | null {
  return getStoredTokens()?.refreshToken ?? null
}

/**
 * Clear auth tokens from localStorage (client only)
 */
export function clearStoredTokens() {
  if (globalThis.window === undefined) {
    return
  }

  globalThis.localStorage.removeItem(ACCESS_TOKEN_KEY)
  globalThis.localStorage.removeItem(REFRESH_TOKEN_KEY)
  globalThis.dispatchEvent(new Event(AUTH_TOKENS_CHANGED_EVENT))
}
