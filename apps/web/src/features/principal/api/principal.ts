import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  PrincipalAnalytics,
  PrincipalContributionRow,
  PrincipalDistributionRow,
  UpsertContributionPayload,
  UpsertDistributionPayload,
} from '@workspace/domain'

export const principalKeys = {
  all: ['principal'] as const,
  analytics: () => [...principalKeys.all, 'analytics'] as const,
}

export function usePrincipalAnalytics() {
  return useQuery({
    queryKey: principalKeys.analytics(),
    queryFn: async () => {
      const response = await apiClient.get<PrincipalAnalytics | null>(
        '/api/principal/analytics',
      )
      return response.data
    },
  })
}

export function useImportPrincipal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: {
      contributions?: string
      distribution?: string
    }) => {
      const response = await apiClient.post<{
        contributions: { imported: number, updated: number, parsed: number }
        distribution: { imported: number, updated: number, parsed: number }
      }>('/api/principal/import', body)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}

export function useCreateContribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpsertContributionPayload) => {
      const response = await apiClient.post<PrincipalContributionRow>(
        '/api/principal/contributions',
        payload,
      )
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}

export function useUpdateContribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<UpsertContributionPayload>
    }) => {
      const response = await apiClient.patch<PrincipalContributionRow>(
        `/api/principal/contributions/${id}`,
        data,
      )
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}

export function useDeleteContribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/principal/contributions/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}

// ── Distribution CRUD ──

export function useCreateDistribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpsertDistributionPayload) => {
      const response = await apiClient.post<PrincipalDistributionRow>(
        '/api/principal/distribution',
        payload,
      )
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}

export function useUpdateDistribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<UpsertDistributionPayload>
    }) => {
      const response = await apiClient.patch<PrincipalDistributionRow>(
        `/api/principal/distribution/${id}`,
        data,
      )
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}

export function useDeleteDistribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/principal/distribution/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: principalKeys.all })
    },
  })
}
