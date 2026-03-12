import type {
  FlightActivityExtractionMethod,
} from '@workspace/domain'

type FlightRecordedExtractionMethod
  = | FlightActivityExtractionMethod

export function formatFlightExtractionMethod(
  method: FlightRecordedExtractionMethod,
): string {
  switch (method) {
    case 'json_ld': {
      return 'JSON-LD'
    }
    case 'heuristic': {
      return 'Heuristic'
    }
    case 'llm': {
      return 'LLM'
    }
    case 'manual': {
      return 'Manual'
    }
  }
}

export function formatFlightExtractionMethodHistory(
  methods: readonly FlightRecordedExtractionMethod[],
): string {
  if (methods.length === 0) {
    return 'Not attempted'
  }

  return methods.map((method) => formatFlightExtractionMethod(method)).join(' + ')
}

export function getLatestFlightExtractionMethod(
  methods: readonly FlightRecordedExtractionMethod[],
): FlightRecordedExtractionMethod | null {
  if (methods.length === 0) {
    return null
  }

  return methods[methods.length - 1] ?? null
}

export function hasFlightExtractionMethod(
  methods: readonly FlightRecordedExtractionMethod[],
  method: FlightRecordedExtractionMethod,
): boolean {
  return methods.includes(method)
}
