import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../lib/auth'
import { deleteRow, findRowByColumn, SHEETS } from '../lib/sheets'

const ENTRY_COL = {
  ID: 0,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid entry ID', code: 'VALIDATION' })
  }

  if (req.method === 'DELETE') {
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

  return res.status(405).json({ error: 'Method not allowed' })
}
