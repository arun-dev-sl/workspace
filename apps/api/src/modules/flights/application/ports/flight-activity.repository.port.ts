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
  findById(params: { userId: string, id: string }): Promise<FlightActivity | null>
}

export const FLIGHT_ACTIVITY_REPOSITORY = Symbol('FLIGHT_ACTIVITY_REPOSITORY')
