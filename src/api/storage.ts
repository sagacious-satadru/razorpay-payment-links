import type { PaymentLink } from '../domain/types'

export const STORAGE_KEY = 'payment-links:v1'

/** The browser's localStorage, or null when it is unavailable (privacy modes, SSR, tests). */
export function getBrowserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isOptional = (value: unknown, check: (v: unknown) => boolean) =>
  value === undefined || check(value)
const isString = (value: unknown) => typeof value === 'string'

function isPayment(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isPositiveInt(value.amountPaise) &&
    isFiniteNumber(value.at)
  )
}

/** Runtime shape check for data read from storage (it may be stale, edited or corrupt). */
export function isPaymentLink(value: unknown): value is PaymentLink {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isPositiveInt(value.amountPaise) &&
    isString(value.description) &&
    isOptional(value.email, isString) &&
    isOptional(value.phone, isString) &&
    isFiniteNumber(value.createdAt) &&
    isOptional(value.expiresAt, isFiniteNumber) &&
    typeof value.allowPartial === 'boolean' &&
    isOptional(value.minFirstPaymentPaise, isPositiveInt) &&
    Array.isArray(value.payments) &&
    value.payments.every(isPayment)
  )
}

/** Returns the stored links, or [] (with a console warning) when nothing valid is stored. */
export function readLinks(storage: Storage | null): PaymentLink[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(isPaymentLink)) return parsed
    console.warn(`Ignoring invalid data in localStorage "${STORAGE_KEY}"; starting empty.`)
  } catch (error) {
    console.warn(`Could not read localStorage "${STORAGE_KEY}"; starting empty.`, error)
  }
  return []
}

/** Best effort: a failing write (quota, private mode) must never break the app. */
export function writeLinks(storage: Storage | null, links: PaymentLink[]): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(links))
  } catch (error) {
    console.warn(`Could not save to localStorage "${STORAGE_KEY}".`, error)
  }
}
