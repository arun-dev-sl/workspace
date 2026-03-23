import { z } from "zod";

import { apiRequest } from "@/lib/api-client";

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

const aiAssistantChatResponseSchema = z.object({
  message: z.string(),
  model: z.string(),
  toolsUsed: z.array(z.string()).default([]),
  analysis: z
    .object({
      status: z.literal('completed'),
      totalToolRounds: z.number(),
      toolsUsed: z.array(z.string()).default([]),
      steps: z.array(
        z.object({
          id: z.string(),
          type: z.enum(['prefetch', 'observation', 'tool-call', 'final']),
          title: z.string(),
          summary: z.string(),
          status: z.enum(['completed', 'failed']),
          toolName: z.string().optional(),
          toolArgs: z.unknown().optional(),
          resultData: z.unknown().optional(),
          resultPreview: z.string().optional(),
        }),
      ),
    })
    .optional(),
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
}): Promise<AiAssistantChatResponse> {
  const json = await apiRequest({
    method: "POST",
    url: "/api/ai-assistant/chat",
    data: {
      messages: z.array(aiAssistantChatMessageSchema).min(1).max(20).parse(input.messages),
      model: input.model,
    },
    toastError: false,
  });

  return aiAssistantChatResponseSchema.parse(json);
}