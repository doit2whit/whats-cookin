import { useMemo, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { clsx } from 'clsx'
import type { CalendarEntry, Meal } from '@/types'
import DayCell from './DayCell'
import MealModal from '@/components/meals/MealModal'

interface MonthViewProps {
  currentDate: Date
  entries: (CalendarEntry & { meal: Meal })[]
  isLoading: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MonthView({ currentDate, entries, isLoading }: MonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<1 | 2>(1)

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
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

  const handleDayClick = (date: Date, slot: 1 | 2 = 1) => {
    setSelectedDate(date)
    setSelectedSlot(slot)
  }

  const handleCloseModal = () => {
    setSelectedDate(null)
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
          {WEEKDAYS.map(day => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-neutral-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayEntries = entriesByDate.get(dateKey) || []
            const isCurrentMonth = isSameMonth(day, currentDate)

            return (
              <DayCell
                key={dateKey}
                date={day}
                entries={dayEntries}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday(day)}
                onClick={handleDayClick}
                isLoading={isLoading}
                isFirstRow={index < 7}
                isFirstCol={index % 7 === 0}
              />
            )
          })}
        </div>
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
