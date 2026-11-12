import { formatPaise, parseRupeesToPaise } from './money'

describe('parseRupeesToPaise', () => {
  it.each([
    ['0', 0],
    ['0.01', 1],
    ['500000', 50_000_000],
    ['500000.01', 50_000_001],
    [' 5 ', 500],
    ['12.3', 1230],
    ['0.1', 10],
    ['19.99', 1999], // 19.99 * 100 === 1998.9999999999998 with floats
    ['1.10', 110],
  ])('parses %j to %d paise', (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected)
  })

  it.each(['1.005', '1e5', '', '   ', '.5', '5.', '-5', '+5', '1,000', 'abc', '1.2.3'])(
    'rejects %j',
    (input) => {
      expect(parseRupeesToPaise(input)).toBeNull()
    },
  )

  it('rejects numbers beyond the safe integer range', () => {
    expect(parseRupeesToPaise('9007199254740993')).toBeNull()
  })
})

describe('formatPaise', () => {
  it('formats with the Indian grouping and 2 decimals', () => {
    expect(formatPaise(50_000)).toBe('₹500.00')
    expect(formatPaise(50_000_000)).toBe('₹5,00,000.00')
    expect(formatPaise(1)).toBe('₹0.01')
  })
})
