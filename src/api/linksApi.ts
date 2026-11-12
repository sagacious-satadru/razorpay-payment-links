import { checkPaymentAmount } from '../domain/payments'
import type { NewLinkInput, PaymentLink } from '../domain/types'
import { getBrowserStorage, readLinks, writeLinks } from './storage'

/** The only surface the UI talks to; a real backend can implement the same interface. */
export interface LinksApi {
  listLinks(): Promise<PaymentLink[]>
  createLink(input: NewLinkInput): Promise<PaymentLink>
  recordPayment(id: string, amountPaise: number): Promise<PaymentLink>
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
  /** Initial data. When omitted, links are loaded from `storage`. */
  seed?: PaymentLink[]
  /** Where to persist links after every change (and load them from on start). Default: none. */
  storage?: Storage | null
}

export class ApiError extends Error {}

const NETWORK_MESSAGE = 'Something went wrong while contacting the server. Please try again.'

export function createLinksApi(
  options: CreateLinksApiOptions = {},
): LinksApi & FailureControl {
  const { delayMs = 300, now = Date.now, seed, storage = null } = options
  let links: PaymentLink[] = [...(seed ?? readLinks(storage))].sort((a, b) => b.createdAt - a.createdAt)
  // Random UUIDs stay unique across reloads, tabs and frozen clocks, with no ordering assumptions.
  const newId = () => crypto.randomUUID()
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
        const link: PaymentLink = {
          ...input,
          id: newId(),
          createdAt: now(),
          payments: [],
        }
        links = [link, ...links]
        writeLinks(storage, links)
        return { ...link }
      }),

    recordPayment: (id, amountPaise) =>
      simulate(() => {
        const link = links.find((candidate) => candidate.id === id)
        if (!link) throw new ApiError('Payment link not found.')
        const error = checkPaymentAmount(link, amountPaise, now())
        if (error) throw new ApiError(error)
        // Replace (never mutate) the payments array so earlier copies stay unchanged.
        link.payments = [
          ...link.payments,
          { id: newId(), amountPaise, at: now() },
        ]
        writeLinks(storage, links)
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

export const defaultLinksApi: LinksApi = createLinksApi({ delayMs: 300, storage: getBrowserStorage() })
