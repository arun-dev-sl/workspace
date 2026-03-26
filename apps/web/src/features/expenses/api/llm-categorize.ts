import { z } from "zod";

import { apiRequest } from "@/lib/api-client";

// ── Types ──

export type LlmProvider = "openwire" | "gemini";

export interface LlmProviderStatus {
  openwire: boolean;
  gemini: boolean;
}

const LlmCategorizationSuggestionSchema = z.object({
  id: z.string(),
  category: z.string(),
  subcategory: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

export type LlmCategorizationSuggestion = z.infer<
  typeof LlmCategorizationSuggestionSchema
>;

const LlmCategorizeResponseSchema = z.object({
  suggestions: z.array(LlmCategorizationSuggestionSchema),
});

// ── Fetchers ──

export async function fetchLlmProviders(): Promise<LlmProviderStatus> {
  const json = await apiRequest<LlmProviderStatus>({
    method: "GET",
    url: "/api/expenses/llm-providers",
  });
  return json;
}

export async function requestLlmCategorization(
  transactionIds: string[],
  provider: LlmProvider,
): Promise<LlmCategorizationSuggestion[]> {
  const json = await apiRequest<{ suggestions: unknown[] }>({
    method: "POST",
    url: "/api/expenses/categorize-with-llm",
    data: { transactionIds, provider },
  });
  const parsed = LlmCategorizeResponseSchema.parse(json);
  return parsed.suggestions;
}
