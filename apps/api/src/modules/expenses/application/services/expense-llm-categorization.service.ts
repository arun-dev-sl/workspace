import { GoogleGenAI } from '@google/genai'
import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'

import type { Env } from '@/app/config/env.schema'
import type { LlmProvider, LlmCategorizationSuggestion } from '@/modules/expenses/presentation/dtos/llm-categorize.dto'
import type { Transaction } from '@workspace/domain'

const VALID_CATEGORIES = [
  'uncategorized', 'food_dining', 'groceries', 'shopping', 'transport',
  'utilities', 'utility_bills', 'income_salary', 'personal_transfer',
  'apps_and_software', 'banking_and_finance', 'cards_and_finance_charges',
  'education', 'emi', 'entertainment', 'medical', 'health_and_wellness',
  'wallet_and_digital_payment', 'cash_withdrawal', 'reversal_and_refunds',
  'rent', 'cars_and_rentals', 'government_payments', 'insurance',
  'wallet_loads', 'professional_services', 'credit_card_bills', 'cashback',
  'friends', 'others', 'trips', 'gift_cards', 'investments',
] as const

const LlmResponseItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  subcategory: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

const LlmResponseSchema = z.object({
  suggestions: z.array(LlmResponseItemSchema),
})

type TransactionSlice = Pick<
  Transaction,
  'id' | 'merchant' | 'merchantRaw' | 'amount' | 'transactionMode' | 'transactionType' | 'category' | 'vpa'
>

const BATCH_SIZE = 20

@Injectable()
export class ExpenseLlmCategorizationService {
  private readonly logger = new Logger(ExpenseLlmCategorizationService.name)

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async getAvailableProviders(): Promise<{ openwire: boolean, gemini: boolean }> {
    const geminiKey = this.configService.get('GEMINI_API_KEY', { infer: true })
    const openwireUrl = this.configService.get('OPENWIRE_BASE_URL', { infer: true })

    let openwireAvailable = false
    if (openwireUrl) {
      try {
        const response = await fetch(`${openwireUrl}/v1/models`, {
          signal: AbortSignal.timeout(5000),
        })
        openwireAvailable = response.ok
      } catch {
        openwireAvailable = false
      }
    }

    return {
      openwire: openwireAvailable,
      gemini: Boolean(geminiKey),
    }
  }

  async categorize(
    transactions: TransactionSlice[],
    provider: LlmProvider,
  ): Promise<LlmCategorizationSuggestion[]> {
    if (transactions.length === 0) return []

    const batches: TransactionSlice[][] = []
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      batches.push(transactions.slice(i, i + BATCH_SIZE))
    }

    const allSuggestions: LlmCategorizationSuggestion[] = []

    for (const batch of batches) {
      const prompt = this.buildPrompt(batch)
      const rawJson = provider === 'gemini'
        ? await this.callGemini(prompt)
        : await this.callOpenWire(prompt)

      const suggestions = this.parseResponse(rawJson, batch)
      allSuggestions.push(...suggestions)
    }

    return allSuggestions
  }

  private buildPrompt(transactions: TransactionSlice[]): string {
    const categoryList = VALID_CATEGORIES.join(', ')

    const transactionLines = transactions.map((txn) => {
      const parts = [
        `id: "${txn.id}"`,
        `merchant: "${txn.merchant}"`,
        `merchantRaw: "${txn.merchantRaw}"`,
        `amount: ${txn.amount}`,
        `mode: "${txn.transactionMode}"`,
        `type: "${txn.transactionType}"`,
        `currentCategory: "${txn.category}"`,
      ]
      if (txn.vpa) parts.push(`vpa: "${txn.vpa}"`)
      return `  { ${parts.join(', ')} }`
    })

    return [
      'You are a financial transaction categorizer. Classify each transaction into the most appropriate category.',
      '',
      `Valid categories: ${categoryList}`,
      '',
      'For each transaction, determine:',
      '1. category: the best matching category from the valid list above',
      '2. subcategory: a more specific label within that category (use the category value if unsure)',
      '3. confidence: a number between 0 and 1 indicating how confident you are',
      '4. reasoning: a brief explanation of why you chose this category',
      '',
      'Rules:',
      '- Use the merchant name, raw merchant string, VPA, amount, and transaction mode as signals.',
      '- For UPI transactions, the VPA often contains merchant identifiers (e.g. swiggy, zomato, uber).',
      '- "credited" transactions are typically income/transfers; "debited" are expenses.',
      '- If a transaction is already correctly categorized, keep the same category but still include it.',
      '- Only use categories from the valid list. Do not invent new categories.',
      '- Return JSON only with this exact shape:',
      '{"suggestions":[{"id":"<transaction-id>","category":"<category>","subcategory":"<subcategory>","confidence":0.95,"reasoning":"<brief reason>"}]}',
      '',
      'Transactions to categorize:',
      '[',
      transactionLines.join(',\n'),
      ']',
    ].join('\n')
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = this.configService.get('GEMINI_API_KEY', { infer: true })
    if (!apiKey) {
      throw new BadRequestException('Gemini API key is not configured')
    }

    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    })

    return response.text ?? ''
  }

  private async callOpenWire(prompt: string): Promise<string> {
    const baseUrl = this.configService.get('OPENWIRE_BASE_URL', { infer: true })
    const apiKey = this.configService.get('OPENWIRE_API_KEY', { infer: true })
    const model = this.configService.get('OPENWIRE_MODEL', { infer: true })
    const timeoutMs = this.configService.get('OPENWIRE_TIMEOUT_MS', { infer: true })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a financial transaction categorizer. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body,
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      this.logger.warn(`OpenWire categorization failed: ${response.status} ${text}`)
      throw new BadRequestException(`LLM provider returned status ${response.status}`)
    }

    const json = await response.json() as { choices?: { message?: { content?: string } }[] }
    return json.choices?.[0]?.message?.content ?? ''
  }

  private parseResponse(
    rawJson: string,
    originalTransactions: TransactionSlice[],
  ): LlmCategorizationSuggestion[] {
    if (!rawJson.trim()) {
      this.logger.warn('LLM returned empty response for categorization')
      return []
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      this.logger.warn('LLM returned non-JSON content for categorization')
      return []
    }

    const result = LlmResponseSchema.safeParse(parsed)
    if (!result.success) {
      this.logger.warn('LLM returned invalid schema for categorization', result.error.issues)
      return []
    }

    const validIds = new Set(originalTransactions.map((t) => t.id))

    return result.data.suggestions
      .filter((suggestion) => validIds.has(suggestion.id))
      .map((suggestion) => ({
        ...suggestion,
        category: VALID_CATEGORIES.includes(suggestion.category as typeof VALID_CATEGORIES[number])
          ? suggestion.category
          : 'uncategorized',
        confidence: Math.round(suggestion.confidence * 100) / 100,
      }))
  }
}
