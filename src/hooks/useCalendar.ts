import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CalendarEntry, Meal } from '@/types'

interface CalendarResponse {
  entries: (CalendarEntry & { meal: Meal })[]
}

async function fetchCalendarEntries(startDate: string, endDate: string): Promise<(CalendarEntry & { meal: Meal })[]> {
  const res = await fetch(`/api/calendar?start=${startDate}&end=${endDate}`)
  if (!res.ok) throw new Error('Failed to fetch calendar entries')
  const data: CalendarResponse = await res.json()
  return data.entries || []
}

interface CreateEntryParams {
  date: string
  mealId: string
  slot?: 1 | 2
  isLeftoverEntry?: boolean
  leftoverNotes?: string
}

async function createCalendarEntry(params: CreateEntryParams): Promise<CalendarEntry> {
  const res = await fetch('/api/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to create calendar entry')
  const data = await res.json()
  return data.entry
}

async function deleteCalendarEntry(id: string): Promise<void> {
  const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete calendar entry')
}

export function useCalendar(startDate: string, endDate: string) {
  const queryClient = useQueryClient()

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['calendar', startDate, endDate],
    queryFn: () => fetchCalendarEntries(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })

  const createMutation = useMutation({
    mutationFn: createCalendarEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['meals'] }) // Refresh meal counts
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['meals'] }) // Refresh meal counts
    },
  })

  return {
    entries,
    isLoading,
    error,
    createEntry: createMutation.mutateAsync,
    deleteEntry: deleteMutation.mutateAsync,
  }
}
