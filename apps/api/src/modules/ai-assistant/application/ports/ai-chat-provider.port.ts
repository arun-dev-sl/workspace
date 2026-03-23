export interface AiChatProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: AiChatProviderToolCall[]
}

export interface AiChatProviderToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AiChatProviderToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AiChatProviderUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AiChatProviderCompletion {
  content: string | null
  model: string
  usage?: AiChatProviderUsage
  toolCalls?: AiChatProviderToolCall[]
}

export type AiChatProviderStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'tool-call-start'; toolCall: { id: string; name: string } }
  | { type: 'tool-call-args'; toolCallId: string; argumentsDelta: string }
  | { type: 'done'; model: string; usage?: AiChatProviderUsage }

export type AiChatCompletionInput = {
  model?: string
  messages: AiChatProviderMessage[]
  tools?: AiChatProviderToolDefinition[]
  toolChoice?: 'auto' | 'required' | 'none'
}

export interface AiChatProvider {
  listModels(): Promise<string[]>
  createChatCompletion(input: AiChatCompletionInput): Promise<AiChatProviderCompletion>
  createStreamingChatCompletion(input: AiChatCompletionInput): AsyncIterable<AiChatProviderStreamChunk>
}

export const AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER')
