import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../lib/auth'
import { getRows, appendRow, SHEETS } from '../lib/sheets'
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

function mealToRow(meal: Partial<Meal> & { id: string }): (string | number | boolean | null)[] {
  return [
    meal.id,
    meal.name || '',
    meal.cuisineType?.join(',') || '',
    meal.chef || 'Ian',
    meal.isLeftovers || false,
    meal.isFavorite || false,
    meal.isQuick || false,
    meal.notes || '',
    meal.ianRating ?? '',
    meal.hannaRating ?? '',
    meal.mealType || 'homemade',
    meal.restaurantName || '',
    meal.friendName || '',
    meal.createdAt || new Date().toISOString(),
    meal.lastUsed || '',
    meal.useCount || 0,
  ]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    try {
      const rows = await getRows(SHEETS.MEALS)
      const meals = rows.slice(1).map(rowToMeal) // Skip header

      return res.status(200).json({ meals })
    } catch (error) {
      console.error('Error fetching meals:', error)
      return res.status(500).json({ error: 'Failed to fetch meals', code: 'SHEETS_ERROR' })
    }
  }

  if (req.method === 'POST') {
    try {
      const data: MealFormData = req.body

      if (!data.name?.trim()) {
        return res.status(400).json({ error: 'Meal name is required', code: 'VALIDATION' })
      }

      const newMeal: Meal = {
        id: uuid(),
        name: data.name.trim(),
        cuisineType: data.cuisineType || [],
        chef: data.chef || 'Ian',
        isLeftovers: data.isLeftovers || false,
        isFavorite: data.isFavorite || false,
        isQuick: data.isQuick || false,
        notes: data.notes || '',
        ianRating: data.ianRating ?? null,
        hannaRating: data.hannaRating ?? null,
        mealType: data.mealType || 'homemade',
        restaurantName: data.restaurantName || '',
        friendName: data.friendName || '',
        createdAt: new Date().toISOString(),
        lastUsed: null,
        useCount: 0,
      }

      await appendRow(SHEETS.MEALS, mealToRow(newMeal))

      // Handle ingredients if provided
      if (data.ingredients && data.ingredients.length > 0) {
        for (const ingredient of data.ingredients) {
          if (!ingredient.name?.trim()) continue

          // Check if ingredient exists
          const ingredientRows = await getRows(SHEETS.INGREDIENTS)
          let ingredientId = ingredient.ingredientId

          if (!ingredientId) {
            // Create new ingredient
            ingredientId = uuid()
            await appendRow(SHEETS.INGREDIENTS, [
              ingredientId,
              ingredient.name.toLowerCase().trim(),
              ingredient.name.trim(),
              ingredient.storeSection || 'pantry',
              ingredient.unit || '',
              new Date().toISOString(),
              new Date().toISOString(),
            ])
          }

          // Create meal-ingredient relationship
          await appendRow(SHEETS.MEAL_INGREDIENTS, [
            uuid(),
            newMeal.id,
            ingredientId,
            ingredient.quantity ?? '',
            ingredient.unit || '',
            ingredient.notes || '',
          ])
        }
      }

      return res.status(201).json({ meal: newMeal })
    } catch (error) {
      console.error('Error creating meal:', error)
      return res.status(500).json({ error: 'Failed to create meal', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
