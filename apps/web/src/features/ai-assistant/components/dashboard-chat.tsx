import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  CornerDownLeft,
  LoaderCircle,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getAiAssistantStatus } from '@/features/ai-assistant/api/assistant'
import { useAiAssistant } from '@/features/ai-assistant/ai-assistant-context'
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
      <div className="flex h-full flex-col items-center justify-center gap-10 px-4 py-8 min-h-[80vh]">
        {/* Greeting */}
        <div className="text-center space-y-2 max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            What would you like to explore?
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ask about holdings, expenses, flights, hotels, or any pattern across
            your personal data.
          </p>
        </div>

        {/* Input area */}
        <div className="w-full max-w-2xl space-y-3">
          <div className="relative rounded-2xl border border-border/70 bg-card shadow-sm focus-within:border-border focus-within:ring-1 focus-within:ring-ring/20 transition-all">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your data..."
              rows={3}
              disabled={isSending || !available}
              className="resize-none rounded-2xl border-0 bg-transparent px-5 pt-4 pb-14 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {statusQuery.data?.available &&
                statusQuery.data.models.length > 0 && (
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    disabled={isSending}
                  >
                    <SelectTrigger className="h-8 w-auto max-w-[180px] border-border/50 bg-muted/40 text-xs">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusQuery.data.models.map((model) => (
                        <SelectItem
                          key={model}
                          value={model}
                          className="text-xs"
                        >
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSubmit()}
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

          {/* Status */}
          <div className="flex items-center justify-between px-1">
            <Badge
              variant={statusQuery.data?.available ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {statusQuery.isLoading
                ? 'Checking OpenWire…'
                : statusQuery.data?.available
                  ? `OpenWire ready · ${statusQuery.data.defaultModel}`
                  : 'OpenWire unavailable'}
            </Badge>
            <p className="text-xs text-muted-foreground">⌘ Enter to send</p>
          </div>

          {/* Quick prompts */}
          <div className="pt-2 space-y-2">
            <p className="text-xs text-muted-foreground px-1">Try asking…</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() =>
                    void sendMessage(prompt, selectedModel || undefined)
                  }
                  disabled={isSending || !available}
                  className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="size-3 shrink-0" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Sticky top header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur-sm -mt-12">
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

        <div className="flex items-center gap-2">
          {statusQuery.data?.available &&
            statusQuery.data.models.length > 0 && (
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isSending}
              >
                <SelectTrigger className="h-7 w-auto max-w-[200px] border-border/50 bg-muted/40 text-xs">
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
            className="size-7"
            onClick={clearConversation}
            aria-label="Clear conversation"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
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
                    ? 'max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground'
                    : 'max-w-[88%] rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm'
                }
              >
                {message.role === 'assistant' ? (
                  <AssistantMessage content={message.content} />
                ) : (
                  <div className="whitespace-pre-wrap leading-6">
                    {message.content}
                  </div>
                )}
                {message.role === 'assistant' &&
                message.toolsUsed &&
                message.toolsUsed.length > 0 ? (
                  <div className="mt-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                    Used tools: {message.toolsUsed.join(', ')}
                  </div>
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

      {/* Sticky bottom input */}
      <div className="sticky bottom-0 border-t bg-background/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <div className="relative rounded-2xl border border-border/70 bg-card focus-within:border-border focus-within:ring-1 focus-within:ring-ring/20 transition-all">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question…"
              rows={2}
              disabled={isSending || !available}
              className="resize-none rounded-2xl border-0 bg-transparent px-5 pt-3 pb-12 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="absolute bottom-3 right-3">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSubmit()}
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
          <p className="mt-2 text-center text-xs text-muted-foreground">
            ⌘ Enter to send
          </p>
        </div>
      </div>
    </div>
  )
}
