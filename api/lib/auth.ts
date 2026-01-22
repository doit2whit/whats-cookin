import { SignJWT, jwtVerify } from 'jose'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
const COOKIE_NAME = 'whats-cookin-session'

export interface SessionPayload {
  email: string
  name: string
  role: 'admin' | 'user'
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  )
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`
  )
}

export function getSessionFromRequest(req: VercelRequest): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

export async function getCurrentUser(req: VercelRequest): Promise<SessionPayload | null> {
  const token = getSessionFromRequest(req)
  if (!token) return null
  return verifySession(token)
}

// Middleware helper to require authentication
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<SessionPayload | null> {
  const user = await getCurrentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    return null
  }
  return user
}
