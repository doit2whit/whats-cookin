import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { IngredientEntry, Unit, StoreSection } from '@/types'
import IngredientAutocomplete from './IngredientAutocomplete'

interface IngredientInputProps {
  value: IngredientEntry[]
  onChange: (ingredients: IngredientEntry[]) => void
}

const UNITS: { value: Unit; label: string }[] = [
  { value: '', label: 'count' },
  { value: 'cup', label: 'cup' },
  { value: 'cups', label: 'cups' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'tsp', label: 'tsp' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
  { value: 'lbs', label: 'lbs' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'qt', label: 'qt' },
  { value: 'cloves', label: 'cloves' },
  { value: 'cans', label: 'cans' },
  { value: 'packages', label: 'packages' },
  { value: 'bunches', label: 'bunches' },
  { value: 'heads', label: 'heads' },
  { value: 'slices', label: 'slices' },
]

const STORE_SECTIONS: { value: StoreSection; label: string }[] = [
  { value: 'produce', label: 'Produce' },
  { value: 'meat', label: 'Meat' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'other', label: 'Other' },
]

const emptyIngredient: IngredientEntry = {
  name: '',
  quantity: null,
  unit: '',
  storeSection: 'pantry',
}

export default function IngredientInput({ value, onChange }: IngredientInputProps) {
  const [showForm, setShowForm] = useState(value.length > 0)

  const addIngredient = () => {
    onChange([...value, { ...emptyIngredient }])
    setShowForm(true)
  }

  const updateIngredient = (index: number, updates: Partial<IngredientEntry>) => {
    const newIngredients = [...value]
    newIngredients[index] = { ...newIngredients[index], ...updates }
    onChange(newIngredients)
  }

  const removeIngredient = (index: number) => {
    const newIngredients = value.filter((_, i) => i !== index)
    onChange(newIngredients)
    if (newIngredients.length === 0) {
      setShowForm(false)
    }
  }

  if (!showForm) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addIngredient}
        leftIcon={<Plus className="w-4 h-4" />}
      >
        Add Ingredients
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      {value.map((ingredient, index) => (
        <div
          key={index}
          className="grid grid-cols-12 gap-2 items-start p-3 bg-neutral-50 rounded-lg"
        >
          {/* Quantity */}
          <div className="col-span-2">
            <label className="text-xs text-neutral-500 mb-1 block">Qty</label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={ingredient.quantity ?? ''}
              onChange={(e) => updateIngredient(index, {
                quantity: e.target.value ? parseFloat(e.target.value) : null
              })}
              className="input text-sm"
              placeholder="2"
            />
          </div>

          {/* Unit */}
          <div className="col-span-2">
            <label className="text-xs text-neutral-500 mb-1 block">Unit</label>
            <select
              value={ingredient.unit}
              onChange={(e) => updateIngredient(index, { unit: e.target.value as Unit })}
              className="input text-sm"
            >
              {UNITS.map(unit => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>

          {/* Ingredient name with autocomplete */}
          <div className="col-span-4">
            <label className="text-xs text-neutral-500 mb-1 block">Ingredient</label>
            <IngredientAutocomplete
              value={ingredient.name}
              onChange={(name, existingIngredient) => {
                const updates: Partial<IngredientEntry> = { name }
                if (existingIngredient) {
                  updates.ingredientId = existingIngredient.id
                  updates.storeSection = existingIngredient.storeSection
                }
                updateIngredient(index, updates)
              }}
            />
          </div>

          {/* Store section */}
          <div className="col-span-3">
            <label className="text-xs text-neutral-500 mb-1 block">Section</label>
            <select
              value={ingredient.storeSection}
              onChange={(e) => updateIngredient(index, { storeSection: e.target.value as StoreSection })}
              className="input text-sm"
            >
              {STORE_SECTIONS.map(section => (
                <option key={section.value} value={section.value}>{section.label}</option>
              ))}
            </select>
          </div>

          {/* Remove button */}
          <div className="col-span-1 pt-6">
            <button
              type="button"
              onClick={() => removeIngredient(index)}
              className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addIngredient}
        leftIcon={<Plus className="w-4 h-4" />}
      >
        Add Another
      </Button>
    </div>
  )
}
