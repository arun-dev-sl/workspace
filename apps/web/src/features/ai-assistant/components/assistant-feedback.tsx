import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'

import { submitMessageFeedback } from '@/features/ai-assistant/api/assistant'

interface AssistantFeedbackProps {
  messageId: string
}

export function AssistantFeedback({ messageId }: AssistantFeedbackProps) {
  const [submitted, setSubmitted] = useState<'thumbs_up' | 'thumbs_down' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFeedback = async (rating: 'thumbs_up' | 'thumbs_down') => {
    if (submitted || isSubmitting) return
    setIsSubmitting(true)
    try {
      await submitMessageFeedback(messageId, rating)
      setSubmitted(rating)
    } catch {
      // silently fail
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        {submitted === 'thumbs_up' ? (
          <ThumbsUp className="size-3 text-emerald-500" />
        ) : (
          <ThumbsDown className="size-3 text-red-400" />
        )}
        <span>Thanks for your feedback</span>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => void handleFeedback('thumbs_up')}
        disabled={isSubmitting}
        className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label="Thumbs up"
      >
        <ThumbsUp className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => void handleFeedback('thumbs_down')}
        disabled={isSubmitting}
        className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label="Thumbs down"
      >
        <ThumbsDown className="size-3" />
      </button>
    </div>
  )
}
