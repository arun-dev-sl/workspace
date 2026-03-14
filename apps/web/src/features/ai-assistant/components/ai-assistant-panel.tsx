import { useQuery } from '@tanstack/react-query'
import { Bot, ChevronDown, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { getAiAssistantStatus } from '@/features/ai-assistant/api/assistant'
import { useAiAssistant } from '@/features/ai-assistant/ai-assistant-context'
import { AssistantAnalysisTrace } from '@/features/ai-assistant/components/assistant-analysis-trace'
import { AssistantMessage } from '@/features/ai-assistant/components/assistant-message'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import { ScrollArea } from '@workspace/ui/components/ui/scroll-area'
import { Separator } from '@workspace/ui/components/ui/separator'
import { Textarea } from '@workspace/ui/components/ui/textarea'
import { cn } from '@workspace/ui/lib/utils'

function getQuickPrompts() {
  return [
    'How much have I invested in gold?',
    'What are my top three holdings by current value?',
    'Infer the strongest travel operating pattern from flights and hotels together.',
    'Which platform has the highest allocation and what does that imply?',
    'What should I investigate next across my finances and travel data?',
  ]
}

export function AiAssistantPanel() {
  const { enabled, messages, isSending, error, sendMessage } = useAiAssistant()
  const [draft, setDraft] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [minimized, setMinimized] = useState(false)
  const quickPrompts = useMemo(() => getQuickPrompts(), [])
  const statusQuery = useQuery({
    queryKey: ['ai-assistant', 'status'],
    queryFn: getAiAssistantStatus,
    enabled,
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
      if (current && availableModels.includes(current)) {
        return current
      }

      if (
        statusQuery.data.defaultModel &&
        availableModels.includes(statusQuery.data.defaultModel)
      ) {
        return statusQuery.data.defaultModel
      }

      return availableModels[0] ?? ''
    })
  }, [statusQuery.data])

  if (!enabled) {
    return null
  }

  const handleSubmit = async () => {
    const nextMessage = draft.trim()
    if (!nextMessage || isSending) {
      return
    }

    setDraft('')
    await sendMessage(nextMessage, selectedModel || undefined)
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Expand AI Assistant"
        className="fixed bottom-4 right-4 z-50 flex size-11 items-center justify-center rounded-full border border-border/70 bg-card/95 shadow-2xl backdrop-blur-sm transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
      >
        <Bot className="size-5 text-muted-foreground" />
      </button>
    )
  }

  return (
    <Card className="fixed inset-x-3 bottom-3 top-16 z-50 flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border-border/70 bg-card/98 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(42rem,calc(100dvh-7rem))] sm:w-[28rem] sm:max-w-[calc(100vw-3rem)] sm:rounded-[1.75rem]">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              AI Assistant
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              Ask a question directly. The backend will decide which tools to
              call.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMinimized(true)}
            aria-label="Minimize panel"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant={statusQuery.data?.available ? 'secondary' : 'outline'}
          >
            {statusQuery.isLoading
              ? 'Checking OpenWire'
              : statusQuery.data?.available
                ? `OpenWire ready${statusQuery.data.defaultModel ? ` · ${statusQuery.data.defaultModel}` : ''}`
                : 'OpenWire unavailable'}
          </Badge>
        </div>

        {statusQuery.data?.available && statusQuery.data.models.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Language model</p>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={isSending}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {statusQuery.data.models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </CardHeader>

      {!minimized && (
        <>
          <Separator />

          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Ready for query-first analysis
                    </p>
                    <p className="mt-2">
                      Ask directly about holdings, expenses, principal, flights,
                      hotels, or cross-domain patterns.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {quickPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal text-left text-xs"
                        onClick={() => {
                          void sendMessage(prompt, selectedModel || undefined)
                        }}
                        disabled={isSending || !statusQuery.data?.available}
                      >
                        <Sparkles className="mr-2 size-3.5" />
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-hidden">
                <ScrollArea
                  className={cn(
                    'h-full pr-1 sm:pr-2',
                    messages.length > 0 ? 'block' : 'hidden',
                  )}
                >
                  <div className="space-y-4 pb-2 pr-2">
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
                          className={
                            message.role === 'user'
                              ? 'min-w-0 max-w-[88%] overflow-hidden wrap-anywhere rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground sm:max-w-[85%]'
                              : 'min-w-0 max-w-[94%] overflow-hidden wrap-anywhere rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm text-foreground sm:max-w-[88%]'
                          }
                        >
                          {message.role === 'assistant' ? (
                            <AssistantMessage content={message.content} />
                          ) : (
                            <div className="whitespace-pre-wrap leading-6 wrap-anywhere">
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
                  </div>
                </ScrollArea>
              </div>

              {isSending ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Analyzing with available tools...
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {statusQuery.data && !statusQuery.data.available ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                OpenWire could not be reached at {statusQuery.data.baseUrl}.
                Start the VS Code extension server or update the API env.
              </div>
            ) : null}

            <div className="space-y-2 border-t border-border/60 pt-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about holdings, expenses, principal, flights, hotels, or any cross-domain pattern..."
                rows={3}
                disabled={isSending || !statusQuery.data?.available}
                className="min-h-24 resize-none"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-xs text-muted-foreground">
                  The backend chooses tools based on your question only.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    void handleSubmit()
                  }}
                  disabled={
                    !draft.trim() || isSending || !statusQuery.data?.available
                  }
                  className="w-full sm:w-auto"
                >
                  {isSending ? 'Analyzing...' : 'Send'}
                </Button>
              </div>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  )
}
