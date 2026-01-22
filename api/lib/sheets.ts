import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

let sheetsInstance: sheets_v4.Sheets | null = null

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

export function getSheets(): sheets_v4.Sheets {
  if (!sheetsInstance) {
    const auth = getAuth()
    sheetsInstance = google.sheets({ version: 'v4', auth })
  }
  return sheetsInstance
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID
  if (!id) {
    throw new Error('Missing GOOGLE_SPREADSHEET_ID environment variable')
  }
  return id
}

// Sheet names as constants
export const SHEETS = {
  ALLOWED_USERS: 'AllowedUsers',
  MEALS: 'Meals',
  INGREDIENTS: 'Ingredients',
  MEAL_INGREDIENTS: 'MealIngredients',
  CALENDAR_ENTRIES: 'CalendarEntries',
  SHOPPING_LISTS: 'ShoppingLists',
  SHOPPING_LIST_ITEMS: 'ShoppingListItems',
  CUISINE_TAGS: 'CuisineTags',
} as const

// Helper to get all rows from a sheet
export async function getRows(sheetName: string): Promise<string[][]> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  })

  return response.data.values || []
}

// Helper to append a row
export async function appendRow(sheetName: string, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values.map(v => v === null ? '' : String(v))],
    },
  })
}

// Helper to update a specific row
export async function updateRow(sheetName: string, rowIndex: number, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values.map(v => v === null ? '' : String(v))],
    },
  })
}

// Helper to delete a row
export async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()

  // First, get the sheet ID
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  })

  const sheet = spreadsheet.data.sheets?.find(
    s => s.properties?.title === sheetName
  )

  if (!sheet?.properties?.sheetId) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  })
}

// Helper to find a row by column value
export async function findRowByColumn(
  sheetName: string,
  columnIndex: number,
  value: string
): Promise<{ rowIndex: number; row: string[] } | null> {
  const rows = await getRows(sheetName)

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][columnIndex] === value) {
      return { rowIndex: i + 1, row: rows[i] } // +1 because sheets are 1-indexed
    }
  }

  return null
}

// Helper to batch get multiple ranges
export async function batchGet(ranges: string[]): Promise<Map<string, string[][]>> {
  const sheets = getSheets()
  const spreadsheetId = getSpreadsheetId()

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  })

  const result = new Map<string, string[][]>()
  response.data.valueRanges?.forEach((range, index) => {
    result.set(ranges[index], range.values || [])
  })

  return result
}
