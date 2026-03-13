import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google } from 'googleapis'

import { AUTH_IDENTITY_REPOSITORY } from '@/modules/auth/application/ports/auth-identity.repository.port'

import type { Env } from '@/app/config/env.schema'
import type { AuthIdentityRepository } from '@/modules/auth/application/ports/auth-identity.repository.port'
import type { GmailProvider } from '@/shared/application/ports/gmail-provider.port'
import type { RawEmail } from '@workspace/domain'
import type { gmail_v1 } from 'googleapis'

@Injectable()
export class GoogleApisGmailProvider implements GmailProvider {
  private readonly gmail = google.gmail('v1')
  private readonly logger = new Logger(GoogleApisGmailProvider.name)

  constructor(
    @Inject(AUTH_IDENTITY_REPOSITORY)
    private readonly authIdentityRepo: AuthIdentityRepository,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async listExpenseEmails(params: {
    userId: string
    query: string
    after?: string
    maxResults?: number
  }): Promise<{ id: string }[]> {
    const oauth2Client = await this.getOAuthClient(params.userId)
    const allMessages: { id: string }[] = []
    let pageToken: string | undefined = params.after
    const maxResultsPerPage = 500 // Gmail API limit
    const totalMaxResults = params.maxResults ?? 1000 // Default to 1000 emails

    // Fetch all pages until we have enough results or no more pages
    while (allMessages.length < totalMaxResults) {
      const res = await this.gmail.users.messages.list({
        auth: oauth2Client,
        userId: 'me',
        q: params.query,
        maxResults: Math.min(maxResultsPerPage, totalMaxResults - allMessages.length),
        pageToken,
      })

      console.log(`Gmail API response: listExpenseEmails (page ${pageToken ?? 'first'})`, {
        messagesCount: res.data.messages?.length ?? 0,
        nextPageToken: res.data.nextPageToken,
        resultSizeEstimate: res.data.resultSizeEstimate,
      })

      const messages = (res.data.messages ?? [])
        .filter((message): message is { id: string } => Boolean(message?.id))
        .map((message) => ({ id: message.id }))

      allMessages.push(...messages)

      // If no more pages or we've reached the limit, stop
      if (!res.data.nextPageToken || allMessages.length >= totalMaxResults) {
        break
      }

      pageToken = res.data.nextPageToken
    }

    console.log(`Gmail API: Fetched total of ${allMessages.length} email references`)

    return allMessages
  }

  async fetchEmailContent(params: {
    userId: string
    emailId: string
    category?: string
  }): Promise<RawEmail> {
    const oauth2Client = await this.getOAuthClient(params.userId)
    const res = await this.gmail.users.messages.get({
      auth: oauth2Client,
      userId: 'me',
      id: params.emailId,
      format: 'full',
    })

    const payload = res.data.payload
    const headers = this.headersToRecord(payload?.headers ?? [])
    const bodyText = this.extractBody(payload, 'text/plain') ?? ''
    const bodyHtml = this.extractBody(payload, 'text/html') ?? undefined

    console.log('Gmail API response: fetchEmailContent', res.data)

    // Parse received date: use internalDate (epoch ms) if available, else parse Date header
    let receivedAt: string
    if (res.data.internalDate) {
      // Gmail's internalDate is in milliseconds since epoch
      receivedAt = new Date(Number(res.data.internalDate)).toISOString()
    } else if (headers.date) {
      // Fallback to Date header (RFC 2822 format)
      receivedAt = new Date(headers.date).toISOString()
    } else {
      // Last resort fallback
      receivedAt = new Date().toISOString()
    }

    return {
      id: randomUUID(),
      userId: params.userId,
      provider: 'gmail',
      providerMessageId: params.emailId,
      from: headers.from ?? '',
      subject: headers.subject ?? '',
      snippet: res.data.snippet ?? '',
      receivedAt,
      bodyText,
      bodyHtml,
      rawHeaders: headers,
      category: params.category ?? 'expenses',
    }
  }

  /**
     * Fetch multiple emails in batch to reduce API calls
     * Processes emails in chunks to avoid memory issues and rate limits
     */
  async fetchEmailContentBatch(params: {
    userId: string
    emailIds: string[]
    category?: string
  }): Promise<RawEmail[]> {
    const CHUNK_SIZE = 100 // Gmail API batch limit is 100 requests per batch
    const results: RawEmail[] = []

    // Process emails in chunks
    for (let i = 0; i < params.emailIds.length; i += CHUNK_SIZE) {
      const chunk = params.emailIds.slice(i, i + CHUNK_SIZE)
      this.logger.debug(
        `Fetching email batch ${i / CHUNK_SIZE + 1}: ${chunk.length} emails (${i + 1}-${i + chunk.length} of ${params.emailIds.length})`,
      )

      // Use Promise.all for concurrent fetches within a reasonable chunk size
      // This is more reliable than Gmail's batch API which can be flaky
      const chunkResults = await Promise.allSettled(
        chunk.map((emailId) => this.fetchEmailContent({
          userId: params.userId,
          emailId,
          category: params.category,
        })),
      )

      // Collect successful results and log failures
      for (const [j, result] of chunkResults.entries()) {
        if (!result) continue

        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          this.logger.warn(
            `Failed to fetch email ${chunk[j]} in batch: ${result.reason}`,
          )
        }
      }

      // Add small delay between chunks to avoid rate limiting
      if (i + CHUNK_SIZE < params.emailIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    this.logger.log(
      `Batch fetch completed: ${results.length} successful out of ${params.emailIds.length} total`,
    )

    return results
  }

  private headersToRecord(headers: { name?: string | null, value?: string | null }[]) {
    const record: Record<string, string> = {}
    for (const header of headers) {
      if (header.name && header.value) {
        record[header.name.toLowerCase()] = header.value
      }
    }
    return record
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined, mimeType: string): string | null {
    if (!payload) {
      return null
    }

    if (payload.mimeType === mimeType && payload.body?.data) {
      return this.decodeBase64Url(payload.body.data)
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const found = this.extractBody(part, mimeType)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  private decodeBase64Url(data: string): string {
    const normalized = data.replaceAll('-', '+').replaceAll('_', '/')
    const buffer = Buffer.from(normalized, 'base64')
    return buffer.toString('utf8')
  }

  private async getOAuthClient(userId: string) {
    const identity = await this.authIdentityRepo.findByUserIdAndProvider(userId, 'google')
    if (!identity?.refreshToken) {
      throw new Error('Gmail account not connected')
    }

    this.logger.debug(`Checking Gmail scopes for user ${userId}`, {
      storedScope: identity.scope,
      hasGmailScope: this.hasGmailScope(identity.scope),
    })

    if (!this.hasGmailScope(identity.scope)) {
      throw new Error('Gmail scopes missing. Please reconnect Gmail with mail access.')
    }

    const clientId = this.configService.get('GMAIL_CLIENT_ID', { infer: true })
    const clientSecret = this.configService.get('GMAIL_CLIENT_SECRET', { infer: true })
    const redirectUri = this.configService.get('GMAIL_REDIRECT_URI', { infer: true })

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Gmail OAuth configuration')
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    oauth2Client.setCredentials({
      refresh_token: identity.refreshToken,
      access_token: identity.accessToken ?? undefined,
      expiry_date: identity.accessTokenExpiresAt?.getTime(),
    })

    return oauth2Client
  }

  private hasGmailScope(scope: string | null): boolean {
    if (!scope) {
      return false
    }

    // Check for gmail.readonly scope - handle both full URL and short form
    const scopes = scope.split(/\s+/)
    return scopes.some(
      (s) =>
        s === 'https://www.googleapis.com/auth/gmail.readonly'
        || s === 'gmail.readonly'
        || s.includes('gmail.readonly'),
    )
  }
}
