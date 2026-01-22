import { Star } from 'lucide-react'
import { clsx } from 'clsx'

interface RatingStarsProps {
  value: number | null
  onChange: (value: number | null) => void
  readonly?: boolean
}

export default function RatingStars({ value, onChange, readonly = false }: RatingStarsProps) {
  const handleClick = (rating: number) => {
    if (readonly) return
    // Clicking the same star clears the rating
    if (value === rating) {
      onChange(null)
    } else {
      onChange(rating)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleClick(star)}
          disabled={readonly}
          className={clsx(
            'p-0.5 transition-colors',
            !readonly && 'hover:scale-110 cursor-pointer',
            readonly && 'cursor-default'
          )}
          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={clsx(
              'w-6 h-6 transition-colors',
              value && star <= value
                ? 'text-yellow-500 fill-current'
                : 'text-neutral-300'
            )}
          />
        </button>
      ))}
      {value && !readonly && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-neutral-500 hover:text-neutral-700"
        >
          Clear
        </button>
      )}
    </div>
  )
}
