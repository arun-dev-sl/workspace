import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import type { LoginResponse, RegisterResponse } from '@/lib/api-types'

interface RegistrationOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON
}

interface AuthenticationOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON
}

function assertWebauthnAvailable() {
  if (globalThis.window === undefined) {
    throw new Error('Passkeys are only available in the browser')
  }

  if (!globalThis.isSecureContext) {
    throw new Error('Passkeys require a secure origin such as https or localhost')
  }

  if (!('PublicKeyCredential' in globalThis)) {
    throw new Error('This browser does not support passkeys')
  }
}

function toPasskeyErrorMessage(error: unknown, action: 'create' | 'use'): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      return action === 'create'
        ? 'Passkey creation was cancelled or timed out'
        : 'Passkey sign-in was cancelled or timed out'
    }

    if (error.name === 'InvalidStateError') {
      return action === 'create'
        ? 'This passkey is already registered for the current account'
        : 'This passkey cannot be used for the current account'
    }

    if (error.name === 'NotSupportedError') {
      return 'This device or browser does not support the requested passkey flow'
    }

    if (error.name === 'SecurityError') {
      return 'Passkeys require a secure origin and a matching relying party configuration'
    }

    return error.message
  }

  return action === 'create' ? 'Unable to create passkey' : 'Unable to sign in with passkey'
}

async function createPasskeyCredential(options: PublicKeyCredentialCreationOptionsJSON) {
  assertWebauthnAvailable()

  try {
    return await startRegistration({ optionsJSON: options })
  } catch (error) {
    toast.error(toPasskeyErrorMessage(error, 'create'))
    throw error
  }
}

async function createPasskeyAssertion(options: PublicKeyCredentialRequestOptionsJSON) {
  assertWebauthnAvailable()

  try {
    return await startAuthentication({ optionsJSON: options })
  } catch (error) {
    toast.error(toPasskeyErrorMessage(error, 'use'))
    throw error
  }
}

export async function registerWithPasskey(email: string, name?: string): Promise<RegisterResponse> {
  const { options } = await apiRequest<RegistrationOptionsResponse>({
    method: 'POST',
    url: '/api/auth/webauthn/register/options',
    data: { email, name },
    toastSuccess: false,
  })

  const credential = await createPasskeyCredential(options)

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

  const assertion = await createPasskeyAssertion(options)

  return apiRequest<LoginResponse>({
    method: 'POST',
    url: '/api/auth/webauthn/login/verify',
    data: { email, credential: assertion },
    toastSuccess: true,
    successMessage: 'Logged in with passkey',
  })
}
