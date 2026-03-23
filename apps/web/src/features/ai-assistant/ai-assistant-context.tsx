import React from 'react'

import {
  createConversation,
  getConversation,
  saveMessage,
  streamAiAssistantChat,
  type AiAssistantChatMessage,
  type AiAssistantChatResponse,
  type AiAssistantPageContext,
  type AiStreamEvent,
} from '@/features/ai-assistant/api/assistant'
import { useAuthSession } from '@/app/auth-session-context'

export interface AiAssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolsUsed?: string[]
  analysis?: AiAssistantChatResponse['analysis']
  activeTools?: string[]
}

interface AiAssistantContextValue {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  messages: AiAssistantMessage[]
  isSending: boolean
  error: string | null
  pageContext: AiAssistantPageContext | undefined
  conversationId: string | null
  sendMessage: (content: string, model?: string) => Promise<void>
  clearConversation: () => void
  setPageContext: (context: AiAssistantPageContext | undefined) => void
  loadConversation: (id: string) => Promise<void>
  startNewConversation: () => void
}

const AiAssistantContext = React.createContext<
  AiAssistantContextValue | undefined
>(undefined)

export function AiAssistantProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated } = useAuthSession()
  const [enabled, setEnabled] = React.useState(false)
  const [messages, setMessages] = React.useState<AiAssistantMessage[]>([])
  const [isSending, setIsSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pageContext, setPageContext] = React.useState<AiAssistantPageContext | undefined>()
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) {
      setEnabled(false)
      setMessages([])
      setError(null)
      setPageContext(undefined)
      setConversationId(null)
    }
  }, [isAuthenticated])

  const startNewConversation = React.useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setConversationId(null)
  }, [])

  const clearConversation = startNewConversation

  const loadConversation = React.useCallback(async (id: string) => {
    abortRef.current?.abort()
    setError(null)
    setIsSending(true)
    try {
      const { messages: persisted } = await getConversation(id)
      setConversationId(id)
      setMessages(
        persisted.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          analysis: msg.analysis as AiAssistantChatResponse['analysis'],
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setIsSending(false)
    }
  }, [])

  const sendMessage = React.useCallback(
    async (content: string, model?: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const userMessage: AiAssistantMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      }

      const assistantMessageId = crypto.randomUUID()

      const requestMessages: AiAssistantChatMessage[] = [
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: 'user', content: trimmed },
      ]

      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          isStreaming: true,
          activeTools: [],
        },
      ])
      setError(null)
      setIsSending(true)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      let activeConversationId = conversationId
      let finalEvent: (AiStreamEvent & { type: 'done' }) | null = null

      try {
        if (!activeConversationId) {
          const firstWords = trimmed.split(/\s+/).slice(0, 6).join(' ')
          const title = firstWords.length > 50 ? `${firstWords.slice(0, 50)}…` : firstWords
          const conversation = await createConversation(title, model)
          activeConversationId = conversation.id
          setConversationId(conversation.id)
        }

        await saveMessage(activeConversationId, { role: 'user', content: trimmed }).catch(() => {})

        await streamAiAssistantChat(
          { messages: requestMessages, model, pageContext },
          (event: AiStreamEvent) => {
            switch (event.type) {
              case 'token': {
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + event.content }
                      : msg,
                  ),
                )
                break
              }
              case 'tool-start': {
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          activeTools: [...(msg.activeTools ?? []), event.toolName],
                        }
                      : msg,
                  ),
                )
                break
              }
              case 'tool-result': {
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          activeTools: (msg.activeTools ?? []).filter(
                            (t) => t !== event.toolName,
                          ),
                        }
                      : msg,
                  ),
                )
                break
              }
              case 'done': {
                finalEvent = event
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: event.message,
                          isStreaming: false,
                          toolsUsed: event.toolsUsed,
                          analysis: event.analysis,
                          activeTools: undefined,
                        }
                      : msg,
                  ),
                )
                break
              }
              case 'error': {
                setError(event.message)
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false, activeTools: undefined }
                      : msg,
                  ),
                )
                break
              }
            }
          },
          controller.signal,
        )

        if (finalEvent && activeConversationId) {
          const done = finalEvent as AiStreamEvent & { type: 'done' }
          await saveMessage(activeConversationId, {
            role: 'assistant',
            content: done.message,
            analysis: done.analysis,
            usage: done.usage,
          }).catch(() => {})
        }
      } catch (sendError) {
        if (sendError instanceof Error && sendError.name === 'AbortError') {
          return
        }
        setError(
          sendError instanceof Error
            ? sendError.message
            : 'Failed to get an AI response.',
        )
        setMessages((current) =>
          current.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, activeTools: undefined }
              : msg,
          ),
        )
      } finally {
        setIsSending(false)
      }
    },
    [messages, pageContext, conversationId],
  )

  const value = React.useMemo<AiAssistantContextValue>(
    () => ({
      enabled,
      setEnabled,
      messages,
      isSending,
      error,
      pageContext,
      conversationId,
      sendMessage,
      clearConversation,
      setPageContext,
      loadConversation,
      startNewConversation,
    }),
    [clearConversation, conversationId, enabled, error, isSending, loadConversation, messages, pageContext, sendMessage, startNewConversation],
  )

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
    </AiAssistantContext.Provider>
  )
}

export function useAiAssistant() {
  const context = React.useContext(AiAssistantContext)
  if (!context) {
    throw new Error('useAiAssistant must be used within AiAssistantProvider')
  }

  return context
}

export function useAiPageContext(pageContext: AiAssistantPageContext | undefined) {
  const { setPageContext } = useAiAssistant()

  React.useEffect(() => {
    setPageContext(pageContext)
    return () => setPageContext(undefined)
  }, [pageContext, setPageContext])
}
