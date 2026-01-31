import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { useCalendar } from '@/hooks/useCalendar'
import { useMeals } from '@/hooks/useMeals'
import MealCard from '@/components/calendar/MealCard'
import MealModal from '@/components/meals/MealModal'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { CalendarEntry, Meal, MealFormData, CalendarView } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Date[] = []

  // Add padding days from previous month
  for (let i = 0; i < firstDay.getDay(); i++) {
    const d = new Date(year, month, -i)
    days.unshift(d)
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Add padding days from next month
  const remaining = 42 - days.length // 6 weeks * 7 days
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = []
  const startOfWeek = new Date(date)
  startOfWeek.setDate(date.getDate() - date.getDay())

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    days.push(d)
  }

  return days
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showMealModal, setShowMealModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<(CalendarEntry & { meal: Meal }) | null>(null)

  const { createMeal, updateMeal } = useMeals()

  // Calculate date range for fetching
  const { startDate, endDate, days } = useMemo(() => {
    if (view === 'month') {
      const d = getMonthDays(currentDate.getFullYear(), currentDate.getMonth())
      return {
        startDate: formatDate(d[0]),
        endDate: formatDate(d[d.length - 1]),
        days: d,
      }
    } else {
      const d = getWeekDays(currentDate)
      return {
        startDate: formatDate(d[0]),
        endDate: formatDate(d[d.length - 1]),
        days: d,
      }
    }
  }, [view, currentDate])

  const { entries, isLoading, createEntry, deleteEntry } = useCalendar(startDate, endDate)

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map: Record<string, (CalendarEntry & { meal: Meal })[]> = {}
    entries.forEach(entry => {
      if (!map[entry.date]) map[entry.date] = []
      map[entry.date].push(entry)
    })
    return map
  }, [entries])

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const handleDayClick = (date: Date) => {
    setSelectedDate(formatDate(date))
    setEditingEntry(null)
    setShowMealModal(true)
  }

  const handleEntryClick = (entry: CalendarEntry & { meal: Meal }, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEntry(entry)
    setSelectedDate(entry.date)
    setShowMealModal(true)
  }

  const handleSaveMeal = async (data: MealFormData) => {
    if (editingEntry?.meal) {
      // Editing existing meal - update it, don't create new calendar entry
      await updateMeal({ id: editingEntry.meal.id, data })
    } else {
      // Creating new meal - create it and add to calendar
      const meal = await createMeal(data)
      if (selectedDate) {
        await createEntry({
          date: selectedDate,
          mealId: meal.id,
          slot: 1,
        })
      }
    }
  }

  const handleAddLeftovers = async (mealId: string, notes: string) => {
    if (selectedDate) {
      await createEntry({
        date: selectedDate,
        mealId,
        isLeftoverEntry: true,
        leftoverNotes: notes,
      })
    }
  }

  const handleDeleteEntry = async () => {
    if (editingEntry) {
      await deleteEntry(editingEntry.id)
    }
  }

  const isToday = (date: Date) => formatDate(date) === formatDate(new Date())
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-display font-bold text-neutral-800">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('prev')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <button
              onClick={() => navigate('next')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('month')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors',
              view === 'month'
                ? 'bg-primary-100 text-primary-700'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors',
              view === 'week'
                ? 'bg-primary-100 text-primary-700'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <Calendar className="w-4 h-4" />
            Week
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : view === 'month' ? (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
            {DAYS.map(day => (
              <div key={day} className="py-2 text-center text-sm font-medium text-neutral-500">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {days.map((date, idx) => {
              const dateStr = formatDate(date)
              const dayEntries = entriesByDate[dateStr] || []

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(date)}
                  className={clsx(
                    'min-h-[100px] p-1 border-b border-r border-neutral-100 cursor-pointer transition-colors hover:bg-neutral-50',
                    !isCurrentMonth(date) && 'bg-neutral-50/50',
                    isToday(date) && 'bg-primary-50/50'
                  )}
                >
                  <div
                    className={clsx(
                      'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                      isToday(date) && 'bg-primary-600 text-white',
                      !isToday(date) && !isCurrentMonth(date) && 'text-neutral-400',
                      !isToday(date) && isCurrentMonth(date) && 'text-neutral-700'
                    )}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEntries.slice(0, 2).map(entry => (
                      <MealCard
                        key={entry.id}
                        entry={entry}
                        compact
                        onClick={(e) => handleEntryClick(entry, e)}
                      />
                    ))}
                    {dayEntries.length > 2 && (
                      <div className="text-xs text-neutral-500 pl-2">
                        +{dayEntries.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Week view */
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-neutral-200">
            {days.map((date, idx) => {
              const dateStr = formatDate(date)
              const dayEntries = entriesByDate[dateStr] || []

              return (
                <div key={idx} className="min-h-[400px]">
                  {/* Day header */}
                  <div
                    className={clsx(
                      'p-3 text-center border-b border-neutral-200',
                      isToday(date) ? 'bg-primary-50' : 'bg-neutral-50'
                    )}
                  >
                    <div className="text-xs font-medium text-neutral-500 uppercase">
                      {DAYS[date.getDay()]}
                    </div>
                    <div
                      className={clsx(
                        'text-lg font-bold mt-1',
                        isToday(date) ? 'text-primary-600' : 'text-neutral-800'
                      )}
                    >
                      {date.getDate()}
                    </div>
                  </div>

                  {/* Day content */}
                  <div
                    className="p-2 space-y-2 cursor-pointer hover:bg-neutral-50 min-h-[300px]"
                    onClick={() => handleDayClick(date)}
                  >
                    {dayEntries.map(entry => (
                      <MealCard
                        key={entry.id}
                        entry={entry}
                        onClick={(e) => handleEntryClick(entry, e)}
                      />
                    ))}
                    {dayEntries.length === 0 && (
                      <div className="flex items-center justify-center h-full text-neutral-300 hover:text-primary-400 transition-colors">
                        <Plus className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Meal Modal */}
      <MealModal
        isOpen={showMealModal}
        onClose={() => {
          setShowMealModal(false)
          setEditingEntry(null)
          setSelectedDate(null)
        }}
        onSave={handleSaveMeal}
        onDelete={editingEntry ? handleDeleteEntry : undefined}
        meal={editingEntry?.meal}
        selectedDate={selectedDate || undefined}
        isCalendarEntry={true}
        onAddAsLeftovers={handleAddLeftovers}
      />
    </div>
  )
}
