import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../lib/auth'
import { getRows, SHEETS } from '../lib/sheets'
import Fuse from 'fuse.js'
import type { Meal } from '../../src/types'

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q: query, includeHidden } = req.query
    const searchQuery = typeof query === 'string' ? query : ''
    const showHidden = includeHidden === 'true'

    const rows = await getRows(SHEETS.MEALS)
    let meals = rows.slice(1).map(rowToMeal)

    // Filter out meals not used in the past year (unless searching or showHidden)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    if (!showHidden && !searchQuery) {
      meals = meals.filter(meal => {
        if (!meal.lastUsed) return true // Never used, show it
        return new Date(meal.lastUsed) > oneYearAgo
      })
    }

    // If no search query, return recent meals sorted by last used
    if (!searchQuery) {
      const sortedMeals = meals
        .sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0
          if (!a.lastUsed) return 1
          if (!b.lastUsed) return -1
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        })
        .slice(0, 20)

      return res.status(200).json({ meals: sortedMeals })
    }

    // Fuzzy search using Fuse.js
    const fuse = new Fuse(meals, {
      keys: ['name', 'cuisineType', 'restaurantName', 'friendName'],
      threshold: 0.4,
      includeScore: true,
    })

    const results = fuse.search(searchQuery)
    const matchedMeals = results.slice(0, 20).map(result => result.item)

    return res.status(200).json({ meals: matchedMeals })
  } catch (error) {
    console.error('Error searching meals:', error)
    return res.status(500).json({ error: 'Failed to search meals', code: 'SHEETS_ERROR' })
  }
}
