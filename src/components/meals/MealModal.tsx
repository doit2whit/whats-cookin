import { useState, useEffect } from 'react'
import { X, Star, Heart, Zap, Plus, Trash2, Search, Flame, Utensils } from 'lucide-react'
import { clsx } from 'clsx'
import type { Meal, MealFormData, MealType, Chef, StoreSection, Unit, IngredientEntry, Ingredient } from '@/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface MealModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: MealFormData) => Promise<void>
  onDelete?: () => Promise<void>
  meal?: Meal | null
  selectedDate?: string
  isCalendarEntry?: boolean // true when adding from calendar (not editing a meal itself)
  onAddAsLeftovers?: (mealId: string, notes: string) => Promise<void> // For adding leftovers to calendar
}

const STORE_SECTIONS: StoreSection[] = ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery', 'beverages', 'other']
const UNITS: Unit[] = ['', 'cup', 'cups', 'lb', 'lbs', 'tbsp', 'tsp', 'ml', 'g', 'oz', 'qt', 'count', 'cloves', 'cans', 'packages', 'bunches', 'heads', 'slices']

const defaultFormData: MealFormData = {
  name: '',
  cuisineType: [],
  chef: 'Ian',
  isLeftovers: false,
  isFavorite: false,
  isQuick: false,
  notes: '',
  ianRating: null,
  hannaRating: null,
  mealType: 'homemade',
  restaurantName: '',
  friendName: '',
  effort: null,
  ingredients: [],
}

export default function MealModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  meal,
selectedDate: _selectedDate,
  isCalendarEntry,
  onAddAsLeftovers,
}: MealModalProps) {
  const [formData, setFormData] = useState<MealFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cuisineSearch, setCuisineSearch] = useState('')
  const [cuisineSuggestions, setCuisineSuggestions] = useState<string[]>([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientSuggestions, setIngredientSuggestions] = useState<Ingredient[]>([])
  const [showCuisineDropdown, setShowCuisineDropdown] = useState(false)
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false)

  // Leftover mode state
  const [isLeftoverMode, setIsLeftoverMode] = useState(false)
  const [leftoverMealSearch, setLeftoverMealSearch] = useState('')
  const [leftoverMealSuggestions, setLeftoverMealSuggestions] = useState<Meal[]>([])
  const [selectedLeftoverMeal, setSelectedLeftoverMeal] = useState<Meal | null>(null)
  const [leftoverNotes, setLeftoverNotes] = useState('')

  // Reset form when meal changes
  useEffect(() => {
    if (meal) {
      setFormData({
        name: meal.name,
        cuisineType: meal.cuisineType || [],
        chef: meal.chef,
        isLeftovers: meal.isLeftovers,
        isFavorite: meal.isFavorite,
        isQuick: meal.isQuick,
        notes: meal.notes,
        leftoverNotes: meal.leftoverNotes,
        ianRating: meal.ianRating,
        hannaRating: meal.hannaRating,
        mealType: meal.mealType,
        restaurantName: meal.restaurantName,
        friendName: meal.friendName,
        effort: meal.effort,
        ingredients: [],
      })
      setIsLeftoverMode(false)
      setSelectedLeftoverMeal(null)
      setLeftoverNotes('')
    } else {
      setFormData(defaultFormData)
      setIsLeftoverMode(false)
      setSelectedLeftoverMeal(null)
      setLeftoverNotes('')
    }
  }, [meal, isOpen])

  // Search for cuisines
  useEffect(() => {
    if (cuisineSearch.length > 0) {
      const fetchCuisines = async () => {
        try {
          const res = await fetch(`/api/cuisines?q=${encodeURIComponent(cuisineSearch)}`)
          if (res.ok) {
            const data = await res.json()
            setCuisineSuggestions(data.cuisines?.map((c: any) => c.name) || [])
          }
        } catch (e) {
          console.error('Failed to fetch cuisines:', e)
        }
      }
      fetchCuisines()
    } else {
      setCuisineSuggestions([])
    }
  }, [cuisineSearch])

  // Search for ingredients
  useEffect(() => {
    if (ingredientSearch.length > 0) {
      const fetchIngredients = async () => {
        try {
          const res = await fetch(`/api/ingredients/autocomplete?q=${encodeURIComponent(ingredientSearch)}`)
          if (res.ok) {
            const data = await res.json()
            setIngredientSuggestions(data.ingredients || [])
          }
        } catch (e) {
          console.error('Failed to fetch ingredients:', e)
        }
      }
      fetchIngredients()
    } else {
      setIngredientSuggestions([])
    }
  }, [ingredientSearch])

  // Search for meals (for leftover mode)
  useEffect(() => {
    if (leftoverMealSearch.length > 0) {
      const fetchMeals = async () => {
        try {
          const res = await fetch(`/api/meals/autocomplete?q=${encodeURIComponent(leftoverMealSearch)}`)
          if (res.ok) {
            const data = await res.json()
            setLeftoverMealSuggestions(data.meals || [])
          }
        } catch (e) {
          console.error('Failed to fetch meals:', e)
        }
      }
      fetchMeals()
    } else {
      setLeftoverMealSuggestions([])
    }
  }, [leftoverMealSearch])

  const handleSave = async () => {
    // If in leftover mode, use the special handler
    if (isLeftoverMode && onAddAsLeftovers && selectedLeftoverMeal) {
      setSaving(true)
      try {
        await onAddAsLeftovers(selectedLeftoverMeal.id, leftoverNotes)
        onClose()
      } catch (e) {
        console.error('Failed to add leftovers:', e)
      } finally {
        setSaving(false)
      }
      return
    }

    // Regular meal save
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (e) {
      console.error('Failed to save meal:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch (e) {
      console.error('Failed to delete meal:', e)
    } finally {
      setDeleting(false)
    }
  }

  const addCuisineTag = (tag: string) => {
    if (!formData.cuisineType.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        cuisineType: [...prev.cuisineType, tag],
      }))
    }
    setCuisineSearch('')
    setShowCuisineDropdown(false)
  }

  const removeCuisineTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      cuisineType: prev.cuisineType.filter(t => t !== tag),
    }))
  }

  const addIngredient = (ingredient?: Ingredient) => {
    const newIngredient: IngredientEntry = {
      ingredientId: ingredient?.id,
      name: ingredient?.displayName || ingredientSearch,
      quantity: null,
      unit: ingredient?.defaultUnit || '',
      storeSection: ingredient?.storeSection || 'pantry',
      isCommonItem: ingredient?.isCommonItem || false,
    }
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, newIngredient],
    }))
    setIngredientSearch('')
    setShowIngredientDropdown(false)
  }

  const updateIngredient = (index: number, updates: Partial<IngredientEntry>) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, ...updates } : ing
      ),
    }))
  }

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }))
  }

  const setRating = (who: 'ian' | 'hanna', rating: number | null) => {
    setFormData(prev => ({
      ...prev,
      [who === 'ian' ? 'ianRating' : 'hannaRating']: rating,
    }))
  }

  const setEffort = (effort: number | null) => {
    setFormData(prev => ({ ...prev, effort }))
  }

  const canShowRatings = formData.mealType !== 'friends_house'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-xl font-display font-bold text-neutral-800">
            {isLeftoverMode ? 'Add Leftovers' : meal ? 'Edit Meal' : 'New Meal'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Toggle between new meal and leftovers (only when adding from calendar) */}
          {isCalendarEntry && !meal && onAddAsLeftovers && (
            <div className="flex gap-2">
              <Button
                variant={!isLeftoverMode ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setIsLeftoverMode(false)}
              >
                New Meal
              </Button>
              <Button
                variant={isLeftoverMode ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setIsLeftoverMode(true)}
                leftIcon={<Utensils className="w-4 h-4" />}
              >
                Leftovers
              </Button>
            </div>
          )}

          {/* Leftover Mode UI */}
          {isLeftoverMode ? (
            <div className="space-y-4">
              {/* Meal search */}
              <div>
                <label className="label">Select Meal</label>
                {selectedLeftoverMeal ? (
                  <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-3">
                    <span className="font-medium text-primary-700">{selectedLeftoverMeal.name}</span>
                    <button
                      onClick={() => setSelectedLeftoverMeal(null)}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={leftoverMealSearch}
                      onChange={(e) => setLeftoverMealSearch(e.target.value)}
                      placeholder="Search meals..."
                      className="input pl-9"
                    />
                    {leftoverMealSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {leftoverMealSuggestions.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedLeftoverMeal(m)
                              setLeftoverMealSearch('')
                              setLeftoverMealSuggestions([])
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center gap-2"
                          >
                            <span>{m.name}</span>
                            {m.cuisineType && m.cuisineType.length > 0 && (
                              <span className="text-xs text-neutral-400">
                                ({m.cuisineType.slice(0, 2).join(', ')})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Leftover notes */}
              <div>
                <label className="label">Leftover Notes (optional)</label>
                <textarea
                  value={leftoverNotes}
                  onChange={(e) => setLeftoverNotes(e.target.value)}
                  placeholder="e.g., Used the rest of the chicken..."
                  rows={3}
                  className="input"
                />
              </div>
            </div>
          ) : (
            /* Regular Meal Form */
            <>
              {/* Name */}
              <div>
                <label className="label">Meal Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Spaghetti Bolognese"
                  className="input"
                  autoFocus
                />
              </div>

              {/* Meal Type */}
              <div>
                <label className="label">Meal Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['homemade', 'restaurant', 'friends_house'] as MealType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mealType: type }))}
                      className={clsx(
                        'px-3 py-2 rounded-lg border transition-colors',
                        formData.mealType === type
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'border-neutral-200 hover:border-neutral-300'
                      )}
                    >
                      {type === 'homemade' ? 'Homemade' : type === 'restaurant' ? 'Restaurant' : "Friend's House"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Restaurant name (conditional) */}
              {formData.mealType === 'restaurant' && (
                <div>
                  <label className="label">Restaurant Name</label>
                  <input
                    type="text"
                    value={formData.restaurantName}
                    onChange={(e) => setFormData(prev => ({ ...prev, restaurantName: e.target.value }))}
                    placeholder="e.g., Olive Garden"
                    className="input"
                  />
                </div>
              )}

              {/* Friend name (conditional) */}
              {formData.mealType === 'friends_house' && (
                <div>
                  <label className="label">Friend's Name</label>
                  <input
                    type="text"
                    value={formData.friendName}
                    onChange={(e) => setFormData(prev => ({ ...prev, friendName: e.target.value }))}
                    placeholder="e.g., Mom"
                    className="input"
                  />
                </div>
              )}

              {/* Chef (only for homemade) */}
              {formData.mealType === 'homemade' && (
                <div>
                  <label className="label">Chef</label>
                  <div className="flex gap-2">
                    {(['Ian', 'Hanna', 'Other'] as Chef[]).map(chef => (
                      <button
                        key={chef}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, chef }))}
                        className={clsx(
                          'px-4 py-2 rounded-lg border transition-colors',
                          formData.chef === chef
                            ? chef === 'Ian'
                              ? 'bg-primary-100 border-primary-300 text-primary-700'
                              : chef === 'Hanna'
                              ? 'bg-accent-100 border-accent-300 text-accent-700'
                              : 'bg-neutral-200 border-neutral-400 text-neutral-700'
                            : 'border-neutral-200 hover:border-neutral-300'
                        )}
                      >
                        {chef}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cuisine Tags */}
              <div>
                <label className="label">Cuisine Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.cuisineType.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-lg text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeCuisineTag(tag)}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={cuisineSearch}
                    onChange={(e) => setCuisineSearch(e.target.value)}
                    onFocus={() => setShowCuisineDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCuisineDropdown(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cuisineSearch.trim()) {
                        e.preventDefault()
                        addCuisineTag(cuisineSearch.trim())
                      }
                    }}
                    placeholder="Add cuisine tag..."
                    className="input"
                  />
                  {showCuisineDropdown && cuisineSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10">
                      {cuisineSuggestions.map(cuisine => (
                        <button
                          key={cuisine}
                          type="button"
                          onClick={() => addCuisineTag(cuisine)}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                        >
                          {cuisine}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFavorite}
                    onChange={(e) => setFormData(prev => ({ ...prev, isFavorite: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={clsx(
                    'flex items-center gap-1 px-3 py-2 rounded-lg border transition-colors',
                    formData.isFavorite
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'border-neutral-200 hover:border-neutral-300'
                  )}>
                    <Heart className={clsx('w-4 h-4', formData.isFavorite && 'fill-current')} />
                    Favorite
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isQuick}
                    onChange={(e) => setFormData(prev => ({ ...prev, isQuick: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={clsx(
                    'flex items-center gap-1 px-3 py-2 rounded-lg border transition-colors',
                    formData.isQuick
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-600'
                      : 'border-neutral-200 hover:border-neutral-300'
                  )}>
                    <Zap className="w-4 h-4" />
                    Quick Meal
                  </div>
                </label>
              </div>

              {/* Effort Indicator (only for homemade) */}
              {formData.mealType === 'homemade' && (
                <div>
                  <label className="label">Effort Level</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setEffort(formData.effort === level ? null : level)}
                        className="p-2 hover:bg-neutral-50 rounded-lg transition-colors"
                      >
                        <Flame
                          className={clsx(
                            'w-5 h-5',
                            formData.effort && level <= formData.effort
                              ? 'text-orange-500 fill-current'
                              : 'text-neutral-300'
                          )}
                        />
                      </button>
                    ))}
                    {formData.effort && (
                      <span className="ml-2 text-sm text-neutral-500">
                        {formData.effort === 1 ? 'Very Easy' :
                         formData.effort === 2 ? 'Easy' :
                         formData.effort === 3 ? 'Medium' :
                         formData.effort === 4 ? 'Hard' : 'Very Hard'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Ratings (not for friends_house) */}
              {canShowRatings && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Ian's Rating */}
                  <div>
                    <label className="label">Ian's Rating</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating('ian', formData.ianRating === star ? null : star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={clsx(
                              'w-6 h-6',
                              formData.ianRating && star <= formData.ianRating
                                ? 'text-yellow-500 fill-current'
                                : 'text-neutral-300'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hanna's Rating */}
                  <div>
                    <label className="label">Hanna's Rating</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating('hanna', formData.hannaRating === star ? null : star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={clsx(
                              'w-6 h-6',
                              formData.hannaRating && star <= formData.hannaRating
                                ? 'text-yellow-500 fill-current'
                                : 'text-neutral-300'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {formData.mealType === 'homemade' && (
                <div>
                  <label className="label">Ingredients</label>

                  {/* Ingredient list */}
                  {formData.ingredients.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-neutral-50 rounded-lg p-2">
                          <input
                            type="number"
                            value={ing.quantity ?? ''}
                            onChange={(e) => updateIngredient(idx, { quantity: e.target.value ? parseFloat(e.target.value) : null })}
                            placeholder="Qty"
                            className="input w-16 text-sm"
                            step="0.25"
                          />
                          <select
                            value={ing.unit}
                            onChange={(e) => updateIngredient(idx, { unit: e.target.value as Unit })}
                            className="input w-24 text-sm"
                          >
                            {UNITS.map(unit => (
                              <option key={unit} value={unit}>{unit || '(none)'}</option>
                            ))}
                          </select>
                          <span className="flex-1 text-sm font-medium truncate">{ing.name}</span>
                          <select
                            value={ing.storeSection}
                            onChange={(e) => updateIngredient(idx, { storeSection: e.target.value as StoreSection })}
                            className="input w-24 text-sm"
                          >
                            {STORE_SECTIONS.map(section => (
                              <option key={section} value={section}>{section}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-xs text-neutral-500" title="Common item (spices, etc.)">
                            <input
                              type="checkbox"
                              checked={ing.isCommonItem || false}
                              onChange={(e) => updateIngredient(idx, { isCommonItem: e.target.checked })}
                              className="w-3 h-3"
                            />
                            Common
                          </label>
                          <button
                            type="button"
                            onClick={() => removeIngredient(idx)}
                            className="text-neutral-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add ingredient */}
                  <div className="relative">
                    <input
                      type="text"
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      onFocus={() => setShowIngredientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowIngredientDropdown(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && ingredientSearch.trim()) {
                          e.preventDefault()
                          addIngredient()
                        }
                      }}
                      placeholder="Add ingredient..."
                      className="input"
                    />
                    {showIngredientDropdown && ingredientSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {ingredientSuggestions.map(ing => (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => addIngredient(ing)}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between"
                          >
                            <span>{ing.displayName}</span>
                            <span className="text-xs text-neutral-400">{ing.storeSection}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => ingredientSearch.trim() && addIngredient()}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any notes about this meal..."
                  rows={3}
                  className="input"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
          <div>
            {meal && onDelete && !isLeftoverMode && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="text-red-600 hover:bg-red-50"
              >
                {deleting ? <LoadingSpinner size="sm" /> : 'Delete'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || (isLeftoverMode ? !selectedLeftoverMeal : !formData.name.trim())}
            >
              {saving ? <LoadingSpinner size="sm" /> : isLeftoverMode ? 'Add Leftovers' : meal ? 'Save Changes' : 'Add Meal'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
