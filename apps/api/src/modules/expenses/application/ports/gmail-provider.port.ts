import type { RawEmail } from '@workspace/domain'

export interface GmailProvider {
  listExpenseEmails(params: {
    userId: string
    query: string
    after?: string
    maxResults?: number
  }): Promise<{ id: string }[]>

  fetchEmailContent(params: {
    userId: string
    emailId: string
    category?: string
  }): Promise<RawEmail>

  fetchEmailContentBatch(params: {
    userId: string
    emailIds: string[]
    category?: string
  }): Promise<RawEmail[]>
}

export const GMAIL_PROVIDER = Symbol('GMAIL_PROVIDER')
