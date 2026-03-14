import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  CornerDownLeft,
  LoaderCircle,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  getAiAssistantStatus,
  type AiAssistantStatus,
} from '@/features/ai-assistant/api/assistant'
import { useAiAssistant } from '@/features/ai-assistant/ai-assistant-context'
import { AssistantAnalysisTrace } from '@/features/ai-assistant/components/assistant-analysis-trace'
import { AssistantMessage } from '@/features/ai-assistant/components/assistant-message'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import { ScrollArea } from '@workspace/ui/components/ui/scroll-area'
import { Textarea } from '@workspace/ui/components/ui/textarea'

const QUICK_PROMPTS = [
  'How much have I invested in gold?',
  'What are my top three holdings by current value?',
  'Infer the strongest travel operating pattern from flights and hotels together.',
  'Which platform has the highest allocation and what does that imply?',
  'What should I investigate next across my finances and travel data?',
]

export function DashboardChat() {
  const { messages, isSending, error, sendMessage, clearConversation } =
    useAiAssistant()
  const [draft, setDraft] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const statusQuery = useQuery({
    queryKey: ['ai-assistant', 'status'],
    queryFn: getAiAssistantStatus,
    staleTime: 30_000,
    retry: false,
  })

  useEffect(() => {
    if (!statusQuery.data?.available) {
      setSelectedModel('')
      return
    }

    const availableModels = statusQuery.data.models
    if (availableModels.length === 0) {
      setSelectedModel('')
      return
    }

    setSelectedModel((current) => {
      if (current && availableModels.includes(current)) return current
      if (
        statusQuery.data.defaultModel &&
        availableModels.includes(statusQuery.data.defaultModel)
      ) {
        return statusQuery.data.defaultModel
      }
      return availableModels[0] ?? ''
    })
  }, [statusQuery.data])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const available = statusQuery.data?.available ?? false

  const handleSubmit = async () => {
    const trimmed = draft.trim()
    if (!trimmed || isSending || !available) return
    setDraft('')
    await sendMessage(trimmed, selectedModel || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const hasMessages = messages.length > 0

  if (!hasMessages) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Greeting */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-48 pt-8 sm:px-6 lg:px-8">
          <div className="max-w-xl space-y-2 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="size-5 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              What would you like to explore?
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ask about holdings, expenses, flights, hotels, or any pattern
              across your personal data.
            </p>

            <div className="space-y-2 pt-6">
              <p className="px-1 text-xs text-muted-foreground">Try asking…</p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() =>
                      void sendMessage(prompt, selectedModel || undefined)
                    }
                    disabled={isSending || !available}
                    className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="size-3 shrink-0" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DashboardComposer
          draft={draft}
          isSending={isSending}
          available={available}
          selectedModel={selectedModel}
          setDraft={setDraft}
          setSelectedModel={setSelectedModel}
          onKeyDown={handleKeyDown}
          onSubmit={handleSubmit}
          statusQuery={statusQuery}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:-mt-12">
      <div className="border-b bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">AI Assistant</span>
            <Badge
              variant={statusQuery.data?.available ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {statusQuery.data?.available ? 'OpenWire ready' : 'Unavailable'}
            </Badge>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {statusQuery.data?.available &&
              statusQuery.data.models.length > 0 && (
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={isSending}
                >
                  <SelectTrigger className="h-8 w-34 border-border/50 bg-muted/40 text-xs sm:h-7 sm:w-auto sm:max-w-50">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusQuery.data.models.map((model) => (
                      <SelectItem key={model} value={model} className="text-xs">
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={clearConversation}
              aria-label="Clear conversation"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden pb-44 sm:pb-48">
        <ScrollArea className="h-full px-4 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 pb-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div
                  data-slot="badge"
                  className={
                    message.role === 'user'
                      ? 'max-w-[88%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground sm:max-w-[80%]'
                      : 'max-w-[94%] rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm sm:max-w-[88%]'
                  }
                >
                  {message.role === 'assistant' ? (
                    <AssistantMessage content={message.content} />
                  ) : (
                    <div className="whitespace-pre-wrap leading-6">
                      {message.content}
                    </div>
                  )}
                  {message.role === 'assistant' ? (
                    <AssistantAnalysisTrace
                      analysis={message.analysis}
                      toolsUsed={message.toolsUsed}
                    />
                  ) : null}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Analyzing with available tools…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <DashboardComposer
        draft={draft}
        isSending={isSending}
        available={available}
        selectedModel={selectedModel}
        setDraft={setDraft}
        setSelectedModel={setSelectedModel}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
        statusQuery={statusQuery}
        compact
      />
    </div>
  )
}

type DashboardComposerProps = {
  draft: string
  isSending: boolean
  available: boolean
  selectedModel: string
  setDraft: (value: string) => void
  setSelectedModel: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: () => Promise<void>
  statusQuery: {
    data?: AiAssistantStatus
    isLoading: boolean
  }
  compact?: boolean
}

function DashboardComposer({
  draft,
  isSending,
  available,
  selectedModel,
  setDraft,
  setSelectedModel,
  onKeyDown,
  onSubmit,
  statusQuery,
  compact = false,
}: DashboardComposerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-background via-background/92 to-transparent" />
      <div className="pointer-events-auto relative mx-auto max-w-3xl">
        <div className="rounded-3xl border border-border/70 bg-background/90 p-2 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:p-3">
          <div className="relative rounded-2xl border border-border/70 bg-card shadow-sm transition-all focus-within:border-border focus-within:ring-1 focus-within:ring-ring/20">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                compact
                  ? 'Ask a follow-up question…'
                  : 'Ask anything about your data...'
              }
              rows={compact ? 2 : 3}
              disabled={isSending || !available}
              className="min-h-24 resize-none rounded-2xl border-0 bg-transparent px-4 pt-4 pb-16 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-5"
            />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              {statusQuery.data?.available &&
              statusQuery.data.models.length > 0 ? (
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={isSending}
                >
                  <SelectTrigger className="h-8 w-34 border-border/50 bg-muted/40 text-xs sm:w-auto sm:max-w-45">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusQuery.data.models.map((model) => (
                      <SelectItem key={model} value={model} className="text-xs">
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant={
                    statusQuery.data?.available ? 'secondary' : 'outline'
                  }
                  className="text-xs"
                >
                  {statusQuery.isLoading
                    ? 'Checking OpenWire…'
                    : statusQuery.data?.available
                      ? `OpenWire ready · ${statusQuery.data.defaultModel}`
                      : 'OpenWire unavailable'}
                </Badge>
              )}

              <div className="flex items-center gap-2">
                <p className="hidden text-xs text-muted-foreground sm:block">
                  ⌘ Enter to send
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onSubmit()}
                  disabled={!draft.trim() || isSending || !available}
                  className="h-8 gap-1.5 rounded-xl px-3 text-xs"
                >
                  {isSending ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <CornerDownLeft className="size-3.5" />
                  )}
                  {isSending ? 'Thinking…' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
