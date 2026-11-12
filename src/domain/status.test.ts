import { makeLink, makePayment } from '../test/factories'
import {
  canRecordPayment,
  countByStatus,
  duePaise,
  filterLinks,
  getStatus,
  paidPaise,
  statusLabel,
} from './status'
import { LINK_STATUSES } from './types'
import type { LinkStatus, PaymentLink } from './types'

const NOW = 1_000_000
const FUTURE = NOW + 1000
const PAST = NOW - 1000

describe('paidPaise / duePaise (derived)', () => {
  it('sums payments and subtracts from the amount', () => {
    const link = makeLink({ amountPaise: 1000, payments: [makePayment(200), makePayment(300)] })
    expect(paidPaise(link)).toBe(500)
    expect(duePaise(link)).toBe(500)
  })
  it('is zero paid / full due with no payments', () => {
    const link = makeLink({ amountPaise: 1000 })
    expect(paidPaise(link)).toBe(0)
    expect(duePaise(link)).toBe(1000)
  })
})

describe('getStatus matrix (paid > expired > partially_paid > active)', () => {
  const full = [makePayment(1000)]
  const part = [makePayment(400)]

  const rows: Array<[string, Partial<PaymentLink>, LinkStatus]> = [
    ['nothing paid, no expiry', {}, 'active'],
    ['nothing paid, future expiry', { expiresAt: FUTURE }, 'active'],
    ['nothing paid, expiry exactly now (boundary)', { expiresAt: NOW }, 'expired'],
    ['nothing paid, past expiry', { expiresAt: PAST }, 'expired'],
    ['partly paid, no expiry', { payments: part }, 'partially_paid'],
    ['partly paid, future expiry', { payments: part, expiresAt: FUTURE }, 'partially_paid'],
    ['partly paid, past expiry -> Expired wins over Partially paid', { payments: part, expiresAt: PAST }, 'expired'],
    ['fully paid, no expiry', { payments: full }, 'paid'],
    ['fully paid, future expiry', { payments: full, expiresAt: FUTURE }, 'paid'],
    ['fully paid, past expiry -> Paid never expires', { payments: full, expiresAt: PAST }, 'paid'],
    ['fully paid, expiry exactly now', { payments: full, expiresAt: NOW }, 'paid'],
    ['paid in several instalments', { payments: [makePayment(400), makePayment(600)] }, 'paid'],
  ]

  it.each(rows)('%s', (_name, overrides, expected) => {
    expect(getStatus(makeLink(overrides), NOW)).toBe(expected)
  })
})

describe('canRecordPayment / statusLabel', () => {
  it('payments can be recorded only on active and partially paid links', () => {
    expect(canRecordPayment('active')).toBe(true)
    expect(canRecordPayment('partially_paid')).toBe(true)
    expect(canRecordPayment('paid')).toBe(false)
    expect(canRecordPayment('expired')).toBe(false)
  })
  it('labels every status', () => {
    expect(LINK_STATUSES.map(statusLabel)).toEqual(['Active', 'Partially paid', 'Paid', 'Expired'])
  })
})

describe('filterLinks / countByStatus', () => {
  const links = [
    makeLink({ id: 'a' }),
    makeLink({ id: 'b', payments: [makePayment(1000)] }),
    makeLink({ id: 'c', expiresAt: PAST }),
    makeLink({ id: 'd', payments: [makePayment(1)] }),
    makeLink({ id: 'e', payments: [makePayment(1)], expiresAt: PAST }),
  ]

  it('returns everything for "all"', () => {
    expect(filterLinks(links, 'all', NOW)).toHaveLength(5)
  })
  it('filters by derived status', () => {
    const ids = (f: Parameters<typeof filterLinks>[1]) => filterLinks(links, f, NOW).map((l) => l.id)
    expect(ids('active')).toEqual(['a'])
    expect(ids('partially_paid')).toEqual(['d'])
    expect(ids('paid')).toEqual(['b'])
    expect(ids('expired')).toEqual(['c', 'e'])
  })
  it('counts per status', () => {
    expect(countByStatus(links, NOW)).toEqual({
      all: 5,
      active: 1,
      partially_paid: 1,
      paid: 1,
      expired: 2,
    })
  })
})
