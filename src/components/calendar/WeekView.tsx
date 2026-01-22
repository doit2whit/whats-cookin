import { useMemo, useState } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from 'date-fns'
import type { CalendarEntry, Meal } from '@/types'
import MealCard from './MealCard'
import MealModal from '@/components/meals/MealModal'
import { Plus } from 'lucide-react'

interface WeekViewProps {
  currentDate: Date
  entries: (CalendarEntry & { meal: Meal })[]
  isLoading: boolean
}

export default function WeekView({ currentDate, entries, isLoading }: WeekViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<1 | 2>(1)

  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate)
    const weekEnd = endOfWeek(currentDate)
    return eachDayOfInterval({ start: weekStart, end: weekEnd })
  }, [currentDate])

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, (CalendarEntry & { meal: Meal })[]>()
    entries.forEach(entry => {
      const key = entry.date
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(entry)
    })
    return map
  }, [entries])

  const handleAddClick = (date: Date, slot: 1 | 2) => {
    setSelectedDate(date)
    setSelectedSlot(slot)
  }

  const handleCloseModal = () => {
    setSelectedDate(null)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayEntries = entriesByDate.get(dateKey) || []
          const slot1Entry = dayEntries.find(e => e.slot === 1)
          const slot2Entry = dayEntries.find(e => e.slot === 2)
          const dayIsToday = isToday(day)

          return (
            <div
              key={dateKey}
              className={`bg-white rounded-xl border ${
                dayIsToday ? 'border-primary-300 ring-2 ring-primary-100' : 'border-neutral-200'
              } overflow-hidden`}
            >
              {/* Day header */}
              <div className={`px-3 py-2 border-b ${
                dayIsToday ? 'bg-primary-50 border-primary-200' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <div className="text-xs font-medium text-neutral-500 uppercase">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-lg font-semibold ${
                  dayIsToday ? 'text-primary-700' : 'text-neutral-800'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>

              {/* Meal slots */}
              <div className="p-3 space-y-2 min-h-[120px]">
                {/* Slot 1 */}
                {slot1Entry ? (
                  <MealCard
                    entry={slot1Entry}
                    compact
                    onClick={() => handleAddClick(day, 1)}
                  />
                ) : (
                  <button
                    onClick={() => handleAddClick(day, 1)}
                    className="w-full p-3 border-2 border-dashed border-neutral-200 rounded-lg text-neutral-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Add dinner</span>
                  </button>
                )}

                {/* Slot 2 */}
                {slot2Entry ? (
                  <MealCard
                    entry={slot2Entry}
                    compact
                    onClick={() => handleAddClick(day, 2)}
                  />
                ) : dayEntries.length > 0 ? (
                  <button
                    onClick={() => handleAddClick(day, 2)}
                    className="w-full p-2 border-2 border-dashed border-neutral-200 rounded-lg text-neutral-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span className="text-xs">Add second</span>
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Meal Modal */}
      <MealModal
        isOpen={selectedDate !== null}
        onClose={handleCloseModal}
        date={selectedDate}
        slot={selectedSlot}
        existingEntries={
          selectedDate
            ? entriesByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
            : []
        }
      />
    </>
  )
}
