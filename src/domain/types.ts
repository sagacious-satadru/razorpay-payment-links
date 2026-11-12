export const LINK_STATUSES = ['active', 'partially_paid', 'paid', 'expired'] as const

export type LinkStatus = (typeof LINK_STATUSES)[number]

export type StatusFilter = 'all' | LinkStatus

export interface Payment {
  id: string
  amountPaise: number
  /** epoch ms */
  at: number
}

/**
 * All times are epoch milliseconds. Money is integer paise.
 * Amount paid / due are derived from `payments` (see status.ts), never stored.
 */
export interface PaymentLink {
  id: string
  amountPaise: number
  description: string
  email?: string
  phone?: string
  createdAt: number
  expiresAt?: number
  allowPartial: boolean
  /** Only meaningful when `allowPartial` is true. */
  minFirstPaymentPaise?: number
  payments: Payment[]
}

export interface NewLinkInput {
  amountPaise: number
  description: string
  email?: string
  phone?: string
  expiresAt?: number
  allowPartial: boolean
  minFirstPaymentPaise?: number
}
