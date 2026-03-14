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

export interface AiChatProvider {
  listModels(): Promise<string[]>
  createChatCompletion(input: {
    model?: string
    messages: AiChatProviderMessage[]
    tools?: AiChatProviderToolDefinition[]
    toolChoice?: 'auto' | 'required' | 'none'
  }): Promise<AiChatProviderCompletion>
}

export const AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER')
