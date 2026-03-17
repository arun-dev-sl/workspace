import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  getHotelSyncJobStatus,
  hotelKeys,
  startHotelLlmReviewProcess,
} from '@/features/hotels/api/hotels'
import type { HotelSyncJobStatus } from '@workspace/domain'

interface UseHotelSyncJobOptions {
  onQueued?: (job: HotelSyncJobStatus) => void
  onComplete?: (job: HotelSyncJobStatus) => void
  onError?: (error: Error) => void
  pollingInterval?: number
}

interface UseHotelSyncJobReturn {
  startLlmReviewProcess: (input: { emailIds: string[] }) => void
  job: HotelSyncJobStatus | null
  isStarting: boolean
  isPolling: boolean
  isSyncing: boolean
  progress: number
  error: Error | null
  reset: () => void
}

export function useHotelSyncJob(
  options: UseHotelSyncJobOptions = {},
): UseHotelSyncJobReturn {
  const {
    onQueued,
    onComplete,
    onError,
    pollingInterval = 3000,
  } = options
  const queryClient = useQueryClient()

  const [job, setJob] = useState<HotelSyncJobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const onMutationSuccess = useCallback((data: { jobId: string }) => {
    const queuedJob: HotelSyncJobStatus = {
      id: data.jobId,
      userId: '',
      status: 'pending',
      query: null,
      totalEmails: null,
      processedEmails: 0,
      matchedStays: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setJob(queuedJob)
    setError(null)
    setIsPolling(true)
    onQueued?.(queuedJob)
  }, [onQueued])

  const onMutationError = useCallback((error_: Error) => {
    const resolvedError = error_ instanceof Error
      ? error_
      : new Error('Failed to queue hotel extraction job')
    setError(resolvedError)
    onError?.(resolvedError)
  }, [onError])

  const startMutation = useMutation({
    mutationFn: startHotelLlmReviewProcess,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  useEffect(() => {
    if (!isPolling || !job?.id) {
      return
    }

    const abortController = new AbortController()

    const pollStatus = async () => {
      try {
        const updatedJob = await getHotelSyncJobStatus(job.id, abortController.signal)
        setJob(updatedJob)

        if (updatedJob.status === 'completed') {
          setIsPolling(false)
          void queryClient.invalidateQueries({ queryKey: hotelKeys.all })
          onComplete?.(updatedJob)
        } else if (updatedJob.status === 'failed') {
          setIsPolling(false)
          const syncError = new Error(updatedJob.errorMessage ?? 'Hotel extraction failed')
          setError(syncError)
          onError?.(syncError)
        }
      } catch (error_) {
        if (error_ instanceof Error && error_.name === 'AbortError') {
          return
        }

        if (error_ instanceof Error && error_.message.toLowerCase().includes('cancel')) {
          return
        }

        setIsPolling(false)
        const syncError = error_ instanceof Error
          ? error_
          : new Error('Failed to poll hotel extraction status')
        setError(syncError)
        onError?.(syncError)
      }
    }

    const intervalId = globalThis.setInterval(() => {
      void pollStatus()
    }, pollingInterval)
    void pollStatus()

    return () => {
      globalThis.clearInterval(intervalId)
      abortController.abort()
    }
  }, [isPolling, job?.id, onComplete, onError, pollingInterval, queryClient])

  const progress = (() => {
    if (!job) {
      return 0
    }
    if (job.status === 'completed') {
      return 100
    }
    if (job.status === 'pending') {
      return 0
    }
    if (!job.totalEmails || job.totalEmails === 0) {
      return 10
    }

    return Math.min(Math.round((job.processedEmails / job.totalEmails) * 100), 99)
  })()

  const startLlmReviewProcessAction = useCallback((input: { emailIds: string[] }) => {
    setError(null)
    setJob(null)
    startMutation.mutate(input)
  }, [startMutation])

  const reset = useCallback(() => {
    setJob(null)
    setError(null)
    setIsPolling(false)
  }, [])

  return {
    startLlmReviewProcess: startLlmReviewProcessAction,
    job,
    isStarting: startMutation.isPending,
    isPolling,
    isSyncing: startMutation.isPending || isPolling,
    progress,
    error,
    reset,
  }
}
