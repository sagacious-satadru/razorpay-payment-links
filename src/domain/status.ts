import type { LinkStatus, PaymentLink, StatusFilter } from './types'

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`)
}

/** Derived: the sum of recorded payments. */
export function paidPaise(link: PaymentLink): number {
  return link.payments.reduce((sum, payment) => sum + payment.amountPaise, 0)
}

/** Derived: what is still owed. */
export function duePaise(link: PaymentLink): number {
  return link.amountPaise - paidPaise(link)
}

/**
 * The single place where status (including "expired") is computed. `now` is injected so this
 * stays pure. Order matters: paid > expired > partially_paid > active.
 */
export function getStatus(link: PaymentLink, now: number): LinkStatus {
  const paid = paidPaise(link)
  if (paid >= link.amountPaise) return 'paid' // fully paid links never expire
  if (link.expiresAt !== undefined && link.expiresAt <= now) return 'expired'
  if (paid > 0) return 'partially_paid'
  return 'active'
}

export function statusLabel(status: LinkStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'partially_paid':
      return 'Partially paid'
    case 'paid':
      return 'Paid'
    case 'expired':
      return 'Expired'
    default:
      return assertNever(status)
  }
}

/** Payments can be recorded on Active and Partially paid links only. */
export function canRecordPayment(status: LinkStatus): boolean {
  switch (status) {
    case 'active':
    case 'partially_paid':
      return true
    case 'paid':
    case 'expired':
      return false
    default:
      return assertNever(status)
  }
}

export function filterLabel(filter: StatusFilter): string {
  return filter === 'all' ? 'All' : statusLabel(filter)
}

export function filterLinks(links: PaymentLink[], filter: StatusFilter, now: number): PaymentLink[] {
  if (filter === 'all') return links
  return links.filter((link) => getStatus(link, now) === filter)
}

export function countByStatus(links: PaymentLink[], now: number): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: links.length,
    active: 0,
    partially_paid: 0,
    paid: 0,
    expired: 0,
  }
  for (const link of links) counts[getStatus(link, now)] += 1
  return counts
}
