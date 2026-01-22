import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface CuisineTagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

// Common cuisine types for suggestions
const COMMON_CUISINES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian',
  'American', 'Mediterranean', 'Korean', 'Vietnamese', 'French',
  'Greek', 'Spanish', 'Middle Eastern', 'Comfort Food', 'Healthy',
  'BBQ', 'Seafood', 'Vegetarian', 'Vegan'
]

async function fetchCuisineTags(): Promise<string[]> {
  const response = await fetch('/api/cuisines')
  if (!response.ok) {
    return COMMON_CUISINES
  }
  const data = await response.json()
  return data.cuisines || COMMON_CUISINES
}

export default function CuisineTagInput({ value, onChange }: CuisineTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: allCuisines = COMMON_CUISINES } = useQuery({
    queryKey: ['cuisines'],
    queryFn: fetchCuisineTags,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Filter suggestions based on input
  const suggestions = allCuisines
    .filter(cuisine =>
      cuisine.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.includes(cuisine)
    )
    .slice(0, 6)

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

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim()
    if (normalizedTag && !value.includes(normalizedTag)) {
      onChange([...value, normalizedTag])
    }
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Tags and input */}
      <div className="flex flex-wrap gap-2 p-2 border border-neutral-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent bg-white">
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-md text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-primary-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? 'Add cuisine types...' : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (inputValue || value.length === 0) && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(cuisine => (
            <button
              key={cuisine}
              type="button"
              onClick={() => addTag(cuisine)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-3 h-3 text-neutral-400" />
              {cuisine}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
