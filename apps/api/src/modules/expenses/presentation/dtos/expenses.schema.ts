import { z } from 'zod'

import { CursorPaginationSchema, OffsetPaginationSchema } from '@/shared/infrastructure/dtos/pagination.schema'

export const SyncExpensesSchema = z.object({
  query: z.string().optional(),
  after: z.string().optional(),
  fromDate: z.string().optional(),
})

export type SyncExpensesInput = z.infer<typeof SyncExpensesSchema>

export const ListExpensesSchema = OffsetPaginationSchema.extend({
  category: z.string().optional(),
  mode: z.string().optional(),
  review: z.string().optional(),
  card: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
})

export type ListExpensesInput = z.infer<typeof ListExpensesSchema>

export const ListExpenseEmailsSchema = OffsetPaginationSchema

export type ListExpenseEmailsInput = z.infer<typeof ListExpenseEmailsSchema>

export const UpdateTransactionSchema = z.object({
  merchant: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  requiresReview: z.boolean().optional(),
  categoryMetadata: z.object({
    icon: z.string(),
    color: z.string(),
    parent: z.string().nullable(),
  }).optional(),
})

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>

export const BulkUpdateFieldsSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  requiresReview: z.boolean().optional(),
  categoryMetadata: z.object({
    icon: z.string(),
    color: z.string(),
    parent: z.string().nullable(),
  }).optional(),
})

export const BulkUpdateTransactionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  fields: BulkUpdateFieldsSchema,
})

export type BulkUpdateTransactionsInput = z.infer<typeof BulkUpdateTransactionsSchema>

export const BulkCategorizeSchema = z.object({
  merchantRaw: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  categoryMetadata: z.object({
    icon: z.string(),
    color: z.string(),
    parent: z.string().nullable(),
  }),
})

export type BulkCategorizeInput = z.infer<typeof BulkCategorizeSchema>

const expenseFilterFields = {
  category: z.string().optional(),
  mode: z.string().optional(),
  review: z.string().optional(),
  card: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
}

export const ListExpensesCursorSchema = CursorPaginationSchema.extend(expenseFilterFields)

export type ListExpensesCursorInput = z.infer<typeof ListExpensesCursorSchema>
