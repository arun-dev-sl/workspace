import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof LoginSchema>

export const RegisterSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
})

export type RegisterInput = z.infer<typeof RegisterSchema>

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
})

export type LogoutInput = z.infer<typeof LogoutSchema>

export const RevokeSessionSchema = z.object({
  sessionId: z.string().min(1),
})

export type RevokeSessionInput = z.infer<typeof RevokeSessionSchema>

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
