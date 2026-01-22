import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './lib/auth'
import { getRows, SHEETS } from './lib/sheets'
import Fuse from 'fuse.js'
import type { Ingredient } from '../src/types'

const COL = {
  ID: 0,
  NAME: 1,
  DISPLAY_NAME: 2,
  STORE_SECTION: 3,
  DEFAULT_UNIT: 4,
  CREATED_AT: 5,
  LAST_USED: 6,
}

function rowToIngredient(row: string[]): Ingredient {
  return {
    id: row[COL.ID] || '',
    name: row[COL.NAME] || '',
    displayName: row[COL.DISPLAY_NAME] || row[COL.NAME] || '',
    storeSection: (row[COL.STORE_SECTION] as Ingredient['storeSection']) || 'pantry',
    defaultUnit: (row[COL.DEFAULT_UNIT] as Ingredient['defaultUnit']) || '',
    createdAt: row[COL.CREATED_AT] || '',
    lastUsed: row[COL.LAST_USED] || null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q: query } = req.query
    const searchQuery = typeof query === 'string' ? query : ''

    const rows = await getRows(SHEETS.INGREDIENTS)
    const ingredients = rows.slice(1).map(rowToIngredient)

    if (!searchQuery) {
      // Return most recently used ingredients
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

    // Fuzzy search
    const fuse = new Fuse(ingredients, {
      keys: ['name', 'displayName'],
      threshold: 0.3,
      includeScore: true,
    })

    const results = fuse.search(searchQuery)
    const matchedIngredients = results.slice(0, 15).map(result => result.item)

    return res.status(200).json({ ingredients: matchedIngredients })
  } catch (error) {
    console.error('Error searching ingredients:', error)
    return res.status(500).json({ error: 'Failed to search ingredients', code: 'SHEETS_ERROR' })
  }
}
