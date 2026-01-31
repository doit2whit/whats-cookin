import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Check, Copy, Plus, Trash2, Search, Package, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import type { Meal, ShoppingList, ShoppingListItem, StoreSection } from '@/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const SECTION_ORDER: StoreSection[] = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'other']

const SECTION_NAMES: Record<StoreSection, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat & Seafood',
  pantry: 'Pantry',
  frozen: 'Frozen',
  bakery: 'Bakery',
  beverages: 'Beverages',
  other: 'Other',
}

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [activeList, setActiveList] = useState<ShoppingList | null>(null)
  const [listItems, setListItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // New list form state
  const [showNewListForm, setShowNewListForm] = useState(false)
  const [mealSearch, setMealSearch] = useState('')
  const [mealSuggestions, setMealSuggestions] = useState<Meal[]>([])
  const [selectedMeals, setSelectedMeals] = useState<Meal[]>([])
  const [excludeCommonItems, setExcludeCommonItems] = useState(true) // Default to excluding spices/common items

  const [copiedFeedback, setCopiedFeedback] = useState(false)

  // Fetch lists
  useEffect(() => {
    fetchLists()
  }, [])

  const fetchLists = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shopping-lists')
      if (res.ok) {
        const data = await res.json()
        setLists(data.lists || [])
        // Auto-select most recent list
        if (data.lists && data.lists.length > 0) {
          setActiveList(data.lists[0])
        }
      }
    } catch (e) {
      console.error('Failed to fetch shopping lists:', e)
    } finally {
      setLoading(false)
    }
  }

  // Set items from active list (items are embedded in list from API)
  useEffect(() => {
    if (activeList) {
      setListItems(activeList.items || [])
    } else {
      setListItems([])
    }
  }, [activeList])

  // Search meals
  useEffect(() => {
    if (mealSearch.length > 0) {
      const searchMeals = async () => {
        try {
          const res = await fetch(`/api/meals/autocomplete?q=${encodeURIComponent(mealSearch)}`)
          if (res.ok) {
            const data = await res.json()
            // Filter out already selected meals
            const filtered = (data.meals || []).filter(
              (m: Meal) => !selectedMeals.some(sm => sm.id === m.id)
            )
            setMealSuggestions(filtered)
          }
        } catch (e) {
          console.error('Failed to search meals:', e)
        }
      }
      searchMeals()
    } else {
      setMealSuggestions([])
    }
  }, [mealSearch, selectedMeals])

  const addMealToSelection = (meal: Meal) => {
    if (selectedMeals.length < 4) {
      setSelectedMeals(prev => [...prev, meal])
    }
    setMealSearch('')
    setMealSuggestions([])
  }

  const removeMealFromSelection = (mealId: string) => {
    setSelectedMeals(prev => prev.filter(m => m.id !== mealId))
  }

  const generateList = async () => {
    if (selectedMeals.length === 0) return

    setGenerating(true)
    try {
      const res = await fetch('/api/shopping-lists/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealIds: selectedMeals.map(m => m.id),
          name: selectedMeals.map(m => m.name).join(', '),
          excludeCommonItems, // Pass the toggle value
        }),
      })

      if (res.ok) {
        const data = await res.json()
        // Refresh lists and select the new one
        await fetchLists()
        setActiveList(data.list)
        setShowNewListForm(false)
        setSelectedMeals([])
      }
    } catch (e) {
      console.error('Failed to generate list:', e)
    } finally {
      setGenerating(false)
    }
  }

  const toggleItemChecked = async (item: ShoppingListItem) => {
    // Optimistic update
    setListItems(prev =>
      prev.map(i => (i.id === item.id ? { ...i, isChecked: !i.isChecked } : i))
    )

    try {
      await fetch(`/api/shopping-lists/${activeList?.id}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: !item.isChecked }),
      })
    } catch (e) {
      // Revert on error
      setListItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, isChecked: item.isChecked } : i))
      )
      console.error('Failed to update item:', e)
    }
  }

  const deleteList = async (listId: string) => {
    try {
      await fetch(`/api/shopping-lists/${listId}`, { method: 'DELETE' })
      setLists(prev => prev.filter(l => l.id !== listId))
      if (activeList?.id === listId) {
        setActiveList(lists.find(l => l.id !== listId) || null)
      }
    } catch (e) {
      console.error('Failed to delete list:', e)
    }
  }

  // Group items by section
  const itemsBySection = useMemo(() => {
    const grouped: Record<StoreSection, ShoppingListItem[]> = {
      produce: [],
      dairy: [],
      meat: [],
      pantry: [],
      frozen: [],
      bakery: [],
      beverages: [],
      other: [],
    }

    listItems.forEach(item => {
      const section = item.storeSection || 'other'
      if (grouped[section]) {
        grouped[section].push(item)
      } else {
        grouped.other.push(item)
      }
    })

    // Sort items within each section by display order, then alphabetically
    Object.keys(grouped).forEach(section => {
      grouped[section as StoreSection].sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
        return (a.ingredientName || '').localeCompare(b.ingredientName || '')
      })
    })

    return grouped
  }, [listItems])

  const copyToClipboard = () => {
    const lines: string[] = []

    SECTION_ORDER.forEach(section => {
      const items = itemsBySection[section]
      if (items.length > 0) {
        lines.push(`\n${SECTION_NAMES[section]}:`)
        items.forEach(item => {
          const checkmark = item.isChecked ? '✓' : '○'
          lines.push(`${checkmark} ${item.combinedQuantity} ${item.ingredientName || 'Unknown'}`)
        })
      }
    })

    navigator.clipboard.writeText(lines.join('\n').trim())
    setCopiedFeedback(true)
    setTimeout(() => setCopiedFeedback(false), 2000)
  }

  const uncheckedCount = listItems.filter(i => !i.isChecked).length
  const totalCount = listItems.length

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-display font-bold text-neutral-800">Shopping Lists</h1>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowNewListForm(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New List
        </Button>
      </div>

      {/* New List Form */}
      {showNewListForm && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-800">Create Shopping List</h2>
            <button
              onClick={() => {
                setShowNewListForm(false)
                setSelectedMeals([])
              }}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Selected meals */}
          {selectedMeals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMeals.map(meal => (
                <div
                  key={meal.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-sm"
                >
                  <span className="font-medium text-primary-700">{meal.name}</span>
                  <button
                    onClick={() => removeMealFromSelection(meal.id)}
                    className="text-primary-400 hover:text-primary-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Meal search */}
          {selectedMeals.length < 4 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={mealSearch}
                onChange={(e) => setMealSearch(e.target.value)}
                placeholder={`Add meal (${selectedMeals.length}/4)...`}
                className="input pl-9"
              />
              {mealSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {mealSuggestions.map(meal => (
                    <button
                      key={meal.id}
                      type="button"
                      onClick={() => addMealToSelection(meal)}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between"
                    >
                      <span>{meal.name}</span>
                      {meal.cuisineType && meal.cuisineType.length > 0 && (
                        <span className="text-xs text-neutral-400">
                          {meal.cuisineType.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Exclude common items toggle */}
          <label className="flex items-center gap-3 cursor-pointer py-2 px-3 bg-neutral-50 rounded-lg">
            <input
              type="checkbox"
              checked={excludeCommonItems}
              onChange={(e) => setExcludeCommonItems(e.target.checked)}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
            />
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-neutral-700">
                Exclude spices & common items
              </span>
            </div>
            <span className="text-xs text-neutral-400 ml-auto">
              (salt, pepper, olive oil, etc.)
            </span>
          </label>

          <Button
            variant="primary"
            onClick={generateList}
            disabled={selectedMeals.length === 0 || generating}
            className="w-full"
          >
            {generating ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Generating...</span>
              </>
            ) : (
              `Generate List (${selectedMeals.length} meal${selectedMeals.length !== 1 ? 's' : ''})`
            )}
          </Button>
        </div>
      )}

      {/* List selector */}
      {lists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => setActiveList(list)}
              className={clsx(
                'px-3 py-2 rounded-lg border text-sm transition-colors',
                activeList?.id === list.id
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'border-neutral-200 hover:border-neutral-300'
              )}
            >
              <div className="font-medium truncate max-w-[150px]">{list.name}</div>
              <div className="text-xs text-neutral-400">
                {new Date(list.createdAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active list */}
      {activeList ? (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* List header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 bg-neutral-50">
            <div>
              <h2 className="font-medium text-neutral-800">{activeList.name}</h2>
              <p className="text-xs text-neutral-400">
                {uncheckedCount} of {totalCount} remaining
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyToClipboard}
                leftIcon={copiedFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copiedFeedback ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteList(activeList.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* List items */}
          {listItems.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No items in this list</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {SECTION_ORDER.map(section => {
                const items = itemsBySection[section]
                if (items.length === 0) return null

                return (
                  <div key={section} className="p-4">
                    <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">
                      {SECTION_NAMES[section]}
                    </h3>
                    <div className="space-y-2">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => toggleItemChecked(item)}
                          className={clsx(
                            'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                            item.isChecked
                              ? 'bg-neutral-50 text-neutral-400'
                              : 'hover:bg-neutral-50'
                          )}
                        >
                          <div
                            className={clsx(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                              item.isChecked
                                ? 'bg-primary-500 border-primary-500'
                                : 'border-neutral-300'
                            )}
                          >
                            {item.isChecked && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span
                            className={clsx(
                              'flex-1 text-sm',
                              item.isChecked && 'line-through'
                            )}
                          >
                            {item.combinedQuantity && (
                              <span className="font-medium">{item.combinedQuantity} </span>
                            )}
                            {item.ingredientName || 'Unknown item'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
          <h2 className="text-lg font-medium text-neutral-700 mb-2">No shopping lists yet</h2>
          <p className="text-neutral-500 mb-4">Create a list from your favorite meals</p>
          <Button variant="primary" onClick={() => setShowNewListForm(true)}>
            Create Your First List
          </Button>
        </div>
      ) : null}
    </div>
  )
}
