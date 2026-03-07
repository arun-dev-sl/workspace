import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { apiRequest } from '@/lib/api-client'
import {
  FlightActivitySchema,
  FlightSyncJobStatusSchema,
  RawEmailSchema,
  StartFlightSyncJobResponseSchema,
  UpdateFlightActivityInputSchema,
  type UpdateFlightActivityInput,
} from '@workspace/domain'

const listFlightActivitiesSchema = z.object({
  object: z.literal('list'),
  data: z.array(FlightActivitySchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  has_more: z.boolean(),
})

export type ListFlightActivitiesResponse = z.infer<
  typeof listFlightActivitiesSchema
>

export interface ListFlightActivitiesParams {
  page?: number
  page_size?: number
}

export interface StartFlightSyncJobInput {
  fromDate?: string
}

export const flightKeys = {
  all: ['flights'] as const,
  activities: (params?: ListFlightActivitiesParams) =>
    [...flightKeys.all, 'activities', params] as const,
  activity: (id: string) => [...flightKeys.all, 'activity', id] as const,
  email: (id: string) => [...flightKeys.all, 'email', id] as const,
  gmailStatus: () => [...flightKeys.all, 'gmail-status'] as const,
}

export async function listFlightActivities(
  params?: ListFlightActivitiesParams,
): Promise<ListFlightActivitiesResponse> {
  const searchParams = new URLSearchParams()

  if (params?.page) {
    searchParams.set('page', params.page.toString())
  }

  if (params?.page_size) {
    searchParams.set('page_size', params.page_size.toString())
  }

  const json = await apiRequest({
    method: 'GET',
    url: `/api/flights/activities${searchParams.toString() ? `?${searchParams}` : ''}`,
    headers: {
      Accept: 'application/json',
    },
  })

  return listFlightActivitiesSchema.parse(json)
}

export async function getFlightEmail(id: string) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/flights/emails/${id}`,
    headers: {
      Accept: 'application/json',
    },
  })

  return RawEmailSchema.parse(json)
}

export async function updateFlightActivity(params: {
  id: string
  data: UpdateFlightActivityInput
}) {
  const json = await apiRequest({
    method: 'PATCH',
    url: `/api/flights/activities/${params.id}`,
    data: UpdateFlightActivityInputSchema.parse(params.data),
    successMessage: 'Flight activity updated',
    toastSuccess: true,
  })

  return FlightActivitySchema.parse(json)
}

export async function startFlightSyncJob(
  input?: StartFlightSyncJobInput,
) {
  const json = await apiRequest({
    method: 'POST',
    url: '/api/flights/sync',
    data: input,
    successMessage: 'Flight sync started',
    toastSuccess: true,
  })

  return StartFlightSyncJobResponseSchema.parse(json)
}

export async function startFlightReprocessJob(forceProcessAll = false) {
  const json = await apiRequest({
    method: 'POST',
    url: `/api/flights/reprocess${forceProcessAll ? '?forceProcessAll=true' : ''}`,
    successMessage: forceProcessAll
      ? 'Flight reprocess started for all emails'
      : 'Flight reprocess started',
    toastSuccess: true,
  })

  return StartFlightSyncJobResponseSchema.parse(json)
}

export async function getFlightSyncJobStatus(
  jobId: string,
  signal?: AbortSignal,
) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/flights/sync/${jobId}`,
    signal,
    toastError: false,
  })

  return FlightSyncJobStatusSchema.parse(json)
}

export function useFlightActivities(params: ListFlightActivitiesParams) {
  return useQuery({
    queryKey: flightKeys.activities(params),
    queryFn: () => listFlightActivities(params),
  })
}

export function useFlightEmail(id?: string, enabled = true) {
  return useQuery({
    queryKey: flightKeys.email(id ?? 'unknown'),
    queryFn: () => getFlightEmail(id!),
    enabled: enabled && Boolean(id),
  })
}

export function useUpdateFlightActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateFlightActivity,
    onSuccess: (activity) => {
      void queryClient.invalidateQueries({ queryKey: flightKeys.all })
      queryClient.setQueryData(flightKeys.activity(activity.id), activity)
    },
  })
}
