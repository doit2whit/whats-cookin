import { format } from 'date-fns'
import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import type { CalendarEntry, Meal } from '@/types'
import MealCard from './MealCard'

interface DayCellProps {
  date: Date
  entries: (CalendarEntry & { meal: Meal })[]
  isCurrentMonth: boolean
  isToday: boolean
  onClick: (date: Date, slot: 1 | 2) => void
  isLoading: boolean
  isFirstRow: boolean
  isFirstCol: boolean
}

export default function DayCell({
  date,
  entries,
  isCurrentMonth,
  isToday,
  onClick,
  isLoading,
  isFirstRow,
  isFirstCol,
}: DayCellProps) {
  const slot1Entry = entries.find(e => e.slot === 1)
  const slot2Entry = entries.find(e => e.slot === 2)
  const canAddMore = entries.length < 2

  const handleClick = () => {
    if (slot1Entry && !slot2Entry) {
      onClick(date, 2)
    } else {
      onClick(date, 1)
    }
  }

  return (
    <div
      className={clsx(
        'min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 transition-colors',
        !isFirstRow && 'border-t border-neutral-200',
        !isFirstCol && 'border-l border-neutral-200',
        isCurrentMonth ? 'bg-white' : 'bg-neutral-50',
        canAddMore && 'cursor-pointer hover:bg-primary-50/50'
      )}
      onClick={canAddMore ? handleClick : undefined}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={clsx(
            'inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-medium',
            isToday && 'bg-primary-600 text-white',
            !isToday && isCurrentMonth && 'text-neutral-700',
            !isToday && !isCurrentMonth && 'text-neutral-400'
          )}
        >
          {format(date, 'd')}
        </span>

        {canAddMore && isCurrentMonth && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
            className="p-0.5 text-neutral-400 hover:text-primary-500 hover:bg-primary-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Meal entries */}
      <div className="space-y-1">
        {slot1Entry && (
          <MealCard
            entry={slot1Entry}
            compact
            onClick={(e) => {
              e.stopPropagation()
              onClick(date, 1)
            }}
          />
        )}
        {slot2Entry && (
          <MealCard
            entry={slot2Entry}
            compact
            onClick={(e) => {
              e.stopPropagation()
              onClick(date, 2)
            }}
          />
        )}
      </div>
    </div>
  )
}
