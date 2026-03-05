// ── Month name normalisation ──

const MONTH_MAP: Record<string, string> = {
  jan: 'Jan',
  january: 'Jan',
  feb: 'Feb',
  february: 'Feb',
  mar: 'Mar',
  march: 'Mar',
  apr: 'Apr',
  april: 'Apr',
  may: 'May',
  jun: 'Jun',
  june: 'Jun',
  jul: 'Jul',
  july: 'Jul',
  aug: 'Aug',
  august: 'Aug',
  sep: 'Sep',
  sept: 'Sep',
  september: 'Sep',
  oct: 'Oct',
  october: 'Oct',
  nov: 'Nov',
  november: 'Nov',
  dec: 'Dec',
  december: 'Dec',
}

function normalizeMonth(raw: string): string | null {
  return MONTH_MAP[raw.toLowerCase()] ?? null
}

export interface ParsedContribution {
  month: string
  year: number
  amountLakhs: number
  label: string
}

export interface ParsedDistribution {
  name: string
  value: number
}

const MONTH_ORDER = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Parse monthly contribution text.
 *
 * Accepted formats (tab or space separated):
 *   Jan 25 1.14
 *   Jan  1.14          (year inferred)
 *   Jan\t1.14
 *   Jan\t25\t1.14
 *
 * Amounts are in Lakhs.
 */
export function parseContributions(text: string): ParsedContribution[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const results: ParsedContribution[] = []

  const tokens = lines.map((l) => l.split(/[\t ]+/))
  const hasYearColumn = tokens.some(
    (t) => t.length >= 3 && /^\d{1,2}$/.test(t[1]!),
  )

  let inferredYear = 25
  let prevMonthIndex = -1

  for (const parts of tokens) {
    if (parts.length < 2) continue

    let monthStr: string
    let year: number
    let amountStr: string

    if (hasYearColumn && parts.length >= 3) {
      monthStr = parts[0]!
      year = Number.parseInt(parts[1]!, 10)
      amountStr = parts[2]!
    } else {
      monthStr = parts[0]!
      amountStr = parts.at(-1) ?? ''

      const month = normalizeMonth(monthStr)
      if (month) {
        const monthIdx = MONTH_ORDER.indexOf(month)
        if (prevMonthIndex >= 0 && monthIdx <= prevMonthIndex) {
          inferredYear++
        }
        prevMonthIndex = monthIdx
      }
      year = inferredYear
    }

    const month = normalizeMonth(monthStr)
    if (!month) continue

    const amount = Number.parseFloat(amountStr)
    if (Number.isNaN(amount)) continue

    results.push({
      month,
      year,
      amountLakhs: amount,
      label: `${month} ${year}`,
    })
  }

  return results
}

/**
 * Parse asset distribution text.
 *
 * Accepted format (tab or multi-space separated):
 *   Stocks 2,024,203.00
 *   Mutual Funds 1,410,376.00
 *
 * The last token on each line is the numeric value (commas removed).
 * Everything before it is the asset name.
 */
export function parseDistribution(text: string): ParsedDistribution[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const results: ParsedDistribution[] = []

  for (const line of lines) {
    let parts: string[]
    if (line.includes('\t')) {
      parts = line.split('\t').map((p) => p.trim()).filter(Boolean)
    } else {
      const match = /^(.+?)\s+([\d,]+(?:\.\d+)?)$/.exec(line)
      if (match) {
        parts = [match[1]!.trim(), match[2]!]
      } else {
        continue
      }
    }

    if (parts.length < 2) continue

    const valueStr = (parts.at(-1) ?? '').replaceAll(',', '')
    const value = Number.parseFloat(valueStr)
    if (Number.isNaN(value)) continue

    const name = parts.slice(0, -1).join(' ').trim()
    if (!name) continue

    results.push({ name, value })
  }

  return results
}
