import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Meal, MealFormData } from '@/types'

async function fetchMeals(): Promise<Meal[]> {
  const res = await fetch('/api/meals')
  if (!res.ok) throw new Error('Failed to fetch meals')
  const data = await res.json()
  return data.meals || []
}

async function createMeal(data: MealFormData): Promise<Meal> {
  const res = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create meal')
  const result = await res.json()
  return result.meal
}

async function updateMeal({ id, data }: { id: string; data: MealFormData }): Promise<Meal> {
  const res = await fetch(`/api/meals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update meal')
  const result = await res.json()
  return result.meal
}

async function deleteMeal(id: string): Promise<void> {
  const res = await fetch(`/api/meals/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete meal')
}

export function useMeals() {
  const queryClient = useQueryClient()

  const { data: meals = [], isLoading, error } = useQuery({
    queryKey: ['meals'],
    queryFn: fetchMeals,
  })

  const createMutation = useMutation({
    mutationFn: createMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })

  return {
    meals,
    isLoading,
    error,
    createMeal: createMutation.mutateAsync,
    updateMeal: updateMutation.mutateAsync,
    deleteMeal: deleteMutation.mutateAsync,
  }
}
