import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { DividendDashboard } from '@workspace/domain'

interface DividendRow {
  id: string
  userId: string
  companyName: string
  isin: string
  exDate: string
  shares: number
  dividendPerShare: string
  amount: string
  investedValue: string | null
  reportPeriodFrom: string | null
  reportPeriodTo: string | null
  createdAt: string
  updatedAt: string
}

export const dividendsKeys = {
  all: ['dividends'] as const,
  list: () => [...dividendsKeys.all, 'list'] as const,
  dashboard: (year?: number) =>
    [...dividendsKeys.all, 'dashboard', year ?? 'current'] as const,
}

export function useDividends() {
  return useQuery({
    queryKey: dividendsKeys.list(),
    queryFn: async () => {
      const response = await apiClient.get<DividendRow[]>('/api/dividends')
      return response.data
    },
  })
}

export function useDividendDashboard(year?: number) {
  return useQuery({
    queryKey: dividendsKeys.dashboard(year),
    queryFn: async () => {
      const params = year ? `?year=${year}` : ''
      const response = await apiClient.get<DividendDashboard>(
        `/api/dividends/dashboard${params}`,
      )
      return response.data
    },
  })
}

export function useImportDividends() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jsonString: string) => {
      const response = await apiClient.post<{
        imported: number
        updated: number
        errors: string[]
      }>('/api/dividends/import', {
        json: jsonString,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dividendsKeys.all })
    },
  })
}

export function useEnrichDividendYield() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      investedValue,
    }: {
      id: string
      investedValue: number
    }) => {
      const response = await apiClient.patch<DividendRow>(
        `/api/dividends/${id}/yield`,
        { investedValue },
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dividendsKeys.all })
    },
  })
}

export function useDeleteDividend() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/dividends/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dividendsKeys.all })
    },
  })
}
