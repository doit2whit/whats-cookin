import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Heart, Zap, Utensils } from 'lucide-react'
import Button from '@/components/ui/Button'
import RatingStars from './RatingStars'
import IngredientInput from '@/components/ingredients/IngredientInput'
import CuisineTagInput from './CuisineTagInput'
import type { Meal, MealFormData, MealType, Chef, IngredientEntry } from '@/types'

interface MealFormProps {
  initialData?: Meal
  onSubmit: (data: MealFormData) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}

const CHEF_OPTIONS: Chef[] = ['Ian', 'Hanna', 'Other']

export default function MealForm({ initialData, onSubmit, onCancel, isSubmitting }: MealFormProps) {
  const [mealType, setMealType] = useState<MealType>(initialData?.mealType || 'homemade')
  const [cuisineTags, setCuisineTags] = useState<string[]>(initialData?.cuisineType || [])
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([])
  const [ianRating, setIanRating] = useState<number | null>(initialData?.ianRating ?? null)
  const [hannaRating, setHannaRating] = useState<number | null>(initialData?.hannaRating ?? null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<MealFormData>({
    defaultValues: {
      name: initialData?.name || '',
      chef: initialData?.chef || 'Ian',
      isLeftovers: initialData?.isLeftovers || false,
      isFavorite: initialData?.isFavorite || false,
      isQuick: initialData?.isQuick || false,
      notes: initialData?.notes || '',
      restaurantName: initialData?.restaurantName || '',
      friendName: initialData?.friendName || '',
    },
  })

  const handleFormSubmit = async (data: MealFormData) => {
    await onSubmit({
      ...data,
      mealType,
      cuisineType: cuisineTags,
      ianRating,
      hannaRating,
      ingredients,
    })
  }

  const isFavorite = watch('isFavorite')
  const isQuick = watch('isQuick')

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Meal Type Selection */}
      <div>
        <label className="label">Where did you eat?</label>
        <div className="flex gap-2">
          {[
            { type: 'homemade' as MealType, label: 'Home', icon: '🏠' },
            { type: 'restaurant' as MealType, label: 'Restaurant', icon: '🍽️' },
            { type: 'friends_house' as MealType, label: "Friend's", icon: '👥' },
          ].map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setMealType(type)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                mealType === type
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
              }`}
            >
              <span>{icon}</span>
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Meal Name */}
      <div>
        <label htmlFor="name" className="label">
          {mealType === 'homemade' ? 'Meal Name' : 'What did you eat?'}
        </label>
        <input
          id="name"
          type="text"
          {...register('name', { required: 'Meal name is required' })}
          className="input"
          placeholder={mealType === 'homemade' ? 'e.g., Spaghetti and Meatballs' : 'e.g., Pizza'}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Restaurant or Friend Name */}
      {mealType === 'restaurant' && (
        <div>
          <label htmlFor="restaurantName" className="label">Restaurant Name</label>
          <input
            id="restaurantName"
            type="text"
            {...register('restaurantName')}
            className="input"
            placeholder="e.g., Joe's Pizza"
          />
        </div>
      )}

      {mealType === 'friends_house' && (
        <div>
          <label htmlFor="friendName" className="label">Friend's Name</label>
          <input
            id="friendName"
            type="text"
            {...register('friendName')}
            className="input"
            placeholder="e.g., Sarah"
          />
        </div>
      )}

      {/* Chef (only for homemade) */}
      {mealType === 'homemade' && (
        <div>
          <label htmlFor="chef" className="label">Who made it?</label>
          <select id="chef" {...register('chef')} className="input">
            {CHEF_OPTIONS.map(chef => (
              <option key={chef} value={chef}>{chef}</option>
            ))}
          </select>
        </div>
      )}

      {/* Cuisine Tags */}
      <div>
        <label className="label">Cuisine Type</label>
        <CuisineTagInput
          value={cuisineTags}
          onChange={setCuisineTags}
        />
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-3">
        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
          isFavorite ? 'border-favorite bg-favorite/10' : 'border-neutral-200 hover:border-neutral-300'
        }`}>
          <input
            type="checkbox"
            {...register('isFavorite')}
            className="sr-only"
          />
          <Heart className={`w-4 h-4 ${isFavorite ? 'text-favorite fill-current' : 'text-neutral-400'}`} />
          <span className={isFavorite ? 'text-favorite font-medium' : 'text-neutral-600'}>
            Favorite
          </span>
        </label>

        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
          isQuick ? 'border-quick bg-quick/10' : 'border-neutral-200 hover:border-neutral-300'
        }`}>
          <input
            type="checkbox"
            {...register('isQuick')}
            className="sr-only"
          />
          <Zap className={`w-4 h-4 ${isQuick ? 'text-quick' : 'text-neutral-400'}`} />
          <span className={isQuick ? 'text-quick font-medium' : 'text-neutral-600'}>
            Quick Meal
          </span>
        </label>

        {mealType === 'homemade' && (
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer border-neutral-200 hover:border-neutral-300">
            <input
              type="checkbox"
              {...register('isLeftovers')}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
            />
            <Utensils className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600">Makes Leftovers</span>
          </label>
        )}
      </div>

      {/* Ratings (not for friends_house) */}
      {mealType !== 'friends_house' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Ian's Rating</label>
            <RatingStars value={ianRating} onChange={setIanRating} />
          </div>
          <div>
            <label className="label">Hanna's Rating</label>
            <RatingStars value={hannaRating} onChange={setHannaRating} />
          </div>
        </div>
      )}

      {/* Ingredients (only for homemade) */}
      {mealType === 'homemade' && (
        <div>
          <label className="label">Ingredients (optional)</label>
          <IngredientInput
            value={ingredients}
            onChange={setIngredients}
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="label">Notes (optional)</label>
        <textarea
          id="notes"
          {...register('notes')}
          rows={3}
          className="input resize-none"
          placeholder="Any notes about this meal..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialData ? 'Save Changes' : 'Add Meal'}
        </Button>
      </div>
    </form>
  )
}
