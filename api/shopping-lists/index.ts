import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../lib/auth'
import { getRows, SHEETS } from '../lib/sheets'

const LIST_COL = {
  ID: 0,
  NAME: 1,
  MEAL_IDS: 2,
  CREATED_AT: 3,
  EXPIRES_AT: 4,
  CREATED_BY: 5,
}

const ITEM_COL = {
  ID: 0,
  LIST_ID: 1,
  INGREDIENT_ID: 2,
  COMBINED_QUANTITY: 3,
  STORE_SECTION: 4,
  IS_CHECKED: 5,
  DISPLAY_ORDER: 6,
}

const ING_COL = {
  ID: 0,
  NAME: 1,
  DISPLAY_NAME: 2,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const listRows = await getRows(SHEETS.SHOPPING_LISTS)
    const itemRows = await getRows(SHEETS.SHOPPING_LIST_ITEMS)
    const ingredientRows = await getRows(SHEETS.INGREDIENTS)

    // Create ingredient lookup
    const ingredientMap = new Map<string, string>()
    ingredientRows.slice(1).forEach(row => {
      ingredientMap.set(row[ING_COL.ID], row[ING_COL.DISPLAY_NAME] || row[ING_COL.NAME])
    })

    const now = new Date()
    const validLists: any[] = []
    const expiredListIds: string[] = []

    // Process lists, tracking expired ones for lazy deletion
    listRows.slice(1).forEach((row) => {
      const expiresAt = new Date(row[LIST_COL.EXPIRES_AT])

      if (expiresAt < now) {
        expiredListIds.push(row[LIST_COL.ID])
        return
      }

      const listId = row[LIST_COL.ID]
      const items = itemRows
        .slice(1)
        .filter(itemRow => itemRow[ITEM_COL.LIST_ID] === listId)
        .map(itemRow => ({
          id: itemRow[ITEM_COL.ID],
          listId: itemRow[ITEM_COL.LIST_ID],
          ingredientId: itemRow[ITEM_COL.INGREDIENT_ID],
          combinedQuantity: itemRow[ITEM_COL.COMBINED_QUANTITY],
          storeSection: itemRow[ITEM_COL.STORE_SECTION],
          isChecked: itemRow[ITEM_COL.IS_CHECKED] === 'TRUE',
          displayOrder: parseInt(itemRow[ITEM_COL.DISPLAY_ORDER]) || 0,
          ingredientName: ingredientMap.get(itemRow[ITEM_COL.INGREDIENT_ID]) || 'Unknown',
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder)

      validLists.push({
        id: listId,
        name: row[LIST_COL.NAME],
        mealIds: JSON.parse(row[LIST_COL.MEAL_IDS] || '[]'),
        createdAt: row[LIST_COL.CREATED_AT],
        expiresAt: row[LIST_COL.EXPIRES_AT],
        createdBy: row[LIST_COL.CREATED_BY],
        items,
      })
    })

    // Sort by created date descending
    validLists.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Lazy delete expired lists (async, don't wait)
    if (expiredListIds.length > 0) {
      // Note: In production, you might want to batch this or use a cron job
      // For simplicity, we're skipping deletion here to avoid slowing down the response
      console.log(`Found ${expiredListIds.length} expired shopping lists to clean up`)
    }

    return res.status(200).json({ lists: validLists })
  } catch (error) {
    console.error('Error fetching shopping lists:', error)
    return res.status(500).json({ error: 'Failed to fetch shopping lists', code: 'SHEETS_ERROR' })
  }
}
