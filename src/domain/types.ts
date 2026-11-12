export const LINK_STATUSES = ['active', 'paid', 'expired'] as const

export type LinkStatus = (typeof LINK_STATUSES)[number]

export type StatusFilter = 'all' | LinkStatus

/** All times are epoch milliseconds. Money is integer paise. */
export interface PaymentLink {
  id: string
  amountPaise: number
  description: string
  email?: string
  phone?: string
  createdAt: number
  expiresAt?: number
  paidAt?: number
}

export interface NewLinkInput {
  amountPaise: number
  description: string
  email?: string
  phone?: string
  expiresAt?: number
}
