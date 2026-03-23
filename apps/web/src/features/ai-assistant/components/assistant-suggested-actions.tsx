import { Sparkles } from 'lucide-react'

interface AssistantSuggestedActionsProps {
  actions: string[]
  onAction: (action: string) => void
  disabled?: boolean
}

export function AssistantSuggestedActions({ actions, onAction, disabled }: AssistantSuggestedActionsProps) {
  if (actions.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => onAction(action)}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="size-2.5 shrink-0" />
          {action}
        </button>
      ))}
    </div>
  )
}
