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

// ============ GOOGLE OAUTH ============
function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/auth/callback`

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

function getAuthUrl(): string {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    prompt: 'select_account',
  })
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
  const { action, code } = req.query

  // GET /api/auth?action=login - Redirect to Google OAuth
  if (req.method === 'GET' && action === 'login') {
    try {
      const authUrl = getAuthUrl()
      return res.redirect(302, authUrl)
    } catch (error) {
      console.error('Login redirect error:', error)
      return res.status(500).json({ error: 'Failed to initiate login' })
    }
  }

  // GET /api/auth?action=callback - Handle Google OAuth callback
  if (req.method === 'GET' && action === 'callback') {
    try {
      if (!code || typeof code !== 'string') {
        return res.redirect('/?error=missing_code')
      }

      const oauth2Client = getOAuthClient()
      const { tokens } = await oauth2Client.getToken(code)

      if (!tokens.access_token) {
        return res.redirect('/?error=no_access_token')
      }

      const userInfo = await getGoogleUserInfo(tokens.access_token)

      // Check if user is allowed
      const rows = await getRows('AllowedUsers')
      const allowedUser = rows.slice(1).find(row => row[0]?.toLowerCase() === userInfo.email.toLowerCase())

      if (!allowedUser) {
        return res.redirect('/?error=unauthorized')
      }

      const sessionPayload: SessionPayload = {
        email: userInfo.email,
        name: allowedUser[1] || userInfo.name,
        role: (allowedUser[2] as 'admin' | 'user') || 'user',
      }

      const token = await createSession(sessionPayload)
      setSessionCookie(res, token)

      return res.redirect('/')
    } catch (error) {
      console.error('OAuth callback error:', error)
      return res.redirect('/?error=auth_failed')
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
