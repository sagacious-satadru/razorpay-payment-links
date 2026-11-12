import { normalizePhone, validateLinkInput } from './validation'
import type { LinkFormValues } from './validation'

const NOW = new Date('2026-06-01T10:00:00').getTime()

const valid: LinkFormValues = {
  amount: '500',
  description: 'Invoice 42',
  email: 'Customer@Example.com',
  phone: '',
  expiry: '',
}

function errorsFor(overrides: Partial<LinkFormValues>) {
  const result = validateLinkInput({ ...valid, ...overrides }, NOW)
  if (result.ok) throw new Error('expected validation to fail')
  return result.errors
}

describe('validateLinkInput', () => {
  it('accepts valid input and normalises it', () => {
    const result = validateLinkInput(valid, NOW)
    expect(result).toEqual({
      ok: true,
      value: { amountPaise: 50_000, description: 'Invoice 42', email: 'customer@example.com' },
    })
  })

  describe('amount', () => {
    it('requires a value', () => {
      expect(errorsFor({ amount: '' }).amount).toBeDefined()
    })
    it.each(['0', '0.00'])('rejects %j (must be > 0)', (amount) => {
      expect(errorsFor({ amount }).amount).toMatch(/greater than/)
    })
    it.each(['1.005', '1e5', '-5', 'abc'])('rejects malformed %j', (amount) => {
      expect(errorsFor({ amount }).amount).toMatch(/valid amount/)
    })
    it('accepts the 0.01 minimum and the 5,00,000 maximum', () => {
      for (const amount of ['0.01', '500000', '500000.00']) {
        expect(validateLinkInput({ ...valid, amount }, NOW).ok).toBe(true)
      }
    })
    it('rejects anything above 5,00,000', () => {
      expect(errorsFor({ amount: '500000.01' }).amount).toMatch(/exceed/)
      expect(errorsFor({ amount: '99999999999999999999' }).amount).toMatch(/exceed/)
    })
  })

  describe('description', () => {
    it('is required, and whitespace-only counts as empty', () => {
      expect(errorsFor({ description: '' }).description).toBeDefined()
      expect(errorsFor({ description: '    ' }).description).toBeDefined()
    })
    it('allows 100 characters and rejects 101', () => {
      expect(validateLinkInput({ ...valid, description: 'a'.repeat(100) }, NOW).ok).toBe(true)
      expect(errorsFor({ description: 'a'.repeat(101) }).description).toMatch(/100/)
    })
    it('trims before measuring and saving', () => {
      const result = validateLinkInput({ ...valid, description: `  ${'a'.repeat(100)}  ` }, NOW)
      expect(result.ok && result.value.description).toBe('a'.repeat(100))
    })
  })

  describe('customer contact', () => {
    it('requires at least one of email or phone', () => {
      expect(errorsFor({ email: '', phone: '' }).contact).toBeDefined()
      expect(errorsFor({ email: '  ', phone: ' ' }).contact).toBeDefined()
    })
    it('accepts phone only', () => {
      const result = validateLinkInput({ ...valid, email: '', phone: '98765 43210' }, NOW)
      expect(result.ok && result.value).toMatchObject({ phone: '9876543210' })
    })
    it('validates the email format', () => {
      expect(errorsFor({ email: 'not-an-email' }).email).toBeDefined()
      expect(errorsFor({ email: 'a@b' }).email).toBeDefined()
    })
    it('validates the phone format', () => {
      expect(errorsFor({ email: '', phone: '12345' }).phone).toBeDefined()
      expect(errorsFor({ email: '', phone: '5876543210' }).phone).toBeDefined()
    })
    it('validates both when both are given', () => {
      const errors = errorsFor({ email: 'bad', phone: '123' })
      expect(errors.email).toBeDefined()
      expect(errors.phone).toBeDefined()
      expect(errors.contact).toBeUndefined()
    })
    it('keeps both when both are valid', () => {
      const result = validateLinkInput({ ...valid, phone: '+91 98765-43210' }, NOW)
      expect(result.ok && result.value).toMatchObject({
        email: 'customer@example.com',
        phone: '9876543210',
      })
    })
  })

  describe('expiry', () => {
    it('is optional', () => {
      const result = validateLinkInput({ ...valid, expiry: '' }, NOW)
      expect(result.ok && result.value.expiresAt).toBeUndefined()
    })
    it('accepts a future time', () => {
      const result = validateLinkInput({ ...valid, expiry: '2026-06-01T10:01' }, NOW)
      expect(result.ok && result.value.expiresAt).toBe(new Date('2026-06-01T10:01').getTime())
    })
    it('rejects the past and exactly now', () => {
      expect(errorsFor({ expiry: '2026-05-31T10:00' }).expiry).toMatch(/future/)
      expect(errorsFor({ expiry: '2026-06-01T10:00' }).expiry).toMatch(/future/)
    })
    it('rejects garbage', () => {
      expect(errorsFor({ expiry: 'tomorrow' }).expiry).toBeDefined()
    })
  })

  it('reports several errors at once', () => {
    const errors = errorsFor({ amount: '', description: '', email: '', phone: '' })
    expect(Object.keys(errors).sort()).toEqual(['amount', 'contact', 'description'])
  })
})

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['+91-98765-43210', '9876543210'],
    ['09876543210', '9876543210'],
    ['(98765) 43210', '9876543210'],
  ])('%j -> %j', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })
})
