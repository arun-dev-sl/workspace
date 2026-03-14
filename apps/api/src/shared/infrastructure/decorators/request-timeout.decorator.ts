import { SetMetadata } from '@nestjs/common'

export const REQUEST_TIMEOUT_KEY = 'request_timeout_ms'

export const RequestTimeout = (timeoutMs: number | null) => SetMetadata(REQUEST_TIMEOUT_KEY, timeoutMs)
