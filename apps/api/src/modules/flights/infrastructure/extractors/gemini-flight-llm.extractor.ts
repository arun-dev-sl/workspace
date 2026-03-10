import { GoogleGenAI } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { FlightLlmResponseSchema } from '@/modules/flights/application/flight-extraction.schema'

import type { Env } from '@/app/config/env.schema'
import type { FlightSegmentDraft } from '@/modules/flights/application/flight-extraction.schema'
import type { FlightLlmExtractor, FlightLlmPromptInput } from '@/modules/flights/application/ports/flight-llm-extractor.port'

@Injectable()
export class GeminiFlightLlmExtractor implements FlightLlmExtractor {
  private readonly logger = new Logger(GeminiFlightLlmExtractor.name)

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async extract(input: FlightLlmPromptInput): Promise<FlightSegmentDraft[]> {
    const apiKey = this.configService.get('GEMINI_API_KEY', { infer: true })
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY')
    }

    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: this.buildPrompt(input),
      config: {
        responseMimeType: 'application/json',
      },
    })

    const rawText = response.text ?? ''
    if (!rawText.trim()) {
      return []
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      this.logger.warn('Gemini returned non-JSON content for flight extraction')
      return []
    }

    const result = FlightLlmResponseSchema.safeParse(parsed)
    if (!result.success) {
      this.logger.warn('Gemini returned invalid JSON schema for flight extraction')
      return []
    }

    return result.data.segments
  }

  private buildPrompt(input: FlightLlmPromptInput): string {
    return [
      'Extract only flight booking, itinerary, or travel confirmation details.',
      'Ignore passenger names, baggage, seats, ticket PDFs, fare rules, and marketing copy.',
      'Return JSON only with this shape:',
      '{"segments":[{"segmentIndex":0,"pnr":null,"airlineName":null,"flightNumber":null,"fromAirport":null,"toAirport":null,"departureDate":null,"departureTime":null,"arrivalDate":null,"arrivalTime":null,"departureAt":null,"arrivalAt":null,"departureTimezone":null,"arrivalTimezone":null,"travelClass":null}]}',
      'Rules:',
      '- Include one array item per flight segment.',
      '- Use uppercase 3-letter airport codes when present.',
      '- Use YYYY-MM-DD dates when possible.',
      '- Use HH:mm times when possible.',
      '- Do not invent values. Use null when unsure.',
      '- If the email is not a flight booking/itinerary/travel confirmation, return {"segments":[]}.',
      '',
      `Subject: ${input.subject}`,
      `From: ${input.from}`,
      `Received At: ${input.receivedAt}`,
      '',
      input.text,
    ].join('\n')
  }
}
