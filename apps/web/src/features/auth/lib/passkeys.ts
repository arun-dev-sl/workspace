import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types'

import { apiRequest } from '@/lib/api-client'
import type { LoginResponse, RegisterResponse } from '@/lib/api-types'

interface RegistrationOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON
}

interface AuthenticationOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON
}

export async function registerWithPasskey(email: string, name?: string): Promise<RegisterResponse> {
  const { options } = await apiRequest<RegistrationOptionsResponse>({
    method: 'POST',
    url: '/api/auth/webauthn/register/options',
    data: { email, name },
    toastSuccess: false,
  })

  const credential = await startRegistration(options)

  return apiRequest<RegisterResponse>({
    method: 'POST',
    url: '/api/auth/webauthn/register/verify',
    data: { email, credential },
    toastSuccess: true,
    successMessage: 'Passkey created',
  })
}

export async function loginWithPasskey(email: string): Promise<LoginResponse> {
  const { options } = await apiRequest<AuthenticationOptionsResponse>({
    method: 'POST',
    url: '/api/auth/webauthn/login/options',
    data: { email },
    toastSuccess: false,
  })

  const assertion = await startAuthentication(options)

  return apiRequest<LoginResponse>({
    method: 'POST',
    url: '/api/auth/webauthn/login/verify',
    data: { email, credential: assertion },
    toastSuccess: true,
    successMessage: 'Logged in with passkey',
  })
}
