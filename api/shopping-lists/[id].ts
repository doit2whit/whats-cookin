import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../lib/auth'
import { getRows, deleteRow, findRowByColumn, SHEETS } from '../lib/sheets'

const LIST_COL = {
  ID: 0,
}

const ITEM_COL = {
  ID: 0,
  LIST_ID: 1,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid list ID', code: 'VALIDATION' })
  }

  if (req.method === 'DELETE') {
    try {
      // Find and delete the list
      const listResult = await findRowByColumn(SHEETS.SHOPPING_LISTS, LIST_COL.ID, id)
      if (!listResult) {
        return res.status(404).json({ error: 'List not found', code: 'NOT_FOUND' })
      }

      // Delete all items for this list
      const itemRows = await getRows(SHEETS.SHOPPING_LIST_ITEMS)
      const itemsToDelete = itemRows
        .map((row, index) => ({ row, rowIndex: index + 1 }))
        .filter(({ row }) => row[ITEM_COL.LIST_ID] === id)
        .reverse() // Delete from bottom to top to maintain row indices

      for (const { rowIndex } of itemsToDelete) {
        await deleteRow(SHEETS.SHOPPING_LIST_ITEMS, rowIndex)
      }

      // Delete the list itself
      await deleteRow(SHEETS.SHOPPING_LISTS, listResult.rowIndex)

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting shopping list:', error)
      return res.status(500).json({ error: 'Failed to delete shopping list', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
