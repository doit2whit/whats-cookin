import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { requireAuth } from './lib/auth'
import { getRows, appendRow, updateRow, deleteRow, findRowByColumn, SHEETS } from './lib/sheets'
import type { CalendarEntry, Meal } from '../src/types'

// Column indices
const ENTRY_COL = {
  ID: 0,
  DATE: 1,
  MEAL_ID: 2,
  SLOT: 3,
  CREATED_AT: 4,
  CREATED_BY: 5,
}

const MEAL_COL = {
  ID: 0,
  NAME: 1,
  CUISINE_TYPE: 2,
  CHEF: 3,
  IS_LEFTOVERS: 4,
  IS_FAVORITE: 5,
  IS_QUICK: 6,
  NOTES: 7,
  IAN_RATING: 8,
  HANNA_RATING: 9,
  MEAL_TYPE: 10,
  RESTAURANT_NAME: 11,
  FRIEND_NAME: 12,
  CREATED_AT: 13,
  LAST_USED: 14,
  USE_COUNT: 15,
}

function rowToMeal(row: string[]): Meal {
  return {
    id: row[MEAL_COL.ID] || '',
    name: row[MEAL_COL.NAME] || '',
    cuisineType: row[MEAL_COL.CUISINE_TYPE] ? row[MEAL_COL.CUISINE_TYPE].split(',').filter(Boolean) : [],
    chef: (row[MEAL_COL.CHEF] as Meal['chef']) || 'Ian',
    isLeftovers: row[MEAL_COL.IS_LEFTOVERS] === 'TRUE',
    isFavorite: row[MEAL_COL.IS_FAVORITE] === 'TRUE',
    isQuick: row[MEAL_COL.IS_QUICK] === 'TRUE',
    notes: row[MEAL_COL.NOTES] || '',
    ianRating: row[MEAL_COL.IAN_RATING] ? parseInt(row[MEAL_COL.IAN_RATING]) : null,
    hannaRating: row[MEAL_COL.HANNA_RATING] ? parseInt(row[MEAL_COL.HANNA_RATING]) : null,
    mealType: (row[MEAL_COL.MEAL_TYPE] as Meal['mealType']) || 'homemade',
    restaurantName: row[MEAL_COL.RESTAURANT_NAME] || '',
    friendName: row[MEAL_COL.FRIEND_NAME] || '',
    createdAt: row[MEAL_COL.CREATED_AT] || '',
    lastUsed: row[MEAL_COL.LAST_USED] || null,
    useCount: parseInt(row[MEAL_COL.USE_COUNT]) || 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query

  // DELETE /api/calendar?id=xxx - Delete a calendar entry
  if (req.method === 'DELETE' && id && typeof id === 'string') {
    try {
      const result = await findRowByColumn(SHEETS.CALENDAR_ENTRIES, ENTRY_COL.ID, id)
      if (!result) {
        return res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' })
      }
      await deleteRow(SHEETS.CALENDAR_ENTRIES, result.rowIndex)
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting calendar entry:', error)
      return res.status(500).json({ error: 'Failed to delete calendar entry', code: 'SHEETS_ERROR' })
    }
  }

  // GET /api/calendar - Get calendar entries
  if (req.method === 'GET') {
    try {
      const { start, end } = req.query

      if (!start || !end || typeof start !== 'string' || typeof end !== 'string') {
        return res.status(400).json({ error: 'Start and end dates are required', code: 'VALIDATION' })
      }

      const entryRows = await getRows(SHEETS.CALENDAR_ENTRIES)
      const mealRows = await getRows(SHEETS.MEALS)

      // Create meal lookup map
      const mealMap = new Map<string, Meal>()
      mealRows.slice(1).forEach(row => {
        const meal = rowToMeal(row)
        mealMap.set(meal.id, meal)
      })

      // Filter entries by date range and join with meals
      const entries = entryRows
        .slice(1)
        .filter(row => {
          const date = row[ENTRY_COL.DATE]
          return date >= start && date <= end
        })
        .map(row => {
          const entry: CalendarEntry & { meal: Meal } = {
            id: row[ENTRY_COL.ID],
            date: row[ENTRY_COL.DATE],
            mealId: row[ENTRY_COL.MEAL_ID],
            slot: parseInt(row[ENTRY_COL.SLOT]) as 1 | 2,
            createdAt: row[ENTRY_COL.CREATED_AT],
            createdBy: row[ENTRY_COL.CREATED_BY],
            meal: mealMap.get(row[ENTRY_COL.MEAL_ID]) || {
              id: row[ENTRY_COL.MEAL_ID],
              name: 'Unknown Meal',
              cuisineType: [],
              chef: 'Ian',
              isLeftovers: false,
              isFavorite: false,
              isQuick: false,
              notes: '',
              ianRating: null,
              hannaRating: null,
              mealType: 'homemade',
              restaurantName: '',
              friendName: '',
              createdAt: '',
              lastUsed: null,
              useCount: 0,
            },
          }
          return entry
        })
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date)
          return a.slot - b.slot
        })

      return res.status(200).json({ entries })
    } catch (error) {
      console.error('Error fetching calendar entries:', error)
      return res.status(500).json({ error: 'Failed to fetch calendar entries', code: 'SHEETS_ERROR' })
    }
  }

  // POST /api/calendar - Create calendar entry
  if (req.method === 'POST') {
    try {
      const { date, mealId, slot } = req.body

      if (!date || !mealId || !slot) {
        return res.status(400).json({ error: 'Date, mealId, and slot are required', code: 'VALIDATION' })
      }

      if (slot !== 1 && slot !== 2) {
        return res.status(400).json({ error: 'Slot must be 1 or 2', code: 'VALIDATION' })
      }

      // Check if slot is already taken
      const entryRows = await getRows(SHEETS.CALENDAR_ENTRIES)
      const existingEntry = entryRows.slice(1).find(row =>
        row[ENTRY_COL.DATE] === date && parseInt(row[ENTRY_COL.SLOT]) === slot
      )

      if (existingEntry) {
        return res.status(400).json({
          error: 'This slot already has a meal. Remove it first.',
          code: 'VALIDATION'
        })
      }

      const newEntry = {
        id: uuid(),
        date,
        mealId,
        slot,
        createdAt: new Date().toISOString(),
        createdBy: user.email,
      }

      await appendRow(SHEETS.CALENDAR_ENTRIES, [
        newEntry.id,
        newEntry.date,
        newEntry.mealId,
        newEntry.slot,
        newEntry.createdAt,
        newEntry.createdBy,
      ])

      // Update meal's lastUsed and useCount
      const mealResult = await findRowByColumn(SHEETS.MEALS, MEAL_COL.ID, mealId)
      if (mealResult) {
        const meal = rowToMeal(mealResult.row)
        const updatedRow = [
          meal.id,
          meal.name,
          meal.cuisineType.join(','),
          meal.chef,
          meal.isLeftovers,
          meal.isFavorite,
          meal.isQuick,
          meal.notes,
          meal.ianRating ?? '',
          meal.hannaRating ?? '',
          meal.mealType,
          meal.restaurantName,
          meal.friendName,
          meal.createdAt,
          new Date().toISOString(),
          meal.useCount + 1,
        ]
        await updateRow(SHEETS.MEALS, mealResult.rowIndex, updatedRow)
      }

      return res.status(201).json({ entry: newEntry })
    } catch (error) {
      console.error('Error creating calendar entry:', error)
      return res.status(500).json({ error: 'Failed to create calendar entry', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
