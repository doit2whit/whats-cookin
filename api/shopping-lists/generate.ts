import type { VercelRequest, VercelResponse } from '@vercel/node'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../lib/auth'
import { getRows, appendRow, SHEETS } from '../lib/sheets'
import type { StoreSection } from '../../src/types'

const MEAL_ING_COL = {
  ID: 0,
  MEAL_ID: 1,
  INGREDIENT_ID: 2,
  QUANTITY: 3,
  UNIT: 4,
  NOTES: 5,
}

const ING_COL = {
  ID: 0,
  NAME: 1,
  DISPLAY_NAME: 2,
  STORE_SECTION: 3,
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

// Group and combine ingredients
function combineIngredients(amounts: IngredientAmount[]): Map<string, { display: string; section: StoreSection; name: string }> {
  // Group by ingredient ID
  const grouped = new Map<string, IngredientAmount[]>()

  amounts.forEach(amount => {
    const existing = grouped.get(amount.ingredientId) || []
    grouped.set(amount.ingredientId, [...existing, amount])
  })

  // Combine each ingredient's amounts
  const result = new Map<string, { display: string; section: StoreSection; name: string }>()

  grouped.forEach((amountList, ingredientId) => {
    const first = amountList[0]

    // Group by unit for combination
    const byUnit = new Map<string, number>()
    const nonCombinableNotes: string[] = []

    amountList.forEach(amount => {
      if (amount.quantity !== null && !amount.notes) {
        // Can combine
        const key = amount.unit || 'count'
        byUnit.set(key, (byUnit.get(key) || 0) + amount.quantity)
      } else if (amount.notes) {
        // Has notes, keep separate
        const part = amount.quantity
          ? `${amount.quantity}${amount.unit ? ' ' + amount.unit : ''} (${amount.notes})`
          : amount.notes
        nonCombinableNotes.push(part)
      } else if (amount.quantity !== null) {
        // Just quantity with unit
        const key = amount.unit || 'count'
        byUnit.set(key, (byUnit.get(key) || 0) + amount.quantity)
      }
    })

    // Build display string
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

// Section order for sorting
const SECTION_ORDER: StoreSection[] = [
  'produce', 'meat', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { mealIds } = req.body

    if (!mealIds || !Array.isArray(mealIds) || mealIds.length === 0) {
      return res.status(400).json({ error: 'At least one meal ID is required', code: 'VALIDATION' })
    }

    if (mealIds.length > 4) {
      return res.status(400).json({ error: 'Maximum 4 meals per shopping list', code: 'VALIDATION' })
    }

    // Get meal ingredients
    const mealIngredientRows = await getRows(SHEETS.MEAL_INGREDIENTS)
    const ingredientRows = await getRows(SHEETS.INGREDIENTS)

    // Create ingredient lookup
    const ingredientMap = new Map<string, { name: string; displayName: string; storeSection: StoreSection }>()
    ingredientRows.slice(1).forEach(row => {
      ingredientMap.set(row[ING_COL.ID], {
        name: row[ING_COL.NAME],
        displayName: row[ING_COL.DISPLAY_NAME] || row[ING_COL.NAME],
        storeSection: (row[ING_COL.STORE_SECTION] as StoreSection) || 'pantry',
      })
    })

    // Collect all ingredient amounts for selected meals
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

    // Combine ingredients
    const combined = combineIngredients(allAmounts)

    // Create shopping list
    const listId = uuid()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000) // 4 weeks

    await appendRow(SHEETS.SHOPPING_LISTS, [
      listId,
      '', // name (auto-generated)
      JSON.stringify(mealIds),
      now.toISOString(),
      expiresAt.toISOString(),
      user.email,
    ])

    // Create shopping list items, sorted by store section
    const items: any[] = []
    let displayOrder = 0

    SECTION_ORDER.forEach(section => {
      combined.forEach((data, ingredientId) => {
        if (data.section !== section) return

        const itemId = uuid()
        items.push({
          id: itemId,
          listId,
          ingredientId,
          combinedQuantity: data.display,
          storeSection: data.section,
          isChecked: false,
          displayOrder,
          ingredientName: data.name,
        })

        appendRow(SHEETS.SHOPPING_LIST_ITEMS, [
          itemId,
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
