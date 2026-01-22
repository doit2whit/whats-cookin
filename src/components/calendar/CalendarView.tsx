import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar } from '@/hooks/useCalendar'
import MonthView from './MonthView'
import WeekView from './WeekView'
import Button from '@/components/ui/Button'
import type { CalendarView as ViewType } from '@/types'

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>('month')

  // Calculate date range for data fetching
  const { start, end } = useMemo(() => {
    if (viewType === 'month') {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      // Include days from prev/next month that appear in the calendar grid
      return {
        start: format(startOfWeek(monthStart), 'yyyy-MM-dd'),
        end: format(endOfWeek(monthEnd), 'yyyy-MM-dd'),
      }
    } else {
      const weekStart = startOfWeek(currentDate)
      const weekEnd = endOfWeek(currentDate)
      return {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      }
    }
  }, [currentDate, viewType])

  const { entries, isLoading } = useCalendar(start, end)

  const navigateBack = () => {
    if (viewType === 'month') {
      setCurrentDate(prev => subMonths(prev, 1))
    } else {
      setCurrentDate(prev => subWeeks(prev, 1))
    }
  }

  const navigateForward = () => {
    if (viewType === 'month') {
      setCurrentDate(prev => addMonths(prev, 1))
    } else {
      setCurrentDate(prev => addWeeks(prev, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const headerText = viewType === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={navigateBack}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>

          <h2 className="text-xl font-display font-semibold text-neutral-800 min-w-[200px] text-center">
            {headerText}
          </h2>

          <button
            onClick={navigateForward}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </button>

          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          <button
            onClick={() => setViewType('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewType === 'month'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewType('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewType === 'week'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar */}
      {viewType === 'month' ? (
        <MonthView
          currentDate={currentDate}
          entries={entries}
          isLoading={isLoading}
        />
      ) : (
        <WeekView
          currentDate={currentDate}
          entries={entries}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
