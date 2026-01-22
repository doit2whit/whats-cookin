import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Ingredient } from '@/types'

interface IngredientAutocompleteProps {
  value: string
  onChange: (name: string, existingIngredient?: Ingredient) => void
}

async function searchIngredients(query: string): Promise<Ingredient[]> {
  if (!query || query.length < 1) return []

  const response = await fetch(`/api/ingredients/autocomplete?q=${encodeURIComponent(query)}`)
  if (!response.ok) return []

  const data = await response.json()
  return data.ingredients || []
}

export default function IngredientAutocomplete({ value, onChange }: IngredientAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: suggestions = [] } = useQuery({
    queryKey: ['ingredients', 'search', inputValue],
    queryFn: () => searchIngredients(inputValue),
    enabled: inputValue.length >= 1,
    staleTime: 30 * 1000,
  })

  // Sync with external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    setHighlightIndex(-1)
    onChange(newValue) // Update parent with typed value
  }

  const handleSelectSuggestion = (ingredient: Ingredient) => {
    setInputValue(ingredient.displayName)
    setShowSuggestions(false)
    onChange(ingredient.displayName, ingredient)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0) {
          handleSelectSuggestion(suggestions[highlightIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        className="input text-sm"
        placeholder="e.g., Olive oil"
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((ingredient, index) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() => handleSelectSuggestion(ingredient)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                index === highlightIndex
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-neutral-50'
              }`}
            >
              <span>{ingredient.displayName}</span>
              <span className="text-xs text-neutral-400 capitalize">
                {ingredient.storeSection}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
