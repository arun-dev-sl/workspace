import type { AuthenticatorDeviceType } from '@simplewebauthn/types'

interface WebauthnCredentialProps {
  id: string
  userId: string
  credentialId: string
  publicKey: string
  counter: number
  transports: string[] | null
  deviceType: AuthenticatorDeviceType | null
  backedUp: boolean
  aaguid: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * WebAuthn Credential DTO
 */
export class WebauthnCredentialDto {
  id: string
  userId: string
  credentialId: string
  publicKey: string
  counter: number
  transports: string[] | null
  deviceType: AuthenticatorDeviceType | null
  backedUp: boolean
  aaguid: string | null
  createdAt: Date
  updatedAt: Date

  constructor(props: WebauthnCredentialProps) {
    this.id = props.id
    this.userId = props.userId
    this.credentialId = props.credentialId
    this.publicKey = props.publicKey
    this.counter = props.counter
    this.transports = props.transports
    this.deviceType = props.deviceType
    this.backedUp = props.backedUp
    this.aaguid = props.aaguid
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }
}
