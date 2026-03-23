import { z } from "zod";

import { apiRequest } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

export const aiAssistantChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export type AiAssistantPageContext = {
  pageId: string;
  title: string;
  route: string;
  description?: string;
  filters?: Record<string, unknown>;
  dataSnapshot?: Record<string, unknown>;
};

const aiAssistantStatusSchema = z.object({
  available: z.boolean(),
  baseUrl: z.string(),
  defaultModel: z.string(),
  models: z.array(z.string()),
  error: z.string().optional(),
});

export const aiAnalysisStepSchema = z.object({
  id: z.string(),
  type: z.enum(['prefetch', 'observation', 'tool-call', 'final']),
  title: z.string(),
  summary: z.string(),
  status: z.enum(['completed', 'failed']),
  toolName: z.string().optional(),
  toolArgs: z.unknown().optional(),
  resultData: z.unknown().optional(),
  resultPreview: z.string().optional(),
});

export const aiAnalysisSchema = z.object({
  status: z.literal('completed'),
  totalToolRounds: z.number(),
  toolsUsed: z.array(z.string()).default([]),
  steps: z.array(aiAnalysisStepSchema),
});

const aiAssistantChatResponseSchema = z.object({
  message: z.string(),
  model: z.string(),
  toolsUsed: z.array(z.string()).default([]),
  analysis: aiAnalysisSchema.optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type AiAssistantChatMessage = z.infer<typeof aiAssistantChatMessageSchema>;
export type AiAssistantStatus = z.infer<typeof aiAssistantStatusSchema>;
export type AiAssistantChatResponse = z.infer<typeof aiAssistantChatResponseSchema>;
export type AiAnalysisStep = z.infer<typeof aiAnalysisStepSchema>;
export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;

export type AiStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool-start'; toolName: string; toolCallId: string }
  | { type: 'tool-result'; toolCallId: string; toolName: string; ok: boolean; preview: string }
  | { type: 'step'; step: AiAnalysisStep }
  | { type: 'done'; message: string; model: string; toolsUsed: string[]; analysis: AiAnalysis; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'error'; message: string };

export async function getAiAssistantStatus(): Promise<AiAssistantStatus> {
  const json = await apiRequest({
    method: "GET",
    url: "/api/ai-assistant/status",
    toastError: false,
  });

  return aiAssistantStatusSchema.parse(json);
}

export async function sendAiAssistantChat(input: {
  messages: AiAssistantChatMessage[];
  model?: string;
  pageContext?: AiAssistantPageContext;
}): Promise<AiAssistantChatResponse> {
  const json = await apiRequest({
    method: "POST",
    url: "/api/ai-assistant/chat",
    data: {
      messages: z.array(aiAssistantChatMessageSchema).min(1).max(40).parse(input.messages),
      model: input.model,
      pageContext: input.pageContext,
    },
    toastError: false,
  });

  return aiAssistantChatResponseSchema.parse(json);
}

export type AiConversationSummary = {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiPersistedMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: unknown;
  analysis: unknown;
  usage: unknown;
  createdAt: string;
};

export async function listConversations(limit = 20, offset = 0): Promise<{ data: AiConversationSummary[]; total: number }> {
  return apiRequest({
    method: 'GET',
    url: `/api/ai-assistant/conversations?limit=${limit}&offset=${offset}`,
    toastError: false,
  });
}

export async function getConversation(id: string): Promise<{ conversation: AiConversationSummary; messages: AiPersistedMessage[] }> {
  return apiRequest({
    method: 'GET',
    url: `/api/ai-assistant/conversations/${id}`,
    toastError: false,
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    url: `/api/ai-assistant/conversations/${id}`,
    toastError: false,
  });
}

export async function renameConversation(id: string, title: string): Promise<AiConversationSummary> {
  return apiRequest({
    method: 'PATCH',
    url: `/api/ai-assistant/conversations/${id}`,
    data: { title },
    toastError: false,
  });
}

export async function submitMessageFeedback(messageId: string, rating: 'thumbs_up' | 'thumbs_down', comment?: string): Promise<void> {
  await apiRequest({
    method: 'POST',
    url: `/api/ai-assistant/messages/${messageId}/feedback`,
    data: { rating, comment },
    toastError: false,
  });
}

export async function streamAiAssistantChat(
  input: {
    messages: AiAssistantChatMessage[];
    model?: string;
    pageContext?: AiAssistantPageContext;
  },
  onEvent: (event: AiStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch('/api/ai-assistant/chat/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: z.array(aiAssistantChatMessageSchema).min(1).max(40).parse(input.messages),
      model: input.model,
      pageContext: input.pageContext,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Stream request failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No readable stream in response');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const event = JSON.parse(trimmed.slice(6)) as AiStreamEvent;
          onEvent(event);
        } catch {
          // skip malformed events
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}