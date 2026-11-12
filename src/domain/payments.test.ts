import { makeLink, makePayment } from '../test/factories'
import { checkPaymentAmount, validateRecordPayment } from './payments'

const NOW = 1_000_000

/** Amount 1000 paise (₹10.00), partial allowed with a ₹3.00 minimum first payment. */
const partialLink = makeLink({ amountPaise: 1000, allowPartial: true, minFirstPaymentPaise: 300 })
const fullOnlyLink = makeLink({ amountPaise: 1000, allowPartial: false })

describe('checkPaymentAmount', () => {
  it('rejects zero and negative amounts', () => {
    expect(checkPaymentAmount(partialLink, 0, NOW)).toMatch(/greater than/)
    expect(checkPaymentAmount(partialLink, -5, NOW)).toMatch(/greater than/)
  })

  it('rejects more than the amount due', () => {
    expect(checkPaymentAmount(partialLink, 1001, NOW)).toMatch(/cannot exceed the amount due/)
    const half = makeLink({ ...partialLink, payments: [makePayment(600)] })
    expect(checkPaymentAmount(half, 401, NOW)).toMatch(/₹4\.00/)
  })

  it('accepts exactly the due amount', () => {
    expect(checkPaymentAmount(partialLink, 1000, NOW)).toBeNull()
  })

  describe('when partial payments are not allowed', () => {
    it('requires the full due in one payment', () => {
      expect(checkPaymentAmount(fullOnlyLink, 500, NOW)).toMatch(/does not allow partial/)
      expect(checkPaymentAmount(fullOnlyLink, 1000, NOW)).toBeNull()
    })
  })

  describe('when partial payments are allowed', () => {
    it('enforces the minimum on the first payment', () => {
      expect(checkPaymentAmount(partialLink, 299, NOW)).toMatch(/at least ₹3\.00/)
      expect(checkPaymentAmount(partialLink, 300, NOW)).toBeNull()
    })

    it('allows any amount > 0 and <= due after the first payment', () => {
      const started = makeLink({ ...partialLink, payments: [makePayment(300)] })
      expect(checkPaymentAmount(started, 1, NOW)).toBeNull()
      expect(checkPaymentAmount(started, 700, NOW)).toBeNull()
      expect(checkPaymentAmount(started, 701, NOW)).toMatch(/cannot exceed/)
    })
  })

  it('rejects payments on paid links', () => {
    const paid = makeLink({ ...partialLink, payments: [makePayment(1000)] })
    expect(checkPaymentAmount(paid, 1, NOW)).toMatch(/active or partially paid/)
  })

  it('rejects payments on expired links, including partly paid ones', () => {
    const expired = makeLink({ ...partialLink, expiresAt: NOW })
    expect(checkPaymentAmount(expired, 500, NOW)).toMatch(/active or partially paid/)
    const partlyExpired = makeLink({ ...partialLink, payments: [makePayment(300)], expiresAt: NOW - 1 })
    expect(checkPaymentAmount(partlyExpired, 100, NOW)).toMatch(/active or partially paid/)
  })
})

describe('validateRecordPayment (raw text)', () => {
  it('parses rupees to paise and applies the rules', () => {
    expect(validateRecordPayment('3.50', partialLink, NOW)).toEqual({ ok: true, amountPaise: 350 })
    expect(validateRecordPayment(' 10 ', partialLink, NOW)).toEqual({ ok: true, amountPaise: 1000 })
  })

  it.each([
    ['', /Enter a payment amount/],
    ['abc', /valid amount/],
    ['1.005', /valid amount/],
    ['0', /greater than/],
    ['10.01', /cannot exceed/],
    ['2.99', /at least ₹3\.00/],
    ['99999999999999999999', /too large/],
  ])('rejects %j', (raw, message) => {
    const result = validateRecordPayment(raw, partialLink, NOW)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(message)
  })
})
