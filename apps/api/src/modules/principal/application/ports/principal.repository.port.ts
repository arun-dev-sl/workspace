import type { PrincipalContribution, PrincipalDistribution } from '@workspace/database'

export interface PrincipalRepositoryPort {
  findContributionsByUserId(userId: string): Promise<PrincipalContribution[]>
  findDistributionByUserId(userId: string): Promise<PrincipalDistribution[]>

  upsertContributions(
    userId: string,
    entries: {
      month: string
      year: number
      label: string
      amountLakhs: string
    }[],
  ): Promise<{ imported: number, updated: number }>

  upsertDistribution(
    userId: string,
    entries: {
      name: string
      value: string
    }[],
  ): Promise<{ imported: number, updated: number }>

  /** Create a single contribution row. Returns the created record. */
  createContribution(
    userId: string,
    entry: { month: string, year: number, label: string, amountLakhs: string },
  ): Promise<PrincipalContribution>

  /** Update a single contribution by id (must belong to userId). */
  updateContribution(
    id: string,
    userId: string,
    data: { month?: string, year?: number, label?: string, amountLakhs?: string },
  ): Promise<PrincipalContribution | null>

  /** Delete a single contribution by id (must belong to userId). */
  deleteContribution(id: string, userId: string): Promise<boolean>

  /** Create a single distribution row. Returns the created record. */
  createDistribution(
    userId: string,
    entry: { name: string, value: string },
  ): Promise<PrincipalDistribution>

  /** Update a single distribution by id (must belong to userId). */
  updateDistribution(
    id: string,
    userId: string,
    data: { name?: string, value?: string },
  ): Promise<PrincipalDistribution | null>

  /** Delete a single distribution by id (must belong to userId). */
  deleteDistribution(id: string, userId: string): Promise<boolean>

  deleteAllContributions(userId: string): Promise<void>
  deleteAllDistribution(userId: string): Promise<void>
}

export const PRINCIPAL_REPOSITORY = Symbol('PRINCIPAL_REPOSITORY')
