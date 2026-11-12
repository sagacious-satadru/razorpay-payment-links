import { canMarkPaid, countByStatus, filterLinks, getStatus, statusLabel } from './status'
import type { PaymentLink } from './types'

const NOW = 1_000_000

function link(overrides: Partial<PaymentLink> = {}): PaymentLink {
  return { id: 'x', amountPaise: 100, description: 'd', createdAt: 0, ...overrides }
}

describe('getStatus', () => {
  it('is active with no expiry', () => {
    expect(getStatus(link(), NOW)).toBe('active')
  })
  it('is active before the expiry', () => {
    expect(getStatus(link({ expiresAt: NOW + 1 }), NOW)).toBe('active')
  })
  it('is expired exactly at the expiry (boundary)', () => {
    expect(getStatus(link({ expiresAt: NOW }), NOW)).toBe('expired')
  })
  it('is expired after the expiry', () => {
    expect(getStatus(link({ expiresAt: NOW - 1 }), NOW)).toBe('expired')
  })
  it('is paid when paidAt is set', () => {
    expect(getStatus(link({ paidAt: 5 }), NOW)).toBe('paid')
  })
  it('stays paid after the expiry passes', () => {
    expect(getStatus(link({ paidAt: 5, expiresAt: NOW - 1000 }), NOW)).toBe('paid')
  })
})

describe('canMarkPaid / statusLabel', () => {
  it('only active links can be marked paid', () => {
    expect(canMarkPaid('active')).toBe(true)
    expect(canMarkPaid('paid')).toBe(false)
    expect(canMarkPaid('expired')).toBe(false)
  })
  it('labels each status', () => {
    expect(['active', 'paid', 'expired'].map((s) => statusLabel(s as 'active'))).toEqual([
      'Active',
      'Paid',
      'Expired',
    ])
  })
})

describe('filterLinks / countByStatus', () => {
  const links = [
    link({ id: 'a' }),
    link({ id: 'b', paidAt: 1 }),
    link({ id: 'c', expiresAt: NOW - 1 }),
    link({ id: 'd' }),
  ]

  it('returns everything for "all"', () => {
    expect(filterLinks(links, 'all', NOW)).toHaveLength(4)
  })
  it('filters by derived status', () => {
    expect(filterLinks(links, 'active', NOW).map((l) => l.id)).toEqual(['a', 'd'])
    expect(filterLinks(links, 'paid', NOW).map((l) => l.id)).toEqual(['b'])
    expect(filterLinks(links, 'expired', NOW).map((l) => l.id)).toEqual(['c'])
  })
  it('counts per status', () => {
    expect(countByStatus(links, NOW)).toEqual({ all: 4, active: 2, paid: 1, expired: 1 })
  })
})
