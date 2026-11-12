export const MAX_AMOUNT_PAISE = 50_000_000 // INR 5,00,000.00

/** Digits, optionally followed by a dot and 1-2 decimals. No signs, commas, exponents. */
export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

/**
 * Parses a rupee string into integer paise by string arithmetic (never float multiplication).
 * Returns null when the syntax is invalid or the value is not a safe integer.
 */
export function parseRupeesToPaise(input: string): number | null {
  const text = input.trim()
  if (!AMOUNT_PATTERN.test(text)) return null
  const [rupees, fraction = ''] = text.split('.')
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(paise) ? paise : null
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

export function formatPaise(paise: number): string {
  return inr.format(paise / 100)
}
