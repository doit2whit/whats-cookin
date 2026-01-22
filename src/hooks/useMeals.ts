import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Meal, MealFormData } from '@/types'

async function fetchMeals(): Promise<Meal[]> {
  const response = await fetch('/api/meals')
  if (!response.ok) {
    throw new Error('Failed to fetch meals')
  }
  const data = await response.json()
  return data.meals
}

async function fetchMeal(id: string): Promise<Meal & { ingredients: any[] }> {
  const response = await fetch(`/api/meals/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch meal')
  }
  const data = await response.json()
  return data.meal
}

async function createMeal(data: MealFormData): Promise<Meal> {
  const response = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create meal')
  }
  const result = await response.json()
  return result.meal
}

async function updateMeal({ id, data }: { id: string; data: MealFormData }): Promise<Meal> {
  const response = await fetch(`/api/meals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to update meal')
  }
  const result = await response.json()
  return result.meal
}

async function deleteMeal(id: string): Promise<void> {
  const response = await fetch(`/api/meals/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete meal')
  }
}

interface AutocompleteParams {
  query: string
  includeHidden?: boolean
}

async function searchMeals({ query, includeHidden = false }: AutocompleteParams): Promise<Meal[]> {
  const response = await fetch(`/api/meals/autocomplete?q=${encodeURIComponent(query)}&includeHidden=${includeHidden}`)
  if (!response.ok) {
    throw new Error('Failed to search meals')
  }
  const data = await response.json()
  return data.meals
}

export function useMeals() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['meals'],
    queryFn: fetchMeals,
  })

  const createMutation = useMutation({
    mutationFn: createMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
    },
  })

  return {
    meals: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createMeal: createMutation.mutateAsync,
    updateMeal: updateMutation.mutateAsync,
    deleteMeal: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}

export function useMeal(id: string | null) {
  return useQuery({
    queryKey: ['meals', id],
    queryFn: () => fetchMeal(id!),
    enabled: !!id,
  })
}

export function useMealSearch(query: string, includeHidden = false) {
  return useQuery({
    queryKey: ['meals', 'search', query, includeHidden],
    queryFn: () => searchMeals({ query, includeHidden }),
    enabled: query.length >= 1,
    staleTime: 30 * 1000, // 30 seconds
  })
}
