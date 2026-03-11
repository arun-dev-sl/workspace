import type { HotelStay } from '@workspace/domain'

export interface HotelStayRepository {
  create(stay: HotelStay): Promise<HotelStay>
  update(stay: HotelStay): Promise<HotelStay>
  upsertExtracted(stay: HotelStay): Promise<HotelStay>
  listByUser(params: {
    userId: string
    limit: number
    offset: number
    includeArchived?: boolean
  }): Promise<HotelStay[]>
  countByUser(userId: string, includeArchived?: boolean): Promise<number>
  findById(params: { userId: string, id: string }): Promise<HotelStay | null>
  archive(params: { userId: string, id: string, archivedAt: Date }): Promise<HotelStay | null>
  unarchive(params: { userId: string, id: string }): Promise<HotelStay | null>
  delete(params: { userId: string, id: string }): Promise<void>
}

export const HOTEL_STAY_REPOSITORY = Symbol('HOTEL_STAY_REPOSITORY')
