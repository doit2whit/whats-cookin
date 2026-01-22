import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import MealForm from './MealForm'
import MealSelector from './MealSelector'
import Button from '@/components/ui/Button'
import { useMeals } from '@/hooks/useMeals'
import { useCalendar } from '@/hooks/useCalendar'
import type { CalendarEntry, Meal, MealFormData } from '@/types'
import { Trash2 } from 'lucide-react'

interface MealModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  slot: 1 | 2
  existingEntries: (CalendarEntry & { meal: Meal })[]
}

type ModalMode = 'select' | 'create' | 'edit'

export default function MealModal({
  isOpen,
  onClose,
  date,
  slot,
  existingEntries,
}: MealModalProps) {
  const [mode, setMode] = useState<ModalMode>('select')
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)

  const { createMeal, isCreating, updateMeal, isUpdating } = useMeals()

  // Find existing entry for this slot
  const existingEntry = existingEntries.find(e => e.slot === slot)

  // Get date range for calendar hook (just need current month for invalidation)
  const start = date ? format(new Date(date.getFullYear(), date.getMonth(), 1), 'yyyy-MM-dd') : ''
  const end = date ? format(new Date(date.getFullYear(), date.getMonth() + 1, 0), 'yyyy-MM-dd') : ''
  const { addEntry, deleteEntry, isAdding, isDeleting } = useCalendar(start, end)

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (existingEntry) {
        setMode('edit')
        setSelectedMealId(existingEntry.mealId)
      } else {
        setMode('select')
        setSelectedMealId(null)
      }
    }
  }, [isOpen, existingEntry])

  const handleSelectMeal = async (mealId: string) => {
    if (!date) return

    try {
      addEntry({
        date: format(date, 'yyyy-MM-dd'),
        mealId,
        slot,
      }, {
        onSuccess: () => {
          toast.success('Meal added to calendar!')
          onClose()
        },
        onError: () => {
          toast.error('Failed to add meal')
        },
      })
    } catch {
      toast.error('Failed to add meal')
    }
  }

  const handleCreateMeal = async (data: MealFormData) => {
    if (!date) return

    try {
      const newMeal = await createMeal(data)
      addEntry({
        date: format(date, 'yyyy-MM-dd'),
        mealId: newMeal.id,
        slot,
      }, {
        onSuccess: () => {
          toast.success('Meal created and added to calendar!')
          onClose()
        },
        onError: () => {
          toast.error('Failed to add meal to calendar')
        },
      })
    } catch {
      toast.error('Failed to create meal')
    }
  }

  const handleUpdateMeal = async (data: MealFormData) => {
    if (!existingEntry) return

    try {
      await updateMeal({ id: existingEntry.mealId, data })
      toast.success('Meal updated!')
      onClose()
    } catch {
      toast.error('Failed to update meal')
    }
  }

  const handleDeleteEntry = () => {
    if (!existingEntry) return

    if (confirm('Remove this meal from the calendar?')) {
      deleteEntry(existingEntry.id, {
        onSuccess: () => {
          toast.success('Meal removed from calendar')
          onClose()
        },
        onError: () => {
          toast.error('Failed to remove meal')
        },
      })
    }
  }

  const getTitle = () => {
    if (!date) return ''
    const dateStr = format(date, 'EEEE, MMMM d')

    if (mode === 'create') {
      return `Add New Meal - ${dateStr}`
    }
    if (mode === 'edit' && existingEntry) {
      return `Edit: ${existingEntry.meal.name}`
    }
    return `Add Dinner - ${dateStr}`
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size={mode === 'select' ? 'md' : 'lg'}
    >
      {mode === 'select' && (
        <div className="space-y-4">
          <MealSelector
            onSelect={handleSelectMeal}
            isLoading={isAdding}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-neutral-500">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setMode('create')}
          >
            Create New Meal
          </Button>
        </div>
      )}

      {mode === 'create' && (
        <MealForm
          onSubmit={handleCreateMeal}
          onCancel={() => setMode('select')}
          isSubmitting={isCreating || isAdding}
        />
      )}

      {mode === 'edit' && existingEntry && (
        <div className="space-y-4">
          <MealForm
            initialData={existingEntry.meal}
            onSubmit={handleUpdateMeal}
            onCancel={onClose}
            isSubmitting={isUpdating}
          />

          <div className="pt-4 border-t border-neutral-200">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteEntry}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Remove from Calendar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
