import { Inject, Injectable } from '@nestjs/common'

import { FLIGHT_LLM_EXTRACTOR } from '@/modules/flights/application/ports/flight-llm-extractor.port'
import {
  finalizeFlightSegment,
  mergeSegmentDrafts,
} from '@/modules/flights/infrastructure/extractors/flight-extractor.utils'
import { HeuristicFlightExtractor } from '@/modules/flights/infrastructure/extractors/heuristic-flight.extractor'
import { JsonLdFlightExtractor } from '@/modules/flights/infrastructure/extractors/json-ld-flight.extractor'
import { prepareFlightEmailContent } from '@/shared/infrastructure/utils/flight-email-preprocessor.util'

import type { FlightExtractionResult, FlightSegment, FlightSegmentDraft } from '@/modules/flights/application/flight-extraction.schema'
import type { FlightLlmExtractor } from '@/modules/flights/application/ports/flight-llm-extractor.port'
import type { RawEmail } from '@workspace/domain'

export interface HybridFlightExtractorOptions {
  maxInputChars: number
  allowLlm: boolean
  failOnLlmBudgetExhausted?: boolean
}

export class FlightLlmInvocationError extends Error {
  readonly originalCause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'FlightLlmInvocationError'
    this.originalCause = cause
  }
}

@Injectable()
export class HybridFlightExtractor {
  constructor(
    private readonly jsonLdFlightExtractor: JsonLdFlightExtractor,
    private readonly heuristicFlightExtractor: HeuristicFlightExtractor,
    @Inject(FLIGHT_LLM_EXTRACTOR)
    private readonly flightLlmExtractor: FlightLlmExtractor,
  ) {}

  async extract(
    email: RawEmail,
    options: HybridFlightExtractorOptions,
  ): Promise<FlightExtractionResult> {
    const prepared = prepareFlightEmailContent(email, options.maxInputChars)

    if (!this.isLikelyFlightEmail(email, prepared)) {
      return {
        segments: [],
        extractionMethod: 'none',
        llmAttempted: false,
      }
    }

    const heuristicDrafts = this.heuristicFlightExtractor.extract(
      prepared.normalizedText,
      email.receivedAt,
    )
    const jsonLdDrafts = this.jsonLdFlightExtractor.extract(
      prepared.structuredData,
      email.receivedAt,
    )

    if (jsonLdDrafts.length > 0) {
      const mergedSegments = this.finalizeSegments(
        mergeSegmentDrafts(jsonLdDrafts, heuristicDrafts),
      )

      if (mergedSegments.length > 0) {
        return {
          segments: mergedSegments,
          extractionMethod: 'json_ld',
          llmAttempted: false,
        }
      }
    }

    const heuristicSegments = this.finalizeSegments(heuristicDrafts)
    if (heuristicSegments.length > 0) {
      return {
        segments: heuristicSegments,
        extractionMethod: 'heuristic',
        llmAttempted: false,
      }
    }

    if (!options.allowLlm) {
      return {
        segments: [],
        extractionMethod: 'none',
        llmAttempted: false,
        ...(options.failOnLlmBudgetExhausted
          ? { failureReason: 'llm_budget_exhausted' as const }
          : {}),
      }
    }

    let llmDrafts: FlightSegmentDraft[]
    try {
      llmDrafts = await this.flightLlmExtractor.extract({
        subject: email.subject,
        from: email.from,
        receivedAt: email.receivedAt,
        text: prepared.normalizedText,
      })
    } catch (error) {
      throw new FlightLlmInvocationError(
        `Flight LLM extraction failed for email ${email.id}`,
        error,
      )
    }

    return {
      segments: this.finalizeSegments(llmDrafts),
      extractionMethod: 'llm',
      llmAttempted: true,
    }
  }

  private finalizeSegments(drafts: FlightSegmentDraft[]): FlightSegment[] {
    return drafts
      .map((draft, index) => finalizeFlightSegment(draft, index))
      .filter((segment): segment is FlightSegment => segment !== null)
  }

  private isLikelyFlightEmail(
    email: RawEmail,
    prepared: ReturnType<typeof prepareFlightEmailContent>,
  ): boolean {
    if (prepared.hasFlightJsonLd) {
      return true
    }

    const subject = email.subject.toLowerCase()
    if (
      /\b(flight|itinerary|booking|reservation|e-ticket|trip confirmation|travel confirmation)\b/i.test(
        subject,
      )
    ) {
      return true
    }

    const from = email.from.toLowerCase()
    if (/\b(air|airways|airline|booking|travel)\b/i.test(from)) {
      return true
    }

    const uppercaseText = prepared.normalizedText.toUpperCase()
    const flightNumberMatch = /\b[A-Z]{1,3}\s?\d{1,4}[A-Z]?\b/.test(uppercaseText)
    const airportMatches = uppercaseText.match(/\b[A-Z]{3}\b/g) ?? []
    const distinctAirports = [...new Set(airportMatches)]

    return flightNumberMatch && distinctAirports.length >= 2
  }
}
