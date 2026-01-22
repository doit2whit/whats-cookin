import { useState } from 'react'
import { Search } from 'lucide-react'
import { useMealSearch, useMeals } from '@/hooks/useMeals'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Meal } from '@/types'

interface MealSelectorProps {
  onSelect: (mealId: string) => void
  isLoading: boolean
}

export default function MealSelector({ onSelect, isLoading }: MealSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Search results (includes hidden meals when typing)
  const { data: searchResults, isLoading: isSearching } = useMealSearch(
    searchQuery,
    searchQuery.length >= 1 // Include hidden meals when actively searching
  )

  // All meals for recent display
  const { meals, isLoading: isLoadingMeals } = useMeals()

  // Get recent meals (sorted by last used, limited to 6)
  const recentMeals = meals
    .filter(m => m.lastUsed)
    .sort((a, b) => {
      if (!a.lastUsed || !b.lastUsed) return 0
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    })
    .slice(0, 6)

  const displayMeals = searchQuery.length >= 1 ? searchResults || [] : recentMeals

  const renderMealItem = (meal: Meal) => (
    <button
      key={meal.id}
      onClick={() => onSelect(meal.id)}
      disabled={isLoading}
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-neutral-800">{meal.name}</span>
        {meal.cuisineType && meal.cuisineType.length > 0 && (
          <span className="text-xs text-neutral-500">
            {meal.cuisineType[0]}
          </span>
        )}
      </div>
      {meal.mealType !== 'homemade' && (
        <span className="text-xs text-neutral-500 capitalize">
          {meal.mealType === 'restaurant' ? `@ ${meal.restaurantName}` : `@ ${meal.friendName}'s`}
        </span>
      )}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search meals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="max-h-[300px] overflow-y-auto">
        {isSearching || isLoadingMeals ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : displayMeals.length === 0 ? (
          <p className="text-center py-8 text-neutral-500">
            {searchQuery ? 'No meals found' : 'No recent meals'}
          </p>
        ) : (
          <div className="space-y-1">
            {!searchQuery && (
              <p className="text-xs text-neutral-500 px-3 pb-2">Recent meals</p>
            )}
            {displayMeals.map(renderMealItem)}
          </div>
        )}
      </div>
    </div>
  )
}
