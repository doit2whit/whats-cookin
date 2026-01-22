import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { jwtVerify } from 'jose'

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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName })
  return response.data.values || []
}

// ============ AUTH HELPERS (INLINED) ============
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
const COOKIE_NAME = 'whats-cookin-session'

interface SessionPayload { email: string; name: string; role: 'admin' | 'user' }

async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionPayload
  } catch { return null }
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

async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<SessionPayload | null> {
  const user = await getCurrentUser(req)
  if (!user) { res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }); return null }
  return user
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rows = await getRows('CuisineTags')
    const cuisines = rows.slice(1).map(row => row[1]).filter(Boolean).sort()
    return res.status(200).json({ cuisines })
  } catch (error) {
    console.error('Error fetching cuisines:', error)
    const defaultCuisines = [
      'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian',
      'American', 'Mediterranean', 'Korean', 'Vietnamese', 'French',
      'Greek', 'Spanish', 'Middle Eastern', 'Comfort Food', 'Healthy',
      'BBQ', 'Seafood', 'Vegetarian', 'Vegan'
    ]
    return res.status(200).json({ cuisines: defaultCuisines })
  }
}
