import type { LinkStatus, PaymentLink, StatusFilter } from './types'

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`)
}

/** The single place where "expired" is computed. `now` is injected so this stays pure. */
export function getStatus(link: PaymentLink, now: number): LinkStatus {
  if (link.paidAt !== undefined) return 'paid' // Paid is terminal, even after expiry passes
  if (link.expiresAt !== undefined && link.expiresAt <= now) return 'expired'
  return 'active'
}

export function statusLabel(status: LinkStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'paid':
      return 'Paid'
    case 'expired':
      return 'Expired'
    default:
      return assertNever(status)
  }
}

/** Only active links can be marked as paid. */
export function canMarkPaid(status: LinkStatus): boolean {
  switch (status) {
    case 'active':
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
  const counts: Record<StatusFilter, number> = { all: links.length, active: 0, paid: 0, expired: 0 }
  for (const link of links) counts[getStatus(link, now)] += 1
  return counts
}
