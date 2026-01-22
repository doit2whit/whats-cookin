import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../../../lib/auth'
import { getRows, updateRow, SHEETS } from '../../../lib/sheets'

const ITEM_COL = {
  ID: 0,
  LIST_ID: 1,
  INGREDIENT_ID: 2,
  COMBINED_QUANTITY: 3,
  STORE_SECTION: 4,
  IS_CHECKED: 5,
  DISPLAY_ORDER: 6,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id: listId, itemId } = req.query as { id: string; itemId: string }

  if (!listId || !itemId) {
    return res.status(400).json({ error: 'Invalid IDs', code: 'VALIDATION' })
  }

  if (req.method === 'PATCH') {
    try {
      const { isChecked } = req.body

      if (typeof isChecked !== 'boolean') {
        return res.status(400).json({ error: 'isChecked must be a boolean', code: 'VALIDATION' })
      }

      // Find the item
      const itemRows = await getRows(SHEETS.SHOPPING_LIST_ITEMS)
      const itemIndex = itemRows.findIndex((row, i) =>
        i > 0 && row[ITEM_COL.ID] === itemId && row[ITEM_COL.LIST_ID] === listId
      )

      if (itemIndex === -1) {
        return res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' })
      }

      const row = itemRows[itemIndex]
      const updatedRow = [
        row[ITEM_COL.ID],
        row[ITEM_COL.LIST_ID],
        row[ITEM_COL.INGREDIENT_ID],
        row[ITEM_COL.COMBINED_QUANTITY],
        row[ITEM_COL.STORE_SECTION],
        isChecked,
        row[ITEM_COL.DISPLAY_ORDER],
      ]

      await updateRow(SHEETS.SHOPPING_LIST_ITEMS, itemIndex + 1, updatedRow)

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error updating shopping list item:', error)
      return res.status(500).json({ error: 'Failed to update item', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
