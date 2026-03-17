import { GoogleGenAI } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { HotelLlmResponseSchema } from '@/modules/hotels/application/hotel-extraction.schema'

import type { Env } from '@/app/config/env.schema'
import type { HotelStayDraft } from '@/modules/hotels/application/hotel-extraction.schema'
import type { HotelLlmExtractor, HotelLlmPromptInput } from '@/modules/hotels/application/ports/hotel-llm-extractor.port'

@Injectable()
export class GeminiHotelLlmExtractor implements HotelLlmExtractor {
  private readonly logger = new Logger(GeminiHotelLlmExtractor.name)
  private readonly model = 'gemini-2.5-flash'

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async extract(input: HotelLlmPromptInput): Promise<HotelStayDraft | null> {
    const apiKey = this.configService.get('GEMINI_API_KEY', { infer: true })
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY')
    }

    const prompt = this.buildPrompt(input)

    this.logger.debug(
      `Sending hotel extraction prompt to Gemini: ${JSON.stringify({
        model: this.model,
        subject: input.subject,
        from: input.from,
        receivedAt: input.receivedAt,
        prompt,
      })}`,
    )

    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    })

    const rawText = response.text ?? ''
    this.logger.debug(
      `Received hotel extraction response from Gemini: ${JSON.stringify({
        model: this.model,
        rawText,
      })}`,
    )

    if (!rawText.trim()) {
      this.logger.warn('Gemini returned an empty response for hotel extraction')
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      this.logger.warn(
        `Gemini returned non-JSON content for hotel extraction: ${JSON.stringify({ rawText })}`,
      )
      return null
    }

    const result = HotelLlmResponseSchema.safeParse(parsed)
    if (!result.success) {
      this.logger.warn(
        `Gemini returned invalid JSON schema for hotel extraction: ${JSON.stringify({
          rawText,
          issues: result.error.issues,
        })}`,
      )
      return null
    }

    this.logger.debug(
      `Parsed hotel extraction response from Gemini: ${JSON.stringify(result.data)}`,
    )

    return result.data.stay
  }

  private buildPrompt(input: HotelLlmPromptInput): string {
    return [
      'Extract only hotel stay, reservation, booking, or accommodation confirmation details.',
      'Ignore loyalty marketing, upsells, support text, cancellation policy details, and general travel copy.',
      'Return JSON only with this shape:',
      '{"stay":{"hotelName":null,"lat":null,"lng":null,"city":null,"country":null,"timezone":null,"checkInDate":null,"checkOutDate":null,"nights":null,"pricingCurrency":null,"pricingTotal":null,"pricingNightly":null}}',
      'Rules:',
      '- Use YYYY-MM-DD dates when possible.',
      '- Keep latitude and longitude null unless they are explicitly present or unambiguous.',
      '- Do not invent values. Use null when unsure.',
      '- If the email is not a hotel stay or accommodation confirmation, return {"stay":null}.',
      '',
      `Subject: ${input.subject}`,
      `From: ${input.from}`,
      `Received At: ${input.receivedAt}`,
      '',
      input.text,
    ].join('\n')
  }
}
