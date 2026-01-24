import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SignJWT, jwtVerify } from 'jose'
import { google } from 'googleapis'

// ============ SHEETS HELPERS (INLINED) ============
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    throw new Error('Missing Google service account credentials')
  }
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: SCOPES,
  })
}

function getSheets() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID
  if (!id) throw new Error('Missing GOOGLE_SPREADSHEET_ID environment variable')
  return id
}

async function getRows(sheetName: string): Promise<string[][]> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  })
  return response.data.values || []
}

// ============ AUTH HELPERS ============
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
const COOKIE_NAME = 'whats-cookin-session'

interface SessionPayload {
  email: string
  name: string
  role: 'admin' | 'user'
}

async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
  return token
}

async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

function setSessionCookie(res: VercelResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  )
}

function clearSessionCookie(res: VercelResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`)
}

function getSessionFromRequest(req: VercelRequest): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

async function getCurrentUser(req: VercelRequest): Promise<SessionPayload | null> {
  const token = getSessionFromRequest(req)
  if (!token) return null
  return verifySession(token)
}

interface GoogleUserInfo {
  email: string
  name: string
  picture?: string
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error('Failed to get user info from Google')
  }
  return response.json()
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query

  // POST /api/auth?action=login
  if (req.method === 'POST' && action === 'login') {
    try {
      const { credential } = req.body
      if (!credential) {
        return res.status(400).json({ error: 'Missing credential' })
      }

      const userInfo = await getGoogleUserInfo(credential)
      const rows = await getRows('AllowedUsers')
      const allowedUser = rows.slice(1).find(row => row[0]?.toLowerCase() === userInfo.email.toLowerCase())

      if (!allowedUser) {
        return res.status(403).json({
          error: 'Access denied. Your account is not authorized to use this application.',
          code: 'UNAUTHORIZED',
        })
      }

      const sessionPayload: SessionPayload = {
        email: userInfo.email,
        name: allowedUser[1] || userInfo.name,
        role: (allowedUser[2] as 'admin' | 'user') || 'user',
      }

      const token = await createSession(sessionPayload)
      setSessionCookie(res, token)
      return res.status(200).json({ user: sessionPayload })
    } catch (error) {
      console.error('Login error:', error)
      return res.status(500).json({ error: 'Login failed', code: 'SHEETS_ERROR' })
    }
  }

  // POST /api/auth?action=logout
  if (req.method === 'POST' && action === 'logout') {
    clearSessionCookie(res)
    return res.status(200).json({ success: true })
  }

  // GET /api/auth?action=session
  if (req.method === 'GET' && action === 'session') {
    try {
      const user = await getCurrentUser(req)
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' })
      }
      return res.status(200).json({ user })
    } catch (error) {
      console.error('Session check error:', error)
      return res.status(500).json({ error: 'Failed to check session' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
