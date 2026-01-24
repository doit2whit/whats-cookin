import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { google } from 'googleapis'
import { jwtVerify } from 'jose'
import type { CalendarEntry, Meal } from '../src/types'

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

async function appendRow(sheetName: string, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: sheetName, valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values.map(v => v === null ? '' : String(v))] },
  })
}

async function updateRow(sheetName: string, rowIndex: number, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: `${sheetName}!A${rowIndex}:Z${rowIndex}`, valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values.map(v => v === null ? '' : String(v))] },
  })
}

async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName)
  if (!sheet?.properties?.sheetId) throw new Error(`Sheet "${sheetName}" not found`)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
  })
}

async function findRowByColumn(sheetName: string, columnIndex: number, value: string): Promise<{ rowIndex: number; row: string[] } | null> {
  const rows = await getRows(sheetName)
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][columnIndex] === value) return { rowIndex: i + 1, row: rows[i] }
  }
  return null
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
const ENTRY_COL = { ID: 0, DATE: 1, MEAL_ID: 2, SLOT: 3, IS_LEFTOVER_ENTRY: 4, CREATED_AT: 5, CREATED_BY: 6 }
const MEAL_COL = { ID: 0, NAME: 1, CUISINE_TYPE: 2, CHEF: 3, IS_LEFTOVERS: 4, IS_FAVORITE: 5, IS_QUICK: 6, NOTES: 7, LEFTOVER_NOTES: 8, IAN_RATING: 9, HANNA_RATING: 10, MEAL_TYPE: 11, RESTAURANT_NAME: 12, FRIEND_NAME: 13, EFFORT: 14, CREATED_AT: 15, LAST_USED: 16, USE_COUNT: 17 }

function rowToMeal(row: string[]): Meal {
  return {
    id: row[MEAL_COL.ID] || '', name: row[MEAL_COL.NAME] || '',
    cuisineType: row[MEAL_COL.CUISINE_TYPE] ? row[MEAL_COL.CUISINE_TYPE].split(',').filter(Boolean) : [],
    chef: (row[MEAL_COL.CHEF] as Meal['chef']) || 'Ian',
    isLeftovers: row[MEAL_COL.IS_LEFTOVERS] === 'TRUE',
    isFavorite: row[MEAL_COL.IS_FAVORITE] === 'TRUE',
    isQuick: row[MEAL_COL.IS_QUICK] === 'TRUE',
    notes: row[MEAL_COL.NOTES] || '',
    leftoverNotes: row[MEAL_COL.LEFTOVER_NOTES] || '',
    ianRating: row[MEAL_COL.IAN_RATING] ? parseInt(row[MEAL_COL.IAN_RATING]) : null,
    hannaRating: row[MEAL_COL.HANNA_RATING] ? parseInt(row[MEAL_COL.HANNA_RATING]) : null,
    mealType: (row[MEAL_COL.MEAL_TYPE] as Meal['mealType']) || 'homemade',
    restaurantName: row[MEAL_COL.RESTAURANT_NAME] || '',
    friendName: row[MEAL_COL.FRIEND_NAME] || '',
    effort: row[MEAL_COL.EFFORT] ? parseInt(row[MEAL_COL.EFFORT]) : null,
    createdAt: row[MEAL_COL.CREATED_AT] || '',
    lastUsed: row[MEAL_COL.LAST_USED] || null,
    useCount: parseInt(row[MEAL_COL.USE_COUNT]) || 0,
  }
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query

  // DELETE /api/calendar?id=xxx
  if (req.method === 'DELETE' && id && typeof id === 'string') {
    try {
      const result = await findRowByColumn('CalendarEntries', ENTRY_COL.ID, id)
      if (!result) return res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' })
      await deleteRow('CalendarEntries', result.rowIndex)
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting calendar entry:', error)
      return res.status(500).json({ error: 'Failed to delete calendar entry', code: 'SHEETS_ERROR' })
    }
  }

  // GET /api/calendar
  if (req.method === 'GET') {
    try {
      const { start, end } = req.query
      if (!start || !end || typeof start !== 'string' || typeof end !== 'string') {
        return res.status(400).json({ error: 'Start and end dates are required', code: 'VALIDATION' })
      }

      const entryRows = await getRows('CalendarEntries')
      const mealRows = await getRows('Meals')

      const mealMap = new Map<string, Meal>()
      mealRows.slice(1).forEach(row => { const meal = rowToMeal(row); mealMap.set(meal.id, meal) })

      const entries = entryRows.slice(1)
        .filter(row => { const date = row[ENTRY_COL.DATE]; return date >= start && date <= end })
        .map(row => {
          const entry: CalendarEntry & { meal: Meal } = {
            id: row[ENTRY_COL.ID],
            date: row[ENTRY_COL.DATE],
            mealId: row[ENTRY_COL.MEAL_ID],
            slot: parseInt(row[ENTRY_COL.SLOT]) as 1 | 2,
            isLeftoverEntry: row[ENTRY_COL.IS_LEFTOVER_ENTRY] === 'TRUE',
            createdAt: row[ENTRY_COL.CREATED_AT] || '',
            createdBy: row[ENTRY_COL.CREATED_BY] || '',
            meal: mealMap.get(row[ENTRY_COL.MEAL_ID]) || {
              id: row[ENTRY_COL.MEAL_ID], name: 'Unknown Meal', cuisineType: [], chef: 'Ian',
              isLeftovers: false, isFavorite: false, isQuick: false, notes: '', leftoverNotes: '',
              ianRating: null, hannaRating: null, mealType: 'homemade', restaurantName: '', friendName: '',
              effort: null, createdAt: '', lastUsed: null, useCount: 0,
            },
          }
          return entry
        })
        .sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return a.slot - b.slot })

      return res.status(200).json({ entries })
    } catch (error) {
      console.error('Error fetching calendar entries:', error)
      return res.status(500).json({ error: 'Failed to fetch calendar entries', code: 'SHEETS_ERROR' })
    }
  }

  // POST /api/calendar
  if (req.method === 'POST') {
    try {
      const { date, mealId, slot, isLeftoverEntry, leftoverNotes } = req.body
      if (!date || !mealId || !slot) return res.status(400).json({ error: 'Date, mealId, and slot are required', code: 'VALIDATION' })
      if (slot !== 1 && slot !== 2) return res.status(400).json({ error: 'Slot must be 1 or 2', code: 'VALIDATION' })

      const entryRows = await getRows('CalendarEntries')
      const existingEntry = entryRows.slice(1).find(row => row[ENTRY_COL.DATE] === date && parseInt(row[ENTRY_COL.SLOT]) === slot)
      if (existingEntry) return res.status(400).json({ error: 'This slot already has a meal. Remove it first.', code: 'VALIDATION' })

      const newEntry = {
        id: uuid(),
        date,
        mealId,
        slot,
        isLeftoverEntry: isLeftoverEntry || false,
        createdAt: new Date().toISOString(),
        createdBy: user.email
      }
      await appendRow('CalendarEntries', [newEntry.id, newEntry.date, newEntry.mealId, newEntry.slot, newEntry.isLeftoverEntry, newEntry.createdAt, newEntry.createdBy])

      // Update meal's lastUsed (but NOT useCount - that's now calculated dynamically)
      // Also update leftover notes if provided
      const mealResult = await findRowByColumn('Meals', MEAL_COL.ID, mealId)
      if (mealResult) {
        const meal = rowToMeal(mealResult.row)
        const updatedLeftoverNotes = leftoverNotes
          ? (meal.leftoverNotes ? meal.leftoverNotes + '\n' + leftoverNotes : leftoverNotes)
          : meal.leftoverNotes

        const updatedRow = [
          meal.id, meal.name, meal.cuisineType.join(','), meal.chef,
          meal.isLeftovers, meal.isFavorite, meal.isQuick, meal.notes, updatedLeftoverNotes,
          meal.ianRating ?? '', meal.hannaRating ?? '', meal.mealType, meal.restaurantName, meal.friendName,
          meal.effort ?? '', meal.createdAt, new Date().toISOString(), meal.useCount
        ]
        await updateRow('Meals', mealResult.rowIndex, updatedRow)
      }

      return res.status(201).json({ entry: newEntry })
    } catch (error) {
      console.error('Error creating calendar entry:', error)
      return res.status(500).json({ error: 'Failed to create calendar entry', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
