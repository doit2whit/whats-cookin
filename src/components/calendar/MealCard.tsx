import { clsx } from 'clsx'
import { Star, Heart, Zap, UtensilsCrossed, Users } from 'lucide-react'
import type { CalendarEntry, Meal } from '@/types'

interface MealCardProps {
  entry: CalendarEntry & { meal: Meal }
  compact?: boolean
  onClick?: (e: React.MouseEvent) => void
}

export default function MealCard({ entry, compact = false, onClick }: MealCardProps) {
  const { meal } = entry

  const getTypeIcon = () => {
    if (meal.mealType === 'restaurant') {
      return <UtensilsCrossed className="w-3 h-3" />
    }
    if (meal.mealType === 'friends_house') {
      return <Users className="w-3 h-3" />
    }
    return null
  }

  const getTypeBgClass = () => {
    if (meal.mealType === 'restaurant') {
      return 'bg-restaurant/10 border-restaurant/30 hover:bg-restaurant/20'
    }
    if (meal.mealType === 'friends_house') {
      return 'bg-friends/10 border-friends/30 hover:bg-friends/20'
    }
    return 'bg-primary-50 border-primary-200 hover:bg-primary-100'
  }

  const getTypeTextClass = () => {
    if (meal.mealType === 'restaurant') {
      return 'text-restaurant'
    }
    if (meal.mealType === 'friends_house') {
      return 'text-friends'
    }
    return 'text-primary-700'
  }

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'px-2 py-1 rounded-md border text-xs sm:text-sm truncate cursor-pointer transition-colors',
          getTypeBgClass(),
          getTypeTextClass()
        )}
      >
        <div className="flex items-center gap-1">
          {getTypeIcon()}
          <span className="truncate font-medium">{meal.name}</span>
          {meal.isFavorite && <Heart className="w-3 h-3 text-favorite flex-shrink-0 fill-current" />}
          {meal.isQuick && <Zap className="w-3 h-3 text-quick flex-shrink-0" />}
        </div>
      </div>
    )
  }

  // Full card view (used in week view)
  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-3 rounded-lg border cursor-pointer transition-colors',
        getTypeBgClass()
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {getTypeIcon() && (
            <span className={clsx('flex-shrink-0', getTypeTextClass())}>
              {getTypeIcon()}
            </span>
          )}
          <span className={clsx('font-medium truncate', getTypeTextClass())}>
            {meal.name}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {meal.isFavorite && (
            <Heart className="w-3.5 h-3.5 text-favorite fill-current" />
          )}
          {meal.isQuick && (
            <Zap className="w-3.5 h-3.5 text-quick" />
          )}
        </div>
      </div>

      {/* Subtitle for restaurant/friends */}
      {meal.mealType === 'restaurant' && meal.restaurantName && (
        <p className="text-xs text-neutral-500 mt-1 truncate">
          @ {meal.restaurantName}
        </p>
      )}
      {meal.mealType === 'friends_house' && meal.friendName && (
        <p className="text-xs text-neutral-500 mt-1 truncate">
          @ {meal.friendName}'s
        </p>
      )}

      {/* Ratings */}
      {(meal.ianRating || meal.hannaRating) && (
        <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
          {meal.ianRating && (
            <span className="flex items-center gap-0.5">
              I: {meal.ianRating}<Star className="w-3 h-3 text-yellow-500 fill-current" />
            </span>
          )}
          {meal.hannaRating && (
            <span className="flex items-center gap-0.5">
              H: {meal.hannaRating}<Star className="w-3 h-3 text-yellow-500 fill-current" />
            </span>
          )}
        </div>
      )}

      {/* Cuisine tags */}
      {meal.cuisineType && meal.cuisineType.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {meal.cuisineType.slice(0, 2).map(tag => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-white/50 rounded text-xs text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
