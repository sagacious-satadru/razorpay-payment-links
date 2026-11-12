import { AMOUNT_PATTERN, MAX_AMOUNT_PAISE, parseRupeesToPaise } from './money'
import type { NewLinkInput } from './types'

export const DESCRIPTION_MAX = 100

export interface LinkFormValues {
  amount: string
  description: string
  email: string
  phone: string
  /** `datetime-local` value (local time zone), e.g. "2026-12-01T18:30". Blank = never expires. */
  expiry: string
}

export type FieldName = 'amount' | 'description' | 'contact' | 'email' | 'phone' | 'expiry'
export type FieldErrors = Partial<Record<FieldName, string>>

/** Order used to decide which invalid field receives focus first. */
export const FIELD_ORDER: readonly FieldName[] = [
  'amount',
  'description',
  'contact',
  'email',
  'phone',
  'expiry',
]

export type ValidationResult =
  | { ok: true; value: NewLinkInput }
  | { ok: false; errors: FieldErrors }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[6-9]\d{9}$/
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/** Strips spaces, dashes and brackets, then a leading +91 or 0. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '').replace(/^(\+91|0)/, '')
}

export function validateLinkInput(raw: LinkFormValues, now: number): ValidationResult {
  const errors: FieldErrors = {}

  const amountText = raw.amount.trim()
  let amountPaise = 0
  if (amountText === '') {
    errors.amount = 'Enter an amount.'
  } else if (!AMOUNT_PATTERN.test(amountText)) {
    errors.amount = 'Enter a valid amount in rupees, with at most 2 decimal places.'
  } else {
    const parsed = parseRupeesToPaise(amountText)
    if (parsed === null || parsed > MAX_AMOUNT_PAISE) {
      errors.amount = 'Amount cannot exceed ₹5,00,000.'
    } else if (parsed <= 0) {
      errors.amount = 'Amount must be greater than ₹0.'
    } else {
      amountPaise = parsed
    }
  }

  const description = raw.description.trim()
  if (description === '') {
    errors.description = 'Enter a description.'
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer.`
  }

  const email = raw.email.trim().toLowerCase()
  const phone = normalizePhone(raw.phone.trim())
  if (email === '' && phone === '') {
    errors.contact = 'Enter a customer email or phone number (at least one).'
  }
  if (email !== '' && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (phone !== '' && !PHONE_PATTERN.test(phone)) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number.'
  }

  let expiresAt: number | undefined
  const expiryText = raw.expiry.trim()
  if (expiryText !== '') {
    const parsed = DATETIME_LOCAL_PATTERN.test(expiryText) ? new Date(expiryText).getTime() : NaN
    if (Number.isNaN(parsed)) {
      errors.expiry = 'Enter a valid expiry date and time.'
    } else if (parsed <= now) {
      errors.expiry = 'Expiry must be in the future.'
    } else {
      expiresAt = parsed
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      amountPaise,
      description,
      ...(email !== '' && { email }),
      ...(phone !== '' && { phone }),
      ...(expiresAt !== undefined && { expiresAt }),
    },
  }
}
