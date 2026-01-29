import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { google } from 'googleapis'
import { jwtVerify } from 'jose'

// ============ TYPES (INLINED) ============
type StoreSection = 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' | 'bakery' | 'beverages' | 'other'

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
const LIST_COL = { ID: 0, NAME: 1, MEAL_IDS: 2, CREATED_AT: 3, EXPIRES_AT: 4, CREATED_BY: 5 }
const ITEM_COL = { ID: 0, LIST_ID: 1, INGREDIENT_ID: 2, COMBINED_QUANTITY: 3, STORE_SECTION: 4, IS_CHECKED: 5, DISPLAY_ORDER: 6 }
const ING_COL = { ID: 0, NAME: 1, DISPLAY_NAME: 2, STORE_SECTION: 3, DEFAULT_UNIT: 4, IS_COMMON_ITEM: 5, CREATED_AT: 6, LAST_USED: 7 }
const MEAL_ING_COL = { ID: 0, MEAL_ID: 1, INGREDIENT_ID: 2, QUANTITY: 3, UNIT: 4, NOTES: 5 }

interface IngredientAmount {
  ingredientId: string
  name: string
  displayName: string
  storeSection: StoreSection
  isCommonItem: boolean
  quantity: number | null
  unit: string
  notes: string
}

function combineIngredients(amounts: IngredientAmount[]): Map<string, { display: string; section: StoreSection; name: string; isCommonItem: boolean }> {
  const grouped = new Map<string, IngredientAmount[]>()
  amounts.forEach(amount => {
    const existing = grouped.get(amount.ingredientId) || []
    grouped.set(amount.ingredientId, [...existing, amount])
  })

  const result = new Map<string, { display: string; section: StoreSection; name: string; isCommonItem: boolean }>()
  grouped.forEach((amountList, ingredientId) => {
    const first = amountList[0]
    const byUnit = new Map<string, number>()
    const nonCombinableNotes: string[] = []

    amountList.forEach(amount => {
      if (amount.quantity !== null && !amount.notes) {
        const key = amount.unit || 'count'
        byUnit.set(key, (byUnit.get(key) || 0) + amount.quantity)
      } else if (amount.notes) {
        const part = amount.quantity ? `${amount.quantity}${amount.unit ? ' ' + amount.unit : ''} (${amount.notes})` : amount.notes
        nonCombinableNotes.push(part)
      } else if (amount.quantity !== null) {
        const key = amount.unit || 'count'
        byUnit.set(key, (byUnit.get(key) || 0) + amount.quantity)
      }
    })

    const parts: string[] = []
    byUnit.forEach((qty, unit) => {
      if (unit === 'count') {
        parts.push(qty.toString())
      } else {
        parts.push(`${qty} ${unit}`)
      }
    })
    parts.push(...nonCombinableNotes)
    const display = parts.length > 0 ? parts.join(' + ') : '—'
    result.set(ingredientId, { display, section: first.storeSection, name: first.displayName, isCommonItem: first.isCommonItem })
  })

  return result
}

const SECTION_ORDER: StoreSection[] = ['produce', 'meat', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other']

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id, itemId, action } = req.query

  // POST /api/shopping-lists?action=generate
  if (req.method === 'POST' && action === 'generate') {
    try {
      const { mealIds, excludeCommonItems } = req.body
      const shouldExcludeCommon = excludeCommonItems === true

      if (!mealIds || !Array.isArray(mealIds) || mealIds.length === 0) {
        return res.status(400).json({ error: 'At least one meal ID is required', code: 'VALIDATION' })
      }
      if (mealIds.length > 4) {
        return res.status(400).json({ error: 'Maximum 4 meals per shopping list', code: 'VALIDATION' })
      }

      const mealIngredientRows = await getRows('MealIngredients')
      const ingredientRows = await getRows('Ingredients')

      console.log('MealIngredients rows count:', mealIngredientRows.length)
      console.log('Ingredients rows count:', ingredientRows.length)
      console.log('Looking for mealIds:', mealIds)

      // Build ingredient lookup map - using the ingredientId from MealIngredients
      const ingredientMap = new Map<string, { name: string; displayName: string; storeSection: StoreSection; isCommonItem: boolean }>()
      ingredientRows.slice(1).forEach(row => {
        if (row[ING_COL.ID]) {
          ingredientMap.set(row[ING_COL.ID], {
            name: row[ING_COL.NAME] || '',
            displayName: row[ING_COL.DISPLAY_NAME] || row[ING_COL.NAME] || '',
            storeSection: (row[ING_COL.STORE_SECTION] as StoreSection) || 'pantry',
            isCommonItem: row[ING_COL.IS_COMMON_ITEM] === 'TRUE'
          })
        }
      })

      console.log('Ingredient map size:', ingredientMap.size)

      const allAmounts: IngredientAmount[] = []

      // Debug: log meal ingredient rows that match
      let matchedMealIngRows = 0

      mealIngredientRows.slice(1).forEach(row => {
        const mealId = row[MEAL_ING_COL.MEAL_ID]

        if (!mealIds.includes(mealId)) return
        matchedMealIngRows++

        const ingredientId = row[MEAL_ING_COL.INGREDIENT_ID]
        let ingredient = ingredientMap.get(ingredientId)

        // If ingredient not found in Ingredients sheet, create a basic entry
        // This handles cases where MealIngredients references an ingredient that wasn't properly added
        if (!ingredient) {
          console.log('Ingredient not found for ID:', ingredientId, '- creating fallback')
          ingredient = {
            name: ingredientId, // Use ID as fallback name
            displayName: ingredientId,
            storeSection: 'pantry',
            isCommonItem: false
          }
        }

        allAmounts.push({
          ingredientId,
          name: ingredient.name,
          displayName: ingredient.displayName,
          storeSection: ingredient.storeSection,
          isCommonItem: ingredient.isCommonItem,
          quantity: row[MEAL_ING_COL.QUANTITY] ? parseFloat(row[MEAL_ING_COL.QUANTITY]) : null,
          unit: row[MEAL_ING_COL.UNIT] || '',
          notes: row[MEAL_ING_COL.NOTES] || ''
        })
      })

      console.log('Matched meal ingredient rows:', matchedMealIngRows)
      console.log('Total amounts collected:', allAmounts.length)

      if (allAmounts.length === 0) {
        return res.status(400).json({
          error: 'Selected meals have no ingredients. Add ingredients to your meals first.',
          code: 'VALIDATION'
        })
      }

      const combined = combineIngredients(allAmounts)
      const listId = uuid()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000)

      await appendRow('ShoppingLists', [listId, '', JSON.stringify(mealIds), now.toISOString(), expiresAt.toISOString(), user.email])

      const items: any[] = []
      let displayOrder = 0

      // Use for...of to ensure we process all items
      for (const section of SECTION_ORDER) {
        for (const [ingredientId, data] of combined) {
          if (data.section !== section) continue

          // Skip common items if requested
          if (shouldExcludeCommon && data.isCommonItem) continue

          const itemIdNew = uuid()
          items.push({
            id: itemIdNew,
            listId,
            ingredientId,
            combinedQuantity: data.display,
            storeSection: data.section,
            isChecked: false,
            displayOrder,
            ingredientName: data.name
          })

          await appendRow('ShoppingListItems', [itemIdNew, listId, ingredientId, data.display, data.section, false, displayOrder])
          displayOrder++
        }
      }

      console.log('Final items count:', items.length)

      const list = { id: listId, name: '', mealIds, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString(), createdBy: user.email, items }
      return res.status(201).json({ list })
    } catch (error) {
      console.error('Error generating shopping list:', error)
      return res.status(500).json({ error: 'Failed to generate shopping list', code: 'SHEETS_ERROR' })
    }
  }

  // PATCH /api/shopping-lists?id=xxx&itemId=yyy
  if (req.method === 'PATCH' && id && itemId && typeof id === 'string' && typeof itemId === 'string') {
    try {
      const { isChecked } = req.body
      if (typeof isChecked !== 'boolean') return res.status(400).json({ error: 'isChecked must be a boolean', code: 'VALIDATION' })

      const itemRows = await getRows('ShoppingListItems')
      const itemIndex = itemRows.findIndex((row, i) => i > 0 && row[ITEM_COL.ID] === itemId && row[ITEM_COL.LIST_ID] === id)
      if (itemIndex === -1) return res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' })

      const row = itemRows[itemIndex]
      const updatedRow = [row[ITEM_COL.ID], row[ITEM_COL.LIST_ID], row[ITEM_COL.INGREDIENT_ID], row[ITEM_COL.COMBINED_QUANTITY], row[ITEM_COL.STORE_SECTION], isChecked, row[ITEM_COL.DISPLAY_ORDER]]
      await updateRow('ShoppingListItems', itemIndex + 1, updatedRow)

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error updating shopping list item:', error)
      return res.status(500).json({ error: 'Failed to update item', code: 'SHEETS_ERROR' })
    }
  }

  // DELETE /api/shopping-lists?id=xxx
  if (req.method === 'DELETE' && id && typeof id === 'string') {
    try {
      const listResult = await findRowByColumn('ShoppingLists', LIST_COL.ID, id)
      if (!listResult) return res.status(404).json({ error: 'List not found', code: 'NOT_FOUND' })

      const itemRows = await getRows('ShoppingListItems')
      const itemsToDelete = itemRows.map((row, index) => ({ row, rowIndex: index + 1 })).filter(({ row }) => row[ITEM_COL.LIST_ID] === id).reverse()
      for (const { rowIndex } of itemsToDelete) { await deleteRow('ShoppingListItems', rowIndex) }

      await deleteRow('ShoppingLists', listResult.rowIndex)
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting shopping list:', error)
      return res.status(500).json({ error: 'Failed to delete shopping list', code: 'SHEETS_ERROR' })
    }
  }

  // GET /api/shopping-lists
  if (req.method === 'GET') {
    try {
      const listRows = await getRows('ShoppingLists')
      const itemRows = await getRows('ShoppingListItems')
      const ingredientRows = await getRows('Ingredients')

      const ingredientMap = new Map<string, string>()
      ingredientRows.slice(1).forEach(row => { ingredientMap.set(row[ING_COL.ID], row[ING_COL.DISPLAY_NAME] || row[ING_COL.NAME]) })

      const now = new Date()
      const validLists: any[] = []

      listRows.slice(1).forEach((row) => {
        const expiresAt = new Date(row[LIST_COL.EXPIRES_AT])
        if (expiresAt < now) return

        const listId = row[LIST_COL.ID]
        const items = itemRows.slice(1).filter(itemRow => itemRow[ITEM_COL.LIST_ID] === listId).map(itemRow => ({
          id: itemRow[ITEM_COL.ID], listId: itemRow[ITEM_COL.LIST_ID], ingredientId: itemRow[ITEM_COL.INGREDIENT_ID],
          combinedQuantity: itemRow[ITEM_COL.COMBINED_QUANTITY], storeSection: itemRow[ITEM_COL.STORE_SECTION],
          isChecked: itemRow[ITEM_COL.IS_CHECKED] === 'TRUE', displayOrder: parseInt(itemRow[ITEM_COL.DISPLAY_ORDER]) || 0,
          ingredientName: ingredientMap.get(itemRow[ITEM_COL.INGREDIENT_ID]) || itemRow[ITEM_COL.INGREDIENT_ID] || 'Unknown',
        })).sort((a, b) => a.displayOrder - b.displayOrder)

        validLists.push({ id: listId, name: row[LIST_COL.NAME], mealIds: JSON.parse(row[LIST_COL.MEAL_IDS] || '[]'), createdAt: row[LIST_COL.CREATED_AT], expiresAt: row[LIST_COL.EXPIRES_AT], createdBy: row[LIST_COL.CREATED_BY], items })
      })

      validLists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      return res.status(200).json({ lists: validLists })
    } catch (error) {
      console.error('Error fetching shopping lists:', error)
      return res.status(500).json({ error: 'Failed to fetch shopping lists', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
