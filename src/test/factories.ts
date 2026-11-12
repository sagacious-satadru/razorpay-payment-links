import type { Payment, PaymentLink } from '../domain/types'

export function makeLink(overrides: Partial<PaymentLink> = {}): PaymentLink {
  return {
    id: 'link_1',
    amountPaise: 1000,
    description: 'Test link',
    createdAt: 0,
    allowPartial: false,
    payments: [],
    ...overrides,
  }
}

export function makePayment(amountPaise: number, at = 1, id = `pay_${amountPaise}_${at}`): Payment {
  return { id, amountPaise, at }
}
