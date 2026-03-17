import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { apiRequest } from '@/lib/api-client'
import {
  CreateHotelStayInputSchema,
  HotelLlmReviewCandidatesResponseSchema,
  HotelSyncJobStatusSchema,
  HotelStaySchema,
  ProcessHotelLlmReviewRequestSchema,
  RawEmailSchema,
  UpdateHotelStayInputSchema,
  type CreateHotelStayInput,
  type UpdateHotelStayInput,
} from '@workspace/domain'

const listHotelStaysSchema = z.object({
  object: z.literal('list'),
  data: z.array(HotelStaySchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  has_more: z.boolean(),
})

const hotelJobResponseSchema = z.object({
  jobId: z.string(),
  message: z.string(),
})

const MAX_HOTEL_STAYS_PAGE_SIZE = 100

export type ListHotelStaysResponse = z.infer<typeof listHotelStaysSchema>

export interface ListHotelStaysParams {
  page?: number
  page_size?: number
  includeArchived?: boolean
}

export const hotelKeys = {
  all: ['hotels'] as const,
  stays: (params?: ListHotelStaysParams) => [...hotelKeys.all, 'stays', params] as const,
  allStays: (includeArchived = false) =>
    [...hotelKeys.all, 'all-stays', { includeArchived }] as const,
  email: (id: string) => [...hotelKeys.all, 'email', id] as const,
  reviewCandidates: (startDate: string, endDate: string, limit = 50) =>
    [...hotelKeys.all, 'review-candidates', startDate, endDate, limit] as const,
}

export async function listHotelStays(
  params?: ListHotelStaysParams,
): Promise<ListHotelStaysResponse> {
  const searchParams = new URLSearchParams()
  const normalizedPageSize = params?.page_size
    ? Math.min(params.page_size, MAX_HOTEL_STAYS_PAGE_SIZE)
    : undefined

  if (params?.page) {
    searchParams.set('page', params.page.toString())
  }

  if (normalizedPageSize) {
    searchParams.set('page_size', normalizedPageSize.toString())
  }

  if (params?.includeArchived) {
    searchParams.set('includeArchived', 'true')
  }

  const json = await apiRequest({
    method: 'GET',
    url: `/api/hotels/stays${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    headers: { Accept: 'application/json' },
  })

  return listHotelStaysSchema.parse(json)
}

export async function listAllHotelStays(params?: {
  includeArchived?: boolean
}): Promise<ListHotelStaysResponse> {
  const data = [] as ListHotelStaysResponse['data']
  let page = 1
  let total = 0
  let hasMore = false

  do {
    const response = await listHotelStays({
      page,
      page_size: MAX_HOTEL_STAYS_PAGE_SIZE,
      includeArchived: params?.includeArchived,
    })

    data.push(...response.data)
    total = response.total
    hasMore = response.has_more
    page += 1
  } while (hasMore)

  return {
    object: 'list',
    data,
    page: 1,
    page_size: MAX_HOTEL_STAYS_PAGE_SIZE,
    total,
    has_more: false,
  }
}

export async function createHotelStay(input: CreateHotelStayInput) {
  const json = await apiRequest({
    method: 'POST',
    url: '/api/hotels/stays',
    data: CreateHotelStayInputSchema.parse(input),
    successMessage: 'Hotel stay created',
    toastSuccess: true,
  })

  return HotelStaySchema.parse(json)
}

export async function updateHotelStay(params: {
  id: string
  data: UpdateHotelStayInput
}) {
  const json = await apiRequest({
    method: 'PATCH',
    url: `/api/hotels/stays/${params.id}`,
    data: UpdateHotelStayInputSchema.parse(params.data),
    successMessage: 'Hotel stay updated',
    toastSuccess: true,
  })

  return HotelStaySchema.parse(json)
}

export async function archiveHotelStay(id: string) {
  const json = await apiRequest({
    method: 'PATCH',
    url: `/api/hotels/stays/${id}/archive`,
    successMessage: 'Hotel stay archived',
    toastSuccess: true,
  })

  return HotelStaySchema.parse(json)
}

export async function unarchiveHotelStay(id: string) {
  const json = await apiRequest({
    method: 'PATCH',
    url: `/api/hotels/stays/${id}/unarchive`,
    successMessage: 'Hotel stay restored',
    toastSuccess: true,
  })

  return HotelStaySchema.parse(json)
}

export async function deleteHotelStay(id: string) {
  return apiRequest({
    method: 'DELETE',
    url: `/api/hotels/stays/${id}`,
    successMessage: 'Hotel stay deleted',
    toastSuccess: true,
  })
}

export async function getHotelEmail(id: string) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/hotels/emails/${id}`,
    headers: { Accept: 'application/json' },
  })

  return RawEmailSchema.parse(json)
}

export async function listHotelLlmReviewCandidates(params: {
  startDate: string
  endDate: string
  limit?: number
}) {
  const searchParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  })

  if (params.limit) {
    searchParams.set('limit', params.limit.toString())
  }

  const json = await apiRequest({
    method: 'GET',
    url: `/api/hotels/review/candidates?${searchParams.toString()}`,
    headers: { Accept: 'application/json' },
  })

  return HotelLlmReviewCandidatesResponseSchema.parse(json)
}

export async function startHotelLlmReviewProcess(input: { emailIds: string[] }) {
  const json = await apiRequest({
    method: 'POST',
    url: '/api/hotels/review/process',
    data: ProcessHotelLlmReviewRequestSchema.parse(input),
    successMessage: 'Selected hotel emails queued for LLM extraction',
    toastSuccess: true,
  })

  return hotelJobResponseSchema.parse(json)
}

export async function getHotelSyncJobStatus(id: string, signal?: AbortSignal) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/hotels/sync/${id}`,
    headers: { Accept: 'application/json' },
    signal,
  })

  return HotelSyncJobStatusSchema.parse(json)
}

export function useHotelStays(params: ListHotelStaysParams) {
  return useQuery({
    queryKey: hotelKeys.stays(params),
    queryFn: () => listHotelStays(params),
  })
}

export function useAllHotelStays(params?: { includeArchived?: boolean }) {
  return useQuery({
    queryKey: hotelKeys.allStays(params?.includeArchived ?? false),
    queryFn: () => listAllHotelStays(params),
  })
}

export function useHotelEmail(id?: string, enabled = true) {
  return useQuery({
    queryKey: hotelKeys.email(id ?? 'unknown'),
    queryFn: () => getHotelEmail(id!),
    enabled: enabled && Boolean(id),
  })
}

export function useHotelLlmReviewCandidates(params: {
  startDate?: string
  endDate?: string
  limit?: number
  enabled?: boolean
}) {
  const enabled = Boolean(params.startDate && params.endDate) && (params.enabled ?? true)

  return useQuery({
    queryKey: hotelKeys.reviewCandidates(
      params.startDate ?? 'unknown',
      params.endDate ?? 'unknown',
      params.limit ?? 50,
    ),
    queryFn: () =>
      listHotelLlmReviewCandidates({
        startDate: params.startDate!,
        endDate: params.endDate!,
        limit: params.limit,
      }),
    enabled,
  })
}

export function useCreateHotelStay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createHotelStay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
    },
  })
}

export function useUpdateHotelStay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateHotelStay,
    onSuccess: (stay) => {
      void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
      queryClient.setQueryData([...hotelKeys.all, 'stay', stay.id], stay)
    },
  })
}

export function useArchiveHotelStay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveHotelStay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
    },
  })
}

export function useUnarchiveHotelStay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unarchiveHotelStay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
    },
  })
}

export function useDeleteHotelStay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteHotelStay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
    },
  })
}

export function useStartHotelLlmReviewProcess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startHotelLlmReviewProcess,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
    },
  })
}
