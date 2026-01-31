import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, Star, Heart, Zap, UtensilsCrossed, Users, ChevronDown, ChevronUp, Flame } from 'lucide-react'
import { useMeals } from '@/hooks/useMeals'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import type { Meal, MealHistoryEntry } from '@/types'

type SortOption = 'frequency' | 'recent' | 'name' | 'rating'

interface MealWithHistory extends Meal {
  history?: MealHistoryEntry[]
  ingredients?: any[]
}

export default function DinnersPage() {
  const { meals, isLoading, error } = useMeals()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [filterCuisine, setFilterCuisine] = useState<string>('')
  const [filterMinRating, setFilterMinRating] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null)
  const [expandedMealData, setExpandedMealData] = useState<MealWithHistory | null>(null)
  const [loadingExpanded, setLoadingExpanded] = useState(false)

  // Get unique cuisines from all meals
  const allCuisines = useMemo(() => {
    const cuisineSet = new Set<string>()
    meals.forEach(meal => {
      meal.cuisineType?.forEach(c => cuisineSet.add(c))
    })
    return Array.from(cuisineSet).sort()
  }, [meals])

  // Filter and sort meals
  const filteredMeals = useMemo(() => {
    let result = [...meals]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(meal =>
        meal.name.toLowerCase().includes(query) ||
        meal.cuisineType?.some(c => c.toLowerCase().includes(query)) ||
        meal.restaurantName?.toLowerCase().includes(query) ||
        meal.friendName?.toLowerCase().includes(query)
      )
    }

    // Cuisine filter
    if (filterCuisine) {
      result = result.filter(meal =>
        meal.cuisineType?.includes(filterCuisine)
      )
    }

    // Rating filter
    if (filterMinRating) {
      result = result.filter(meal => {
        const avgRating = getAverageRating(meal)
        return avgRating !== null && avgRating >= filterMinRating
      })
    }

    // Sort - with proper null handling to prevent crashes
    switch (sortBy) {
      case 'frequency':
        result.sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
        break
      case 'recent':
        result.sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0
          if (!a.lastUsed) return 1
          if (!b.lastUsed) return -1
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        })
        break
      case 'name':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'rating':
        result.sort((a, b) => {
          const ratingA = getAverageRating(a)
          const ratingB = getAverageRating(b)
          // Put unrated meals at the end
          if (ratingA === null && ratingB === null) return 0
          if (ratingA === null) return 1
          if (ratingB === null) return -1
          return ratingB - ratingA
        })
        break
    }

    return result
  }, [meals, searchQuery, sortBy, filterCuisine, filterMinRating])

  const getAverageRating = (meal: Meal): number | null => {
    const ratings = [meal.ianRating, meal.hannaRating].filter((r): r is number => r !== null && r !== undefined)
    if (ratings.length === 0) return null
    return ratings.reduce((a, b) => a + b, 0) / ratings.length
  }

  const getTypeIcon = (meal: Meal) => {
    if (meal.mealType === 'restaurant') return <UtensilsCrossed className="w-4 h-4 text-restaurant" />
    if (meal.mealType === 'friends_house') return <Users className="w-4 h-4 text-friends" />
    return null
  }

  const clearFilters = () => {
    setFilterCuisine('')
    setFilterMinRating(null)
    setSearchQuery('')
  }

  const toggleExpanded = async (mealId: string) => {
    if (expandedMealId === mealId) {
      setExpandedMealId(null)
      setExpandedMealData(null)
      return
    }

    setExpandedMealId(mealId)
    setLoadingExpanded(true)

    try {
      const response = await fetch(`/api/meals/${mealId}`)
      if (response.ok) {
        const data = await response.json()
        setExpandedMealData(data.meal)
      }
    } catch (error) {
      console.error('Failed to fetch meal details:', error)
    } finally {
      setLoadingExpanded(false)
    }
  }

  // Effort indicator component
  const EffortIndicator = ({ effort }: { effort: number | null }) => {
    if (!effort) return null
    return (
      <div className="flex items-center gap-0.5" title={`Effort: ${effort}/5`}>
        {[1, 2, 3, 4, 5].map(level => (
          <Flame
            key={level}
            className={`w-3 h-3 ${level <= effort ? 'text-orange-500 fill-current' : 'text-neutral-300'}`}
          />
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-red-200">
        <p className="text-red-600 font-medium mb-2">Failed to load meals</p>
        <p className="text-neutral-500 text-sm mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800">All Dinners</h1>
          <p className="text-neutral-500">{meals.length} meals total</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search dinners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 pr-4"
          />
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="input pr-8 appearance-none cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="frequency">Most Frequent</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Alphabetical</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>

        {/* Toggle filters button */}
        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<SlidersHorizontal className="w-4 h-4" />}
        >
          Filters
          {(filterCuisine || filterMinRating) && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary-200 rounded text-xs">
              {[filterCuisine, filterMinRating].filter(Boolean).length}
            </span>
          )}
        </Button>

        {/* Clear filters */}
        {(filterCuisine || filterMinRating || searchQuery) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-neutral-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cuisine filter */}
          <div>
            <label className="label">Cuisine Type</label>
            <select
              value={filterCuisine}
              onChange={(e) => setFilterCuisine(e.target.value)}
              className="input"
            >
              <option value="">All cuisines</option>
              {allCuisines.map(cuisine => (
                <option key={cuisine} value={cuisine}>{cuisine}</option>
              ))}
            </select>
          </div>

          {/* Rating filter */}
          <div>
            <label className="label">Minimum Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setFilterMinRating(filterMinRating === rating ? null : rating)}
                  className={`p-2 rounded-lg transition-colors ${
                    filterMinRating === rating
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'hover:bg-neutral-100'
                  }`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      filterMinRating && rating <= filterMinRating
                        ? 'text-yellow-500 fill-current'
                        : 'text-neutral-300'
                    }`}
                  />
                </button>
              ))}
              {filterMinRating && (
                <span className="text-sm text-neutral-500">& up</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {filteredMeals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
          <p className="text-neutral-500">No dinners match your filters</p>
          <Button variant="ghost" onClick={clearFilters} className="mt-2">
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeals.map(meal => {
            const avgRating = getAverageRating(meal)
            const isExpanded = expandedMealId === meal.id

            return (
              <div
                key={meal.id}
                className={`bg-white rounded-xl border transition-all ${
                  isExpanded ? 'border-primary-300 shadow-md col-span-1 sm:col-span-2 lg:col-span-3' : 'border-neutral-200 hover:border-primary-200 hover:shadow-sm'
                }`}
              >
                {/* Card Header - Always visible */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpanded(meal.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getTypeIcon(meal)}
                      <h3 className="font-medium text-neutral-800 truncate">{meal.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {meal.isFavorite && <Heart className="w-4 h-4 text-favorite fill-current" />}
                      {meal.isQuick && <Zap className="w-4 h-4 text-quick" />}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                    </div>
                  </div>

                  {/* Subtitle */}
                  {meal.mealType === 'restaurant' && meal.restaurantName && (
                    <p className="text-sm text-neutral-500 mb-2">@ {meal.restaurantName}</p>
                  )}
                  {meal.mealType === 'friends_house' && meal.friendName && (
                    <p className="text-sm text-neutral-500 mb-2">@ {meal.friendName}'s</p>
                  )}

                  {/* Tags */}
                  {meal.cuisineType && meal.cuisineType.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {meal.cuisineType.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-neutral-100 rounded text-xs text-neutral-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm border-t border-neutral-100 pt-3 mt-3">
                    <div className="flex items-center gap-3">
                      {/* Rating */}
                      {avgRating !== null && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="font-medium">{avgRating.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Frequency */}
                      <span className="text-neutral-500">
                        Made {meal.useCount || 0}×
                      </span>

                      {/* Effort */}
                      <EffortIndicator effort={meal.effort} />
                    </div>

                    {/* Last made */}
                    {meal.lastUsed && (
                      <span className="text-neutral-400 text-xs">
                        {new Date(meal.lastUsed).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Individual ratings */}
                  {(meal.ianRating || meal.hannaRating) && (
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-neutral-100 text-xs text-neutral-500">
                      {meal.ianRating && (
                        <span className="flex items-center gap-1">
                          Ian: {meal.ianRating}<Star className="w-3 h-3 text-yellow-500 fill-current" />
                        </span>
                      )}
                      {meal.hannaRating && (
                        <span className="flex items-center gap-1">
                          Hanna: {meal.hannaRating}<Star className="w-3 h-3 text-yellow-500 fill-current" />
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-neutral-200 p-4 bg-neutral-50">
                    {loadingExpanded ? (
                      <div className="flex justify-center py-4">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : expandedMealData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Ingredients */}
                        <div>
                          <h4 className="font-medium text-neutral-700 mb-2">Ingredients</h4>
                          {expandedMealData.ingredients && expandedMealData.ingredients.length > 0 ? (
                            <ul className="space-y-1">
                              {expandedMealData.ingredients.map((ing: any) => (
                                <li key={ing.id} className="text-sm text-neutral-600">
                                  {ing.quantity && `${ing.quantity} `}
                                  {ing.unit && `${ing.unit} `}
                                  {ing.ingredient?.displayName || ing.ingredientId}
                                  {ing.notes && <span className="text-neutral-400"> ({ing.notes})</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-neutral-400">No ingredients listed</p>
                          )}
                        </div>

                        {/* History */}
                        <div>
                          <h4 className="font-medium text-neutral-700 mb-2">History</h4>
                          {expandedMealData.history && expandedMealData.history.length > 0 ? (
                            <ul className="space-y-1 max-h-40 overflow-y-auto">
                              {expandedMealData.history.map((entry: MealHistoryEntry, idx: number) => (
                                <li key={idx} className="text-sm text-neutral-600 flex items-center gap-2">
                                  <span>{new Date(entry.date).toLocaleDateString()}</span>
                                  <span className="text-neutral-400">•</span>
                                  <span>{entry.chef}</span>
                                  {entry.isLeftoverEntry && (
                                    <span className="text-xs bg-neutral-200 px-1.5 py-0.5 rounded">Leftovers</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-neutral-400">Never made</p>
                          )}
                        </div>

                        {/* Notes Section */}
                        {(expandedMealData.notes || expandedMealData.leftoverNotes) && (
                          <div className="md:col-span-2">
                            {expandedMealData.notes && (
                              <div className="mb-3">
                                <h4 className="font-medium text-neutral-700 mb-1">Notes</h4>
                                <p className="text-sm text-neutral-600 whitespace-pre-wrap">{expandedMealData.notes}</p>
                              </div>
                            )}
                            {expandedMealData.leftoverNotes && (
                              <div>
                                <h4 className="font-medium text-neutral-700 mb-1">Leftover Notes</h4>
                                <p className="text-sm text-neutral-600 whitespace-pre-wrap">{expandedMealData.leftoverNotes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">Failed to load details</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
