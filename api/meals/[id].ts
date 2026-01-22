import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../lib/auth'
import { getRows, updateRow, deleteRow, findRowByColumn, SHEETS } from '../lib/sheets'
import type { Meal, MealFormData } from '../../src/types'

// Column indices for Meals sheet
const COL = {
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
    id: row[COL.ID] || '',
    name: row[COL.NAME] || '',
    cuisineType: row[COL.CUISINE_TYPE] ? row[COL.CUISINE_TYPE].split(',').filter(Boolean) : [],
    chef: (row[COL.CHEF] as Meal['chef']) || 'Ian',
    isLeftovers: row[COL.IS_LEFTOVERS] === 'TRUE',
    isFavorite: row[COL.IS_FAVORITE] === 'TRUE',
    isQuick: row[COL.IS_QUICK] === 'TRUE',
    notes: row[COL.NOTES] || '',
    ianRating: row[COL.IAN_RATING] ? parseInt(row[COL.IAN_RATING]) : null,
    hannaRating: row[COL.HANNA_RATING] ? parseInt(row[COL.HANNA_RATING]) : null,
    mealType: (row[COL.MEAL_TYPE] as Meal['mealType']) || 'homemade',
    restaurantName: row[COL.RESTAURANT_NAME] || '',
    friendName: row[COL.FRIEND_NAME] || '',
    createdAt: row[COL.CREATED_AT] || '',
    lastUsed: row[COL.LAST_USED] || null,
    useCount: parseInt(row[COL.USE_COUNT]) || 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid meal ID', code: 'VALIDATION' })
  }

  if (req.method === 'GET') {
    try {
      const result = await findRowByColumn(SHEETS.MEALS, COL.ID, id)
      if (!result) {
        return res.status(404).json({ error: 'Meal not found', code: 'NOT_FOUND' })
      }

      const meal = rowToMeal(result.row)

      // Get ingredients for this meal
      const mealIngredients = await getRows(SHEETS.MEAL_INGREDIENTS)
      const ingredientRows = await getRows(SHEETS.INGREDIENTS)

      const mealIngredientEntries = mealIngredients
        .slice(1)
        .filter(row => row[1] === id) // meal_id is column 1
        .map(row => {
          const ingredientRow = ingredientRows.find(ir => ir[0] === row[2])
          return {
            id: row[0],
            mealId: row[1],
            ingredientId: row[2],
            quantity: row[3] ? parseFloat(row[3]) : null,
            unit: row[4],
            notes: row[5],
            ingredient: ingredientRow ? {
              id: ingredientRow[0],
              name: ingredientRow[1],
              displayName: ingredientRow[2],
              storeSection: ingredientRow[3],
              defaultUnit: ingredientRow[4],
            } : null,
          }
        })

      return res.status(200).json({
        meal: {
          ...meal,
          ingredients: mealIngredientEntries,
        },
      })
    } catch (error) {
      console.error('Error fetching meal:', error)
      return res.status(500).json({ error: 'Failed to fetch meal', code: 'SHEETS_ERROR' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const result = await findRowByColumn(SHEETS.MEALS, COL.ID, id)
      if (!result) {
        return res.status(404).json({ error: 'Meal not found', code: 'NOT_FOUND' })
      }

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
        data.ianRating ?? existingMeal.ianRating ?? '',
        data.hannaRating ?? existingMeal.hannaRating ?? '',
        data.mealType || existingMeal.mealType,
        data.restaurantName ?? existingMeal.restaurantName,
        data.friendName ?? existingMeal.friendName,
        existingMeal.createdAt,
        existingMeal.lastUsed || '',
        existingMeal.useCount,
      ]

      await updateRow(SHEETS.MEALS, result.rowIndex, updatedRow)

      const updatedMeal = rowToMeal(updatedRow.map(String))
      return res.status(200).json({ meal: updatedMeal })
    } catch (error) {
      console.error('Error updating meal:', error)
      return res.status(500).json({ error: 'Failed to update meal', code: 'SHEETS_ERROR' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await findRowByColumn(SHEETS.MEALS, COL.ID, id)
      if (!result) {
        return res.status(404).json({ error: 'Meal not found', code: 'NOT_FOUND' })
      }

      await deleteRow(SHEETS.MEALS, result.rowIndex)

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting meal:', error)
      return res.status(500).json({ error: 'Failed to delete meal', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
