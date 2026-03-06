import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  startSyncJob,
  startReprocessJob,
  getSyncJobStatus,
  type StartSyncJobInput,
} from '@/features/expenses/api/sync-expenses'
import type { SyncJob } from '@workspace/domain'

interface UseSyncJobOptions {
  onComplete?: (job: SyncJob) => void
  onError?: (error: Error) => void
  pollingInterval?: number
}

interface UseSyncJobReturn {
  startSync: (input?: StartSyncJobInput) => void
  startReprocess: () => void
  job: SyncJob | null
  isStarting: boolean
  isPolling: boolean
  isSyncing: boolean
  progress: number
  error: Error | null
  reset: () => void
}

export function useSyncJob(options: UseSyncJobOptions = {}): UseSyncJobReturn {
  const { onComplete, onError, pollingInterval = 3000 } = options
  const queryClient = useQueryClient()

  const [job, setJob] = useState<SyncJob | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const onMutationSuccess = useCallback(
    (data: { jobId: string }) => {
      setJob({
        id: data.jobId,
        userId: '',
        status: 'pending',
        query: null,
        totalEmails: null,
        processedEmails: 0,
        newEmails: 0,
        transactions: 0,
        statements: 0,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setIsPolling(true)
      setError(null)
    },
    [],
  )

  const onMutationError = useCallback(
    (err: Error) => {
      const error = err instanceof Error ? err : new Error('Failed to start job')
      setError(error)
      onError?.(error)
    },
    [onError],
  )

  const startMutation = useMutation({
    mutationFn: startSyncJob,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const reprocessMutation = useMutation({
    mutationFn: startReprocessJob,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  // Polling effect
  useEffect(() => {
    if (!isPolling || !job?.id) return

    const abortController = new AbortController()

    const pollStatus = async () => {
      try {
        const updatedJob = await getSyncJobStatus(
          job.id,
          abortController.signal,
        )
        setJob(updatedJob)

        if (updatedJob.status === 'completed') {
          setIsPolling(false)
          void queryClient.invalidateQueries({ queryKey: ['expenses', 'emails'] })
          void queryClient.invalidateQueries({ queryKey: ['expenses', 'analytics'] })
          void queryClient.invalidateQueries({ queryKey: ['expenses', 'transactions'] })
          onComplete?.(updatedJob)
        } else if (updatedJob.status === 'failed') {
          setIsPolling(false)
          const err = new Error(updatedJob.errorMessage ?? 'Sync failed')
          setError(err)
          onError?.(err)
        }
      } catch (error_) {
        // Ignore errors from aborted requests
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
        const error
          = error_ instanceof Error ? error_ : new Error('Failed to poll status')
        setError(error)
        onError?.(error)
      }
    }

    const intervalId = setInterval(pollStatus, pollingInterval)

    // Initial poll
    pollStatus()

    return () => {
      clearInterval(intervalId)
      abortController.abort() // Cancel in-flight request on cleanup
    }
  }, [isPolling, job?.id, pollingInterval, queryClient, onComplete, onError])

  // Calculate progress percentage
  const progress = (() => {
    if (!job) return 0
    if (job.status === 'completed') return 100
    if (job.status === 'pending') return 0
    if (!job.totalEmails || job.totalEmails === 0) return 10 // Indeterminate but started
    return Math.min(
      Math.round((job.processedEmails / job.totalEmails) * 100),
      99,
    )
  })()

  const startSync = useCallback((input?: StartSyncJobInput) => {
    setError(null)
    setJob(null)
    startMutation.mutate(input)
  }, [startMutation])

  const startReprocess = useCallback(() => {
    setError(null)
    setJob(null)
    reprocessMutation.mutate()
  }, [reprocessMutation])

  const reset = useCallback(() => {
    setJob(null)
    setIsPolling(false)
    setError(null)
  }, [])

  return {
    startSync,
    startReprocess,
    job,
    isStarting: startMutation.isPending || reprocessMutation.isPending,
    isPolling,
    isSyncing: startMutation.isPending || reprocessMutation.isPending || isPolling,
    progress,
    error,
    reset,
  }
}
