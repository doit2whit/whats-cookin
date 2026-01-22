import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './lib/auth'
import { getRows, SHEETS } from './lib/sheets'

const COL = {
  ID: 0,
  NAME: 1,
  USE_COUNT: 2,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rows = await getRows(SHEETS.CUISINE_TAGS)
    const cuisines = rows
      .slice(1)
      .map(row => row[COL.NAME])
      .filter(Boolean)
      .sort()

    return res.status(200).json({ cuisines })
  } catch (error) {
    console.error('Error fetching cuisines:', error)
    // Return default cuisines on error
    const defaultCuisines = [
      'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian',
      'American', 'Mediterranean', 'Korean', 'Vietnamese', 'French',
      'Greek', 'Spanish', 'Middle Eastern', 'Comfort Food', 'Healthy',
      'BBQ', 'Seafood', 'Vegetarian', 'Vegan'
    ]
    return res.status(200).json({ cuisines: defaultCuisines })
  }
}
