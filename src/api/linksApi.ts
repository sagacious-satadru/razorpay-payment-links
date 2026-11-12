import { canMarkPaid, getStatus } from '../domain/status'
import type { NewLinkInput, PaymentLink } from '../domain/types'

/** The only surface the UI talks to; a real backend can implement the same interface. */
export interface LinksApi {
  listLinks(): Promise<PaymentLink[]>
  createLink(input: NewLinkInput): Promise<PaymentLink>
  markPaid(id: string): Promise<PaymentLink>
}

export interface FailureControl {
  /** Make the next `count` calls (any method) reject. */
  failNext(count?: number): void
  /** Make every call reject until switched off. */
  setFailAll(fail: boolean): void
}

export interface CreateLinksApiOptions {
  delayMs?: number
  now?: () => number
  seed?: PaymentLink[]
}

export class ApiError extends Error {}

const NETWORK_MESSAGE = 'Something went wrong while contacting the server. Please try again.'

export function createLinksApi(
  options: CreateLinksApiOptions = {},
): LinksApi & FailureControl {
  const { delayMs = 300, now = Date.now, seed = [] } = options
  let links: PaymentLink[] = [...seed].sort((a, b) => b.createdAt - a.createdAt)
  let sequence = seed.length
  let failuresLeft = 0
  let failAll = false

  async function simulate<T>(work: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (failAll || failuresLeft > 0) {
      if (failuresLeft > 0) failuresLeft -= 1
      throw new ApiError(NETWORK_MESSAGE)
    }
    return work()
  }

  return {
    listLinks: () => simulate(() => links.map((link) => ({ ...link }))),

    createLink: (input) =>
      simulate(() => {
        sequence += 1
        const link: PaymentLink = { ...input, id: `plink_${sequence}`, createdAt: now() }
        links = [link, ...links]
        return { ...link }
      }),

    markPaid: (id) =>
      simulate(() => {
        const link = links.find((candidate) => candidate.id === id)
        if (!link) throw new ApiError('Payment link not found.')
        const status = getStatus(link, now())
        if (!canMarkPaid(status)) {
          throw new ApiError(
            status === 'expired'
              ? 'This link has expired and cannot be marked as paid.'
              : 'This link is already paid.',
          )
        }
        link.paidAt = now()
        return { ...link }
      }),

    failNext: (count = 1) => {
      failuresLeft = count
    },
    setFailAll: (fail) => {
      failAll = fail
    },
  }
}

export const defaultLinksApi: LinksApi = createLinksApi({ delayMs: 300 })
