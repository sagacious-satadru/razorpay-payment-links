import { checkPaymentAmount } from '../domain/payments'
import type { NewLinkInput, PaymentLink } from '../domain/types'

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
        const link: PaymentLink = {
          ...input,
          id: `plink_${sequence}`,
          createdAt: now(),
          payments: [],
        }
        links = [link, ...links]
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
          { id: `${link.id}_pay_${link.payments.length + 1}`, amountPaise, at: now() },
        ]
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
