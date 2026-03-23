import { startRegistration } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'

export interface AccountPasskey {
  id: string
  credentialId: string
  transports: string[] | null
  deviceType: string | null
  backedUp: boolean
  aaguid: string | null
  createdAt: string
  updatedAt: string
}

interface AccountPasskeysResponse {
  credentials: AccountPasskey[]
}

interface RegistrationOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON
}

function assertPasskeySupported() {
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

export async function listAccountPasskeys(): Promise<AccountPasskey[]> {
  const response = await apiRequest<AccountPasskeysResponse>({
    method: 'GET',
    url: '/api/auth/account/passkeys',
    toastError: false,
  })

  return response.credentials
}

export async function registerAccountPasskey(): Promise<AccountPasskey[]> {
  assertPasskeySupported()

  const { options } = await apiRequest<RegistrationOptionsResponse>({
    method: 'POST',
    url: '/api/auth/account/passkeys/register/options',
    toastError: false,
  })

  try {
    const credential = await startRegistration({ optionsJSON: options })

    const response = await apiRequest<AccountPasskeysResponse>({
      method: 'POST',
      url: '/api/auth/account/passkeys/register/verify',
      data: { credential },
      toastSuccess: true,
      successMessage: 'Passkey registered',
    })

    return response.credentials
  } catch (error) {
    if (error instanceof Error) {
      toast.error(error.message)
    }
    throw error
  }
}