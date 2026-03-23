import { Injectable } from '@nestjs/common'

type PlatformRole = 'broker' | 'retirement-account' | 'registrar' | 'investment-platform'
type EntityCategory = 'platform' | 'asset-type' | 'airline' | 'hotel-chain' | 'hotel-brand' | 'issuer' | 'unknown'

type NormalizedEntity = {
  original: string
  normalized: string
  canonical: string
  category: EntityCategory
  role?: PlatformRole
  matchedAlias?: string
}

const PLATFORM_MAP = {
  groww: { canonical: 'Groww', role: 'broker' },
  zerodha: { canonical: 'Zerodha', role: 'broker' },
  kite: { canonical: 'Zerodha', role: 'broker' },
  upstox: { canonical: 'Upstox', role: 'broker' },
  'angel one': { canonical: 'Angel One', role: 'broker' },
  angelone: { canonical: 'Angel One', role: 'broker' },
  fyers: { canonical: 'Fyers', role: 'broker' },
  '5paisa': { canonical: '5paisa', role: 'broker' },
  'paytm money': { canonical: 'Paytm Money', role: 'broker' },
  'icici direct': { canonical: 'ICICI Direct', role: 'broker' },
  'kotak securities': { canonical: 'Kotak Securities', role: 'broker' },
  sharekhan: { canonical: 'Sharekhan', role: 'broker' },
  mstock: { canonical: 'm.Stock', role: 'broker' },
  epfo: { canonical: 'EPFO', role: 'retirement-account' },
  ppf: { canonical: 'PPF', role: 'retirement-account' },
  nps: { canonical: 'NPS', role: 'retirement-account' },
  cams: { canonical: 'CAMS', role: 'registrar' },
  kfintech: { canonical: 'KFintech', role: 'registrar' },
} as const

const ASSET_TYPE_MAP = {
  stock: { canonical: 'Stocks', category: 'equity' },
  mutual_fund: { canonical: 'Mutual Funds', category: 'fund' },
  etf: { canonical: 'ETFs', category: 'fund' },
  gold: { canonical: 'Gold', category: 'commodity' },
  pf: { canonical: 'Provident Fund', category: 'retirement' },
} as const

const AIRLINE_MAP = {
  indigo: 'IndiGo',
  'air india': 'Air India',
  vistara: 'Vistara',
  spicejet: 'SpiceJet',
  akasa: 'Akasa Air',
  emirates: 'Emirates',
  lufthansa: 'Lufthansa',
  singaporeair: 'Singapore Airlines',
  'singapore airlines': 'Singapore Airlines',
} as const

const HOTEL_BRAND_MAP = {
  marriott: 'Marriott',
  sheraton: 'Marriott',
  westin: 'Marriott',
  hyatt: 'Hyatt',
  taj: 'Taj Hotels',
  vivanta: 'Taj Hotels',
  ginger: 'IHCL Ginger',
  oberoi: 'Oberoi',
  trident: 'Oberoi',
  radisson: 'Radisson',
  novotel: 'Accor',
  ibis: 'Accor',
  leela: 'The Leela',
} as const

@Injectable()
export class AiDomainIntelligenceService {
  normalizePlatform(platform: string): NormalizedEntity {
    const normalized = this.normalizeToken(platform)
    const exact = PLATFORM_MAP[normalized as keyof typeof PLATFORM_MAP]

    if (exact) {
      return {
        original: platform,
        normalized,
        canonical: exact.canonical,
        category: 'platform',
        role: exact.role,
        matchedAlias: normalized,
      }
    }

    const matched = Object.entries(PLATFORM_MAP).find(([alias]) => normalized.includes(alias))
    if (matched) {
      return {
        original: platform,
        normalized,
        canonical: matched[1].canonical,
        category: 'platform',
        role: matched[1].role,
        matchedAlias: matched[0],
      }
    }

    return {
      original: platform,
      normalized,
      canonical: this.toTitleCase(platform),
      category: 'platform',
      role: 'investment-platform',
    }
  }

  normalizeAssetType(assetType: string): NormalizedEntity & { bucket: string } {
    const normalized = this.normalizeToken(assetType)
    const mapped = ASSET_TYPE_MAP[normalized as keyof typeof ASSET_TYPE_MAP]

    if (mapped) {
      return {
        original: assetType,
        normalized,
        canonical: mapped.canonical,
        category: 'asset-type',
        bucket: mapped.category,
      }
    }

    return {
      original: assetType,
      normalized,
      canonical: this.toTitleCase(assetType.replace(/_/g, ' ')),
      category: 'asset-type',
      bucket: 'other',
    }
  }

  normalizeAirline(airline: string): NormalizedEntity {
    const normalized = this.normalizeToken(airline)
    const canonical = AIRLINE_MAP[normalized as keyof typeof AIRLINE_MAP]

    if (canonical) {
      return {
        original: airline,
        normalized,
        canonical,
        category: 'airline',
        matchedAlias: normalized,
      }
    }

    return {
      original: airline,
      normalized,
      canonical: this.toTitleCase(airline),
      category: 'airline',
    }
  }

  normalizeHotelProvider(hotelName: string): NormalizedEntity {
    const normalized = this.normalizeToken(hotelName)
    const matched = Object.entries(HOTEL_BRAND_MAP).find(([alias]) => normalized.includes(alias))

    if (matched) {
      return {
        original: hotelName,
        normalized,
        canonical: matched[1],
        category: 'hotel-brand',
        matchedAlias: matched[0],
      }
    }

    return {
      original: hotelName,
      normalized,
      canonical: this.toTitleCase(hotelName),
      category: 'hotel-chain',
    }
  }

  normalizeIssuer(name: string): NormalizedEntity {
    return {
      original: name,
      normalized: this.normalizeToken(name),
      canonical: this.toTitleCase(name),
      category: 'issuer',
    }
  }

  private normalizeToken(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  }

  private toTitleCase(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }
}
