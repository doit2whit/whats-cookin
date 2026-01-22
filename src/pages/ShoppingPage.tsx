import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Plus, Check, Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import { useMeals } from '@/hooks/useMeals'
import type { Meal, ShoppingList, ShoppingListItem, StoreSection } from '@/types'

interface ShoppingListWithItems extends ShoppingList {
  items: (ShoppingListItem & { ingredientName: string })[]
}

async function fetchShoppingLists(): Promise<ShoppingListWithItems[]> {
  const response = await fetch('/api/shopping-lists')
  if (!response.ok) throw new Error('Failed to fetch shopping lists')
  const data = await response.json()
  return data.lists
}

async function generateShoppingList(mealIds: string[]): Promise<ShoppingListWithItems> {
  const response = await fetch('/api/shopping-lists/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mealIds }),
  })
  if (!response.ok) throw new Error('Failed to generate shopping list')
  const data = await response.json()
  return data.list
}

async function toggleItemChecked(listId: string, itemId: string, checked: boolean): Promise<void> {
  const response = await fetch(`/api/shopping-lists/${listId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isChecked: checked }),
  })
  if (!response.ok) throw new Error('Failed to update item')
}

async function deleteShoppingList(id: string): Promise<void> {
  const response = await fetch(`/api/shopping-lists/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete list')
}

const SECTION_ORDER: StoreSection[] = [
  'produce', 'meat', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'
]

const SECTION_LABELS: Record<StoreSection, string> = {
  produce: '🥬 Produce',
  meat: '🥩 Meat & Seafood',
  dairy: '🥛 Dairy',
  bakery: '🥖 Bakery',
  frozen: '🧊 Frozen',
  pantry: '🥫 Pantry',
  beverages: '🥤 Beverages',
  other: '📦 Other',
}

export default function ShoppingPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedMeals, setSelectedMeals] = useState<string[]>([])
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['shopping-lists'],
    queryFn: fetchShoppingLists,
  })

  const { meals } = useMeals()
  const homemadeMeals = meals.filter(m => m.mealType === 'homemade')

  const generateMutation = useMutation({
    mutationFn: generateShoppingList,
    onSuccess: (newList) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      setShowCreateModal(false)
      setSelectedMeals([])
      setExpandedLists(prev => new Set([...prev, newList.id]))
      toast.success('Shopping list created!')
    },
    onError: () => {
      toast.error('Failed to create shopping list')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ listId, itemId, checked }: { listId: string; itemId: string; checked: boolean }) =>
      toggleItemChecked(listId, itemId, checked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteShoppingList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      toast.success('List deleted')
    },
  })

  const toggleMealSelection = (mealId: string) => {
    setSelectedMeals(prev => {
      if (prev.includes(mealId)) {
        return prev.filter(id => id !== mealId)
      }
      if (prev.length >= 4) {
        toast.error('Maximum 4 meals per list')
        return prev
      }
      return [...prev, mealId]
    })
  }

  const handleGenerate = () => {
    if (selectedMeals.length === 0) {
      toast.error('Select at least one meal')
      return
    }
    generateMutation.mutate(selectedMeals)
  }

  const copyToClipboard = (list: ShoppingListWithItems) => {
    const groupedItems = groupBySection(list.items)
    let text = '🛒 Shopping List\n\n'

    SECTION_ORDER.forEach(section => {
      const items = groupedItems[section]
      if (items && items.length > 0) {
        text += `${SECTION_LABELS[section]}\n`
        items.forEach(item => {
          const checkbox = item.isChecked ? '☑' : '☐'
          text += `${checkbox} ${item.combinedQuantity} ${item.ingredientName}\n`
        })
        text += '\n'
      }
    })

    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const toggleListExpanded = (listId: string) => {
    setExpandedLists(prev => {
      const next = new Set(prev)
      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }
      return next
    })
  }

  const groupBySection = (items: ShoppingListWithItems['items']) => {
    return items.reduce((acc, item) => {
      const section = item.storeSection
      if (!acc[section]) acc[section] = []
      acc[section].push(item)
      return acc
    }, {} as Record<StoreSection, typeof items>)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-neutral-800">
          Shopping Lists
        </h1>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
          New List
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
          <ShoppingCart className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-700 mb-2">No shopping lists yet</h3>
          <p className="text-neutral-500 mb-4">
            Create a list by selecting meals you want to cook
          </p>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Create Your First List
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map(list => {
            const isExpanded = expandedLists.has(list.id)
            const groupedItems = groupBySection(list.items)
            const checkedCount = list.items.filter(i => i.isChecked).length
            const totalCount = list.items.length

            return (
              <div key={list.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50"
                  onClick={() => toggleListExpanded(list.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    )}
                    <div>
                      <h3 className="font-medium text-neutral-800">
                        {list.name || `List from ${new Date(list.createdAt).toLocaleDateString()}`}
                      </h3>
                      <p className="text-sm text-neutral-500">
                        {checkedCount}/{totalCount} items • Expires {new Date(list.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(list)}
                      leftIcon={<Copy className="w-4 h-4" />}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this shopping list?')) {
                          deleteMutation.mutate(list.id)
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-neutral-400" />
                    </Button>
                  </div>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="border-t border-neutral-200 p-4 space-y-4">
                    {SECTION_ORDER.map(section => {
                      const items = groupedItems[section]
                      if (!items || items.length === 0) return null

                      return (
                        <div key={section}>
                          <h4 className="text-sm font-medium text-neutral-600 mb-2">
                            {SECTION_LABELS[section]}
                          </h4>
                          <div className="space-y-1">
                            {items.map(item => (
                              <label
                                key={item.id}
                                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer ${
                                  item.isChecked ? 'opacity-60' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.isChecked}
                                  onChange={(e) => {
                                    toggleMutation.mutate({
                                      listId: list.id,
                                      itemId: item.id,
                                      checked: e.target.checked,
                                    })
                                  }}
                                  className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                                />
                                <span className={item.isChecked ? 'line-through text-neutral-400' : ''}>
                                  <span className="font-medium">{item.combinedQuantity}</span>{' '}
                                  {item.ingredientName}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create List Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setSelectedMeals([])
        }}
        title="Create Shopping List"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            Select 1-4 meals to generate a shopping list from their ingredients.
          </p>

          {homemadeMeals.length === 0 ? (
            <p className="text-center py-8 text-neutral-500">
              No homemade meals with ingredients found. Add some meals first!
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {homemadeMeals.map(meal => (
                <label
                  key={meal.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedMeals.includes(meal.id)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMeals.includes(meal.id)}
                    onChange={() => toggleMealSelection(meal.id)}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-800 truncate">{meal.name}</p>
                    {meal.cuisineType.length > 0 && (
                      <p className="text-sm text-neutral-500">{meal.cuisineType.join(', ')}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                setSelectedMeals([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              isLoading={generateMutation.isPending}
              disabled={selectedMeals.length === 0}
            >
              Generate List ({selectedMeals.length} meal{selectedMeals.length !== 1 ? 's' : ''})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
