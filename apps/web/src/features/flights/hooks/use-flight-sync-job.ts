import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  flightKeys,
  getFlightSyncJobStatus,
  startFlightLlmReviewProcessJob,
  startFlightReprocessJob,
  startFlightReviewSyncJob,
  startFlightSyncJob,
  type StartFlightLlmReviewProcessJobInput,
  type StartFlightReviewSyncJobInput,
  type StartFlightSyncJobInput,
} from '@/features/flights/api/flights'
import type { FlightSyncJobStatus } from '@workspace/domain'

interface UseFlightSyncJobOptions {
  onComplete?: (job: FlightSyncJobStatus) => void
  onError?: (error: Error) => void
  pollingInterval?: number
}

interface UseFlightSyncJobReturn {
  startSync: (input?: StartFlightSyncJobInput) => void
  startReviewSync: (input: StartFlightReviewSyncJobInput) => void
  startLlmReviewProcess: (input: StartFlightLlmReviewProcessJobInput) => void
  startReprocess: (forceProcessAll?: boolean) => void
  job: FlightSyncJobStatus | null
  isStarting: boolean
  isPolling: boolean
  isSyncing: boolean
  progress: number
  error: Error | null
  reset: () => void
}

export function useFlightSyncJob(
  options: UseFlightSyncJobOptions = {},
): UseFlightSyncJobReturn {
  const { onComplete, onError, pollingInterval = 3000 } = options
  const queryClient = useQueryClient()

  const [job, setJob] = useState<FlightSyncJobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const onMutationSuccess = useCallback((data: { jobId: string }) => {
    setJob({
      id: data.jobId,
      userId: '',
      status: 'pending',
      query: null,
      totalEmails: null,
      processedEmails: 0,
      newEmails: 0,
      activities: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setError(null)
    setIsPolling(true)
  }, [])

  const onMutationError = useCallback(
    (err: Error) => {
      const resolvedError
        = err instanceof Error ? err : new Error('Failed to start flight sync')
      setError(resolvedError)
      onError?.(resolvedError)
    },
    [onError],
  )

  const startMutation = useMutation({
    mutationFn: startFlightSyncJob,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const reprocessMutation = useMutation({
    mutationFn: startFlightReprocessJob,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const reviewSyncMutation = useMutation({
    mutationFn: startFlightReviewSyncJob,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const llmReviewProcessMutation = useMutation({
    mutationFn: startFlightLlmReviewProcessJob,
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
        const updatedJob = await getFlightSyncJobStatus(
          job.id,
          abortController.signal,
        )
        setJob(updatedJob)

        if (updatedJob.status === 'completed') {
          setIsPolling(false)
          void queryClient.invalidateQueries({ queryKey: flightKeys.all })
          onComplete?.(updatedJob)
        } else if (updatedJob.status === 'failed') {
          setIsPolling(false)
          const syncError = new Error(
            updatedJob.errorMessage ?? 'Flight sync failed',
          )
          setError(syncError)
          onError?.(syncError)
        }
      } catch (error_) {
        if (error_ instanceof Error && error_.name === 'AbortError') {
          return
        }
        if (
          error_ instanceof Error
          && error_.message.toLowerCase().includes('cancel')
        ) {
          return
        }

        setIsPolling(false)
        const syncError
          = error_ instanceof Error
            ? error_
            : new Error('Failed to poll flight sync status')
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

    return Math.min(
      Math.round((job.processedEmails / job.totalEmails) * 100),
      99,
    )
  })()

  const startSync = useCallback(
    (input?: StartFlightSyncJobInput) => {
      setError(null)
      setJob(null)
      startMutation.mutate(input)
    },
    [startMutation],
  )

  const startReprocess = useCallback(
    (forceProcessAll = false) => {
      setError(null)
      setJob(null)
      reprocessMutation.mutate(forceProcessAll)
    },
    [reprocessMutation],
  )

  const startReviewSync = useCallback(
    (input: StartFlightReviewSyncJobInput) => {
      setError(null)
      setJob(null)
      reviewSyncMutation.mutate(input)
    },
    [reviewSyncMutation],
  )

  const startLlmReviewProcess = useCallback(
    (input: StartFlightLlmReviewProcessJobInput) => {
      setError(null)
      setJob(null)
      llmReviewProcessMutation.mutate(input)
    },
    [llmReviewProcessMutation],
  )

  const reset = useCallback(() => {
    setJob(null)
    setIsPolling(false)
    setError(null)
  }, [])

  return {
    startSync,
    startReviewSync,
    startLlmReviewProcess,
    startReprocess,
    job,
    isStarting:
      startMutation.isPending
      || reprocessMutation.isPending
      || reviewSyncMutation.isPending
      || llmReviewProcessMutation.isPending,
    isPolling,
    isSyncing:
      startMutation.isPending
      || reprocessMutation.isPending
      || reviewSyncMutation.isPending
      || llmReviewProcessMutation.isPending
      || isPolling,
    progress,
    error,
    reset,
  }
}
