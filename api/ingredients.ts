import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { jwtVerify } from 'jose'
import Fuse from 'fuse.js'
import type { Ingredient } from '../src/types'

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

// ============ COLUMN INDICES ============
const COL = { ID: 0, NAME: 1, DISPLAY_NAME: 2, STORE_SECTION: 3, DEFAULT_UNIT: 4, CREATED_AT: 5, LAST_USED: 6 }

function rowToIngredient(row: string[]): Ingredient {
  return {
    id: row[COL.ID] || '', name: row[COL.NAME] || '',
    displayName: row[COL.DISPLAY_NAME] || row[COL.NAME] || '',
    storeSection: (row[COL.STORE_SECTION] as Ingredient['storeSection']) || 'pantry',
    defaultUnit: (row[COL.DEFAULT_UNIT] as Ingredient['defaultUnit']) || '',
    createdAt: row[COL.CREATED_AT] || '', lastUsed: row[COL.LAST_USED] || null,
  }
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q: query } = req.query
    const searchQuery = typeof query === 'string' ? query : ''

    const rows = await getRows('Ingredients')
    const ingredients = rows.slice(1).map(rowToIngredient)

    if (!searchQuery) {
      const sortedIngredients = ingredients
        .sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0
          if (!a.lastUsed) return 1
          if (!b.lastUsed) return -1
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        })
        .slice(0, 20)
      return res.status(200).json({ ingredients: sortedIngredients })
    }

    const fuse = new Fuse(ingredients, { keys: ['name', 'displayName'], threshold: 0.3, includeScore: true })
    const results = fuse.search(searchQuery)
    const matchedIngredients = results.slice(0, 15).map(result => result.item)

    return res.status(200).json({ ingredients: matchedIngredients })
  } catch (error) {
    console.error('Error searching ingredients:', error)
    return res.status(500).json({ error: 'Failed to search ingredients', code: 'SHEETS_ERROR' })
  }
}
