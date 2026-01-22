import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CalendarEntry, Meal } from '@/types'

interface CalendarEntryWithMeal extends CalendarEntry {
  meal: Meal
}

interface FetchCalendarParams {
  start: string
  end: string
}

async function fetchCalendarEntries({ start, end }: FetchCalendarParams): Promise<CalendarEntryWithMeal[]> {
  const response = await fetch(`/api/calendar?start=${start}&end=${end}`)
  if (!response.ok) {
    throw new Error('Failed to fetch calendar entries')
  }
  const data = await response.json()
  return data.entries
}

interface AddCalendarEntryParams {
  date: string
  mealId: string
  slot: 1 | 2
}

async function addCalendarEntry(params: AddCalendarEntryParams): Promise<CalendarEntry> {
  const response = await fetch('/api/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    throw new Error('Failed to add calendar entry')
  }
  const data = await response.json()
  return data.entry
}

async function deleteCalendarEntry(id: string): Promise<void> {
  const response = await fetch(`/api/calendar/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete calendar entry')
  }
}

export function useCalendar(start: string, end: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['calendar', start, end],
    queryFn: () => fetchCalendarEntries({ start, end }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const addMutation = useMutation({
    mutationFn: addCalendarEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })

  return {
    entries: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    addEntry: addMutation.mutate,
    deleteEntry: deleteMutation.mutate,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
