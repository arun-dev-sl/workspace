import type { FlightActivity } from '@workspace/domain'

export interface FlightActivityRepository {
  upsertMany(activities: FlightActivity[]): Promise<void>
  update(activity: FlightActivity): Promise<FlightActivity>
  listAllByUser(userId: string): Promise<FlightActivity[]>
  listByUser(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<FlightActivity[]>
  listBySourceEmailId(params: {
    userId: string
    sourceEmailId: string
  }): Promise<FlightActivity[]>
  countByUser(userId: string): Promise<number>
  listByUserCursor(params: {
    userId: string
    pageSize: number
    cursor?: string
  }): Promise<{ data: FlightActivity[], nextCursor?: string, hasMore: boolean }>
  findById(params: { userId: string, id: string }): Promise<FlightActivity | null>
}

export const FLIGHT_ACTIVITY_REPOSITORY = Symbol('FLIGHT_ACTIVITY_REPOSITORY')
