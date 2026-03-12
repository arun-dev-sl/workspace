import { z } from 'zod'

export const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isCompleted: z.boolean().optional().default(false),
})

export type CreateTodoInput = z.infer<typeof CreateTodoSchema>

export const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isCompleted: z.boolean().optional(),
})

export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>
