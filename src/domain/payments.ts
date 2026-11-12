import { formatPaise, parseAmountInput } from './money'
import { canRecordPayment, duePaise, getStatus, paidPaise } from './status'
import type { PaymentLink } from './types'

/**
 * Rules for recording a payment of `amountPaise` against `link`. Returns an error message, or
 * null when the payment is allowed. Used by the form (via validateRecordPayment) and again by
 * the API so the rules cannot be bypassed.
 */
export function checkPaymentAmount(link: PaymentLink, amountPaise: number, now: number): string | null {
  if (!canRecordPayment(getStatus(link, now))) {
    return 'Payments can only be recorded on active or partially paid links.'
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return 'Payment must be greater than ₹0.'
  }
  const due = duePaise(link)
  if (amountPaise > due) {
    return `Payment cannot exceed the amount due (${formatPaise(due)}).`
  }
  if (!link.allowPartial && amountPaise !== due) {
    return `This link does not allow partial payments. Pay the full amount due (${formatPaise(due)}).`
  }
  if (
    link.allowPartial &&
    paidPaise(link) === 0 &&
    link.minFirstPaymentPaise !== undefined &&
    amountPaise < link.minFirstPaymentPaise
  ) {
    return `The first payment must be at least ${formatPaise(link.minFirstPaymentPaise)}.`
  }
  return null
}

export type RecordPaymentResult = { ok: true; amountPaise: number } | { ok: false; error: string }

/** Validates the raw text typed into the "Record payment" form. */
export function validateRecordPayment(raw: string, link: PaymentLink, now: number): RecordPaymentResult {
  const parsed = parseAmountInput(raw)
  if (!parsed.ok) {
    switch (parsed.reason) {
      case 'empty':
        return { ok: false, error: 'Enter a payment amount.' }
      case 'format':
        return { ok: false, error: 'Enter a valid amount in rupees, with at most 2 decimal places.' }
      case 'too_large':
        return { ok: false, error: 'That amount is too large.' }
    }
  }
  const error = checkPaymentAmount(link, parsed.paise, now)
  return error ? { ok: false, error } : { ok: true, amountPaise: parsed.paise }
}
