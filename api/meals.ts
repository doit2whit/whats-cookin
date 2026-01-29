import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { google } from 'googleapis'
import { jwtVerify } from 'jose'

// ============ TYPES (INLINED) ============
type MealType = 'homemade' | 'restaurant' | 'friends_house' | 'leftovers'
type Chef = 'Ian' | 'Hanna' | 'Other'

interface Meal {
  id: string
  name: string
  cuisineType: string[]
  chef: Chef
  isLeftovers: boolean
  isFavorite: boolean
  isQuick: boolean
  notes: string
  leftoverNotes: string
  ianRating: number | null
  hannaRating: number | null
  mealType: MealType
  restaurantName: string
  friendName: string
  effort: number | null
  createdAt: string
  lastUsed: string | null
  useCount: number
}

interface MealFormData {
  name: string
  cuisineType: string[]
  chef: Chef
  isLeftovers: boolean
  isFavorite: boolean
  isQuick: boolean
  notes: string
  leftoverNotes?: string
  ianRating: number | null
  hannaRating: number | null
  mealType: MealType
  restaurantName: string
  friendName: string
  effort: number | null
  ingredients: Array<{
    ingredientId?: string
    name: string
    quantity: number | null
    unit: string
    storeSection: string
    isCommonItem?: boolean
    notes?: string
  }>
}

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
// Updated column order with new fields
const COL = {
  ID: 0, NAME: 1, CUISINE_TYPE: 2, CHEF: 3, IS_LEFTOVERS: 4, IS_FAVORITE: 5, IS_QUICK: 6,
  NOTES: 7, LEFTOVER_NOTES: 8, IAN_RATING: 9, HANNA_RATING: 10, MEAL_TYPE: 11,
  RESTAURANT_NAME: 12, FRIEND_NAME: 13, EFFORT: 14, CREATED_AT: 15, LAST_USED: 16, USE_COUNT: 17
}

const ENTRY_COL = { ID: 0, DATE: 1, MEAL_ID: 2, SLOT: 3, IS_LEFTOVER_ENTRY: 4, CREATED_AT: 5, CREATED_BY: 6 }

function rowToMeal(row: string[]): Meal {
  return {
    id: row[COL.ID] || '', name: row[COL.NAME] || '',
    cuisineType: row[COL.CUISINE_TYPE] ? row[COL.CUISINE_TYPE].split(',').filter(Boolean) : [],
    chef: (row[COL.CHEF] as Meal['chef']) || 'Ian',
    isLeftovers: row[COL.IS_LEFTOVERS] === 'TRUE',
    isFavorite: row[COL.IS_FAVORITE] === 'TRUE',
    isQuick: row[COL.IS_QUICK] === 'TRUE',
    notes: row[COL.NOTES] || '',
    leftoverNotes: row[COL.LEFTOVER_NOTES] || '',
    ianRating: row[COL.IAN_RATING] ? parseInt(row[COL.IAN_RATING]) : null,
    hannaRating: row[COL.HANNA_RATING] ? parseInt(row[COL.HANNA_RATING]) : null,
    mealType: (row[COL.MEAL_TYPE] as Meal['mealType']) || 'homemade',
    restaurantName: row[COL.RESTAURANT_NAME] || '',
    friendName: row[COL.FRIEND_NAME] || '',
    effort: row[COL.EFFORT] ? parseInt(row[COL.EFFORT]) : null,
    createdAt: row[COL.CREATED_AT] || '',
    lastUsed: row[COL.LAST_USED] || null,
    useCount: parseInt(row[COL.USE_COUNT]) || 0,
  }
}

function mealToRow(meal: Partial<Meal> & { id: string }): (string | number | boolean | null)[] {
  return [
    meal.id, meal.name || '', meal.cuisineType?.join(',') || '', meal.chef || 'Ian',
    meal.isLeftovers || false, meal.isFavorite || false, meal.isQuick || false,
    meal.notes || '', meal.leftoverNotes || '',
    meal.ianRating ?? '', meal.hannaRating ?? '', meal.mealType || 'homemade',
    meal.restaurantName || '', meal.friendName || '', meal.effort ?? '',
    meal.createdAt || new Date().toISOString(), meal.lastUsed || '', meal.useCount || 0
  ]
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id, action, q: query, includeHidden } = req.query

  // GET /api/meals?action=autocomplete
  if (req.method === 'GET' && action === 'autocomplete') {
    try {
      const searchQuery = typeof query === 'string' ? query : ''
      const showHidden = includeHidden === 'true'
      const rows = await getRows('Meals')
      let meals = rows.slice(1).map(rowToMeal)

      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      if (!showHidden && !searchQuery) {
        meals = meals.filter(meal => { if (!meal.lastUsed) return true; return new Date(meal.lastUsed) > oneYearAgo })
      }

      if (!searchQuery) {
        const sortedMeals = meals.sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0; if (!a.lastUsed) return 1; if (!b.lastUsed) return -1
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        }).slice(0, 20)
        return res.status(200).json({ meals: sortedMeals })
      }

      // Simple case-insensitive search
      const lowerQuery = searchQuery.toLowerCase()
      const matchedMeals = meals.filter(meal =>
        meal.name.toLowerCase().includes(lowerQuery) ||
        meal.cuisineType.some(c => c.toLowerCase().includes(lowerQuery)) ||
        meal.restaurantName.toLowerCase().includes(lowerQuery) ||
        meal.friendName.toLowerCase().includes(lowerQuery)
      ).slice(0, 20)
      return res.status(200).json({ meals: matchedMeals })
    } catch (error) {
      console.error('Error searching meals:', error)
      return res.status(500).json({ error: 'Failed to search meals', code: 'SHEETS_ERROR' })
    }
  }

  // GET /api/meals?id=xxx - Get single meal with ingredients and history
  if (req.method === 'GET' && id && typeof id === 'string') {
    try {
      const result = await findRowByColumn('Meals', COL.ID, id)
      if (!result) return res.status(404).json({ error: 'Meal not found', code: 'NOT_FOUND' })
      const meal = rowToMeal(result.row)

      // Get ingredients for this meal
      const mealIngredients = await getRows('MealIngredients')
      const ingredientRows = await getRows('Ingredients')

      const mealIngredientEntries = mealIngredients.slice(1).filter(row => row[1] === id).map(row => {
        const ingredientRow = ingredientRows.find(ir => ir[0] === row[2])
        return {
          id: row[0], mealId: row[1], ingredientId: row[2],
          quantity: row[3] ? parseFloat(row[3]) : null, unit: row[4], notes: row[5],
          ingredient: ingredientRow ? {
            id: ingredientRow[0], name: ingredientRow[1], displayName: ingredientRow[2],
            storeSection: ingredientRow[3], defaultUnit: ingredientRow[4], isCommonItem: ingredientRow[5] === 'TRUE'
          } : null,
        }
      })

      // Get cooking history for this meal
      const calendarEntries = await getRows('CalendarEntries')
      const mealHistory = calendarEntries.slice(1)
        .filter(row => row[ENTRY_COL.MEAL_ID] === id)
        .map(row => ({
          date: row[ENTRY_COL.DATE],
          chef: meal.chef, // Chef is stored on the meal, not the entry
          isLeftoverEntry: row[ENTRY_COL.IS_LEFTOVER_ENTRY] === 'TRUE'
        }))
        .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first

      // Calculate dynamic "made" count (excluding leftovers)
      const madeCount = mealHistory.filter(h => !h.isLeftoverEntry).length

      return res.status(200).json({
        meal: { ...meal, useCount: madeCount, ingredients: mealIngredientEntries, history: mealHistory }
      })
    } catch (error) {
      console.error('Error fetching meal:', error)
      return res.status(500).json({ error: 'Failed to fetch meal', code: 'SHEETS_ERROR' })
    }
  }

  // GET /api/meals - Get all meals with dynamic counts
  if (req.method === 'GET') {
    try {
      const rows = await getRows('Meals')
      const calendarEntries = await getRows('CalendarEntries')

      // Build a map of mealId -> count (excluding leftover entries)
      const mealCounts = new Map<string, number>()
      calendarEntries.slice(1).forEach(row => {
        const mealId = row[ENTRY_COL.MEAL_ID]
        const isLeftover = row[ENTRY_COL.IS_LEFTOVER_ENTRY] === 'TRUE'
        if (!isLeftover) {
          mealCounts.set(mealId, (mealCounts.get(mealId) || 0) + 1)
        }
      })

      const meals = rows.slice(1).map(row => {
        const meal = rowToMeal(row)
        // Override useCount with dynamic count
        meal.useCount = mealCounts.get(meal.id) || 0
        return meal
      })

      return res.status(200).json({ meals })
    } catch (error) {
      console.error('Error fetching meals:', error)
      return res.status(500).json({ error: 'Failed to fetch meals', code: 'SHEETS_ERROR' })
    }
  }

  // POST /api/meals
  if (req.method === 'POST') {
    try {
      const data: MealFormData = req.body
      if (!data.name?.trim()) return res.status(400).json({ error: 'Meal name is required', code: 'VALIDATION' })

      const newMeal: Meal = {
        id: uuid(), name: data.name.trim(), cuisineType: data.cuisineType || [], chef: data.chef || 'Ian',
        isLeftovers: data.isLeftovers || false, isFavorite: data.isFavorite || false, isQuick: data.isQuick || false,
        notes: data.notes || '', leftoverNotes: data.leftoverNotes || '',
        ianRating: data.ianRating ?? null, hannaRating: data.hannaRating ?? null,
        mealType: data.mealType || 'homemade', restaurantName: data.restaurantName || '', friendName: data.friendName || '',
        effort: data.effort ?? null,
        createdAt: new Date().toISOString(), lastUsed: null, useCount: 0,
      }

      await appendRow('Meals', mealToRow(newMeal))

      if (data.ingredients && data.ingredients.length > 0) {
        for (const ingredient of data.ingredients) {
          if (!ingredient.name?.trim()) continue
          let ingredientId = ingredient.ingredientId
          if (!ingredientId) {
            ingredientId = uuid()
            await appendRow('Ingredients', [
              ingredientId, ingredient.name.toLowerCase().trim(), ingredient.name.trim(),
              ingredient.storeSection || 'pantry', ingredient.unit || '', ingredient.isCommonItem || false,
              new Date().toISOString(), new Date().toISOString()
            ])
          }
          await appendRow('MealIngredients', [uuid(), newMeal.id, ingredientId, ingredient.quantity ?? '', ingredient.unit || '', ingredient.notes || ''])
        }
      }

      return res.status(201).json({ meal: newMeal })
    } catch (error) {
      console.error('Error creating meal:', error)
      return res.status(500).json({ error: 'Failed to create meal', code: 'SHEETS_ERROR' })
    }
  }

  // PUT /api/meals?id=xxx
  if (req.method === 'PUT' && id && typeof id === 'string') {
    try {
      const result = await findRowByColumn('Meals', COL.ID, id)
      if (!result) return res.status(404).json({ error: 'Meal not found', code: 'NOT_FOUND' })

      const data: MealFormData = req.body
      const existingMeal = rowToMeal(result.row)

      const updatedRow = [
        id,
        data.name?.trim() || existingMeal.name,
        data.cuisineType?.join(',') || existingMeal.cuisineType.join(','),
        data.chef || existingMeal.chef,
        data.isLeftovers ?? existingMeal.isLeftovers,
        data.isFavorite ?? existingMeal.isFavorite,
        data.isQuick ?? existingMeal.isQuick,
        data.notes ?? existingMeal.notes,
        data.leftoverNotes ?? existingMeal.leftoverNotes,
        data.ianRating ?? existingMeal.ianRating ?? '',
        data.hannaRating ?? existingMeal.hannaRating ?? '',
        data.mealType || existingMeal.mealType,
        data.restaurantName ?? existingMeal.restaurantName,
        data.friendName ?? existingMeal.friendName,
        data.effort ?? existingMeal.effort ?? '',
        existingMeal.createdAt,
        existingMeal.lastUsed || '',
        existingMeal.useCount
      ]

      await updateRow('Meals', result.rowIndex, updatedRow)
      const updatedMeal = rowToMeal(updatedRow.map(String))
      return res.status(200).json({ meal: updatedMeal })
    } catch (error) {
      console.error('Error updating meal:', error)
      return res.status(500).json({ error: 'Failed to update meal', code: 'SHEETS_ERROR' })
    }
  }

  // DELETE /api/meals?id=xxx
  if (req.method === 'DELETE' && id && typeof id === 'string') {
    try {
      const result = await findRowByColumn('Meals', COL.ID, id)
      if (!result) return res.status(404).json({ error: 'Meal not found', code: 'NOT_FOUND' })
      await deleteRow('Meals', result.rowIndex)
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting meal:', error)
      return res.status(500).json({ error: 'Failed to delete meal', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
