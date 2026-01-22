import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { requireAuth } from './lib/auth'
import { getRows, appendRow, updateRow, deleteRow, findRowByColumn, SHEETS } from './lib/sheets'
import type { StoreSection } from '../src/types'

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
  STORE_SECTION: 3,
}

const MEAL_ING_COL = {
  ID: 0,
  MEAL_ID: 1,
  INGREDIENT_ID: 2,
  QUANTITY: 3,
  UNIT: 4,
  NOTES: 5,
}

interface IngredientAmount {
  ingredientId: string
  name: string
  displayName: string
  storeSection: StoreSection
  quantity: number | null
  unit: string
  notes: string
}

function combineIngredients(amounts: IngredientAmount[]): Map<string, { display: string; section: StoreSection; name: string }> {
  const grouped = new Map<string, IngredientAmount[]>()

  amounts.forEach(amount => {
    const existing = grouped.get(amount.ingredientId) || []
    grouped.set(amount.ingredientId, [...existing, amount])
  })

  const result = new Map<string, { display: string; section: StoreSection; name: string }>()

  grouped.forEach((amountList, ingredientId) => {
    const first = amountList[0]
    const byUnit = new Map<string, number>()
    const nonCombinableNotes: string[] = []

    amountList.forEach(amount => {
      if (amount.quantity !== null && !amount.notes) {
        const key = amount.unit || 'count'
        byUnit.set(key, (byUnit.get(key) || 0) + amount.quantity)
      } else if (amount.notes) {
        const part = amount.quantity
          ? `${amount.quantity}${amount.unit ? ' ' + amount.unit : ''} (${amount.notes})`
          : amount.notes
        nonCombinableNotes.push(part)
      } else if (amount.quantity !== null) {
        const key = amount.unit || 'count'
        byUnit.set(key, (byUnit.get(key) || 0) + amount.quantity)
      }
    })

    const parts: string[] = []

    byUnit.forEach((qty, unit) => {
      if (unit === 'count') {
        parts.push(qty.toString())
      } else {
        parts.push(`${qty} ${unit}`)
      }
    })

    parts.push(...nonCombinableNotes)

    const display = parts.length > 0 ? parts.join(' + ') : '—'

    result.set(ingredientId, {
      display,
      section: first.storeSection,
      name: first.displayName,
    })
  })

  return result
}

const SECTION_ORDER: StoreSection[] = [
  'produce', 'meat', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id, itemId, action } = req.query

  // POST /api/shopping-lists?action=generate - Generate shopping list
  if (req.method === 'POST' && action === 'generate') {
    try {
      const { mealIds } = req.body

      if (!mealIds || !Array.isArray(mealIds) || mealIds.length === 0) {
        return res.status(400).json({ error: 'At least one meal ID is required', code: 'VALIDATION' })
      }

      if (mealIds.length > 4) {
        return res.status(400).json({ error: 'Maximum 4 meals per shopping list', code: 'VALIDATION' })
      }

      const mealIngredientRows = await getRows(SHEETS.MEAL_INGREDIENTS)
      const ingredientRows = await getRows(SHEETS.INGREDIENTS)

      const ingredientMap = new Map<string, { name: string; displayName: string; storeSection: StoreSection }>()
      ingredientRows.slice(1).forEach(row => {
        ingredientMap.set(row[ING_COL.ID], {
          name: row[ING_COL.NAME],
          displayName: row[ING_COL.DISPLAY_NAME] || row[ING_COL.NAME],
          storeSection: (row[ING_COL.STORE_SECTION] as StoreSection) || 'pantry',
        })
      })

      const allAmounts: IngredientAmount[] = []

      mealIngredientRows.slice(1).forEach(row => {
        const mealId = row[MEAL_ING_COL.MEAL_ID]
        if (!mealIds.includes(mealId)) return

        const ingredientId = row[MEAL_ING_COL.INGREDIENT_ID]
        const ingredient = ingredientMap.get(ingredientId)
        if (!ingredient) return

        allAmounts.push({
          ingredientId,
          name: ingredient.name,
          displayName: ingredient.displayName,
          storeSection: ingredient.storeSection,
          quantity: row[MEAL_ING_COL.QUANTITY] ? parseFloat(row[MEAL_ING_COL.QUANTITY]) : null,
          unit: row[MEAL_ING_COL.UNIT] || '',
          notes: row[MEAL_ING_COL.NOTES] || '',
        })
      })

      if (allAmounts.length === 0) {
        return res.status(400).json({
          error: 'Selected meals have no ingredients. Add ingredients to your meals first.',
          code: 'VALIDATION'
        })
      }

      const combined = combineIngredients(allAmounts)

      const listId = uuid()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000)

      await appendRow(SHEETS.SHOPPING_LISTS, [
        listId,
        '',
        JSON.stringify(mealIds),
        now.toISOString(),
        expiresAt.toISOString(),
        user.email,
      ])

      const items: any[] = []
      let displayOrder = 0

      SECTION_ORDER.forEach(section => {
        combined.forEach((data, ingredientId) => {
          if (data.section !== section) return

          const itemIdNew = uuid()
          items.push({
            id: itemIdNew,
            listId,
            ingredientId,
            combinedQuantity: data.display,
            storeSection: data.section,
            isChecked: false,
            displayOrder,
            ingredientName: data.name,
          })

          appendRow(SHEETS.SHOPPING_LIST_ITEMS, [
            itemIdNew,
            listId,
            ingredientId,
            data.display,
            data.section,
            false,
            displayOrder,
          ])

          displayOrder++
        })
      })

      const list = {
        id: listId,
        name: '',
        mealIds,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        createdBy: user.email,
        items,
      }

      return res.status(201).json({ list })
    } catch (error) {
      console.error('Error generating shopping list:', error)
      return res.status(500).json({ error: 'Failed to generate shopping list', code: 'SHEETS_ERROR' })
    }
  }

  // PATCH /api/shopping-lists?id=xxx&itemId=yyy - Update shopping list item
  if (req.method === 'PATCH' && id && itemId && typeof id === 'string' && typeof itemId === 'string') {
    try {
      const { isChecked } = req.body

      if (typeof isChecked !== 'boolean') {
        return res.status(400).json({ error: 'isChecked must be a boolean', code: 'VALIDATION' })
      }

      const itemRows = await getRows(SHEETS.SHOPPING_LIST_ITEMS)
      const itemIndex = itemRows.findIndex((row, i) =>
        i > 0 && row[ITEM_COL.ID] === itemId && row[ITEM_COL.LIST_ID] === id
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

  // DELETE /api/shopping-lists?id=xxx - Delete shopping list
  if (req.method === 'DELETE' && id && typeof id === 'string') {
    try {
      const listResult = await findRowByColumn(SHEETS.SHOPPING_LISTS, LIST_COL.ID, id)
      if (!listResult) {
        return res.status(404).json({ error: 'List not found', code: 'NOT_FOUND' })
      }

      const itemRows = await getRows(SHEETS.SHOPPING_LIST_ITEMS)
      const itemsToDelete = itemRows
        .map((row, index) => ({ row, rowIndex: index + 1 }))
        .filter(({ row }) => row[ITEM_COL.LIST_ID] === id)
        .reverse()

      for (const { rowIndex } of itemsToDelete) {
        await deleteRow(SHEETS.SHOPPING_LIST_ITEMS, rowIndex)
      }

      await deleteRow(SHEETS.SHOPPING_LISTS, listResult.rowIndex)

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting shopping list:', error)
      return res.status(500).json({ error: 'Failed to delete shopping list', code: 'SHEETS_ERROR' })
    }
  }

  // GET /api/shopping-lists - Get all shopping lists
  if (req.method === 'GET') {
    try {
      const listRows = await getRows(SHEETS.SHOPPING_LISTS)
      const itemRows = await getRows(SHEETS.SHOPPING_LIST_ITEMS)
      const ingredientRows = await getRows(SHEETS.INGREDIENTS)

      const ingredientMap = new Map<string, string>()
      ingredientRows.slice(1).forEach(row => {
        ingredientMap.set(row[ING_COL.ID], row[ING_COL.DISPLAY_NAME] || row[ING_COL.NAME])
      })

      const now = new Date()
      const validLists: any[] = []
      const expiredListIds: string[] = []

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

      validLists.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      if (expiredListIds.length > 0) {
        console.log(`Found ${expiredListIds.length} expired shopping lists to clean up`)
      }

      return res.status(200).json({ lists: validLists })
    } catch (error) {
      console.error('Error fetching shopping lists:', error)
      return res.status(500).json({ error: 'Failed to fetch shopping lists', code: 'SHEETS_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
