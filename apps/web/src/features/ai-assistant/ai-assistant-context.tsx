import React from 'react'

import {
  sendAiAssistantChat,
  type AiAssistantChatMessage,
} from '@/features/ai-assistant/api/assistant'
import { useAuthSession } from '@/app/auth-session-context'

interface AiAssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
}

interface AiAssistantContextValue {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  messages: AiAssistantMessage[]
  isSending: boolean
  error: string | null
  sendMessage: (content: string, model?: string) => Promise<void>
  clearConversation: () => void
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

  React.useEffect(() => {
    if (!isAuthenticated) {
      setEnabled(false)
      setMessages([])
      setError(null)
    }
  }, [isAuthenticated])

  const clearConversation = React.useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const sendMessage = React.useCallback(
    async (content: string, model?: string) => {
      const trimmed = content.trim()
      if (!trimmed) {
        return
      }

      const userMessage: AiAssistantMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      }
      const requestMessages: AiAssistantChatMessage[] = [
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: 'user',
          content: trimmed,
        },
      ]

      setMessages((current) => [...current, userMessage])
      setError(null)
      setIsSending(true)

      try {
        const response = await sendAiAssistantChat({
          messages: requestMessages,
          model,
        })

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.message,
            toolsUsed: response.toolsUsed,
          },
        ])
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : 'Failed to get an AI response.',
        )
      } finally {
        setIsSending(false)
      }
    },
    [messages],
  )

  const value = React.useMemo<AiAssistantContextValue>(
    () => ({
      enabled,
      setEnabled,
      messages,
      isSending,
      error,
      sendMessage,
      clearConversation,
    }),
    [clearConversation, enabled, error, isSending, messages, sendMessage],
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

export function useAiPageContext(_pageContext: unknown) {
  return undefined
}
