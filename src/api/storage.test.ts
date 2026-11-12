import { makeLink, makePayment } from '../test/factories'
import { createLinksApi } from './linksApi'
import { isPaymentLink, readLinks, STORAGE_KEY, writeLinks } from './storage'

const input = { amountPaise: 1000, description: 'Persisted', email: 'a@b.co', allowPartial: true, minFirstPaymentPaise: 300 }

function throwingStorage(on: 'getItem' | 'setItem'): Storage {
  const store = window.localStorage
  return new Proxy(store, {
    get(target, prop) {
      if (prop === on) {
        return () => {
          throw new Error('storage unavailable')
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

describe('localStorage persistence', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    window.localStorage.clear()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  it('uses the versioned key', () => {
    expect(STORAGE_KEY).toBe('payment-links:v1')
  })

  it('round-trips links and payments across "page loads"', async () => {
    const first = createLinksApi({ delayMs: 0, storage: window.localStorage })
    const created = await first.createLink(input)
    await first.recordPayment(created.id, 400)

    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Persisted')

    const second = createLinksApi({ delayMs: 0, storage: window.localStorage })
    const listed = await second.listLinks()
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      id: created.id,
      description: 'Persisted',
      allowPartial: true,
      minFirstPaymentPaise: 300,
    })
    expect(listed[0].payments.map((p) => p.amountPaise)).toEqual([400])

    // and the reloaded API can keep recording payments, with unique ids
    const another = await second.createLink(input)
    expect(another.id).not.toBe(created.id)
    await second.recordPayment(created.id, 600)
    const third = createLinksApi({ delayMs: 0, storage: window.localStorage })
    expect((await third.listLinks()).find((l) => l.id === created.id)?.payments).toHaveLength(2)
  })

  it('does not save a failed (injected) operation', async () => {
    const api = createLinksApi({ delayMs: 0, storage: window.localStorage })
    api.failNext()
    await expect(api.createLink(input)).rejects.toThrow()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('starts empty when nothing is stored', () => {
    expect(readLinks(window.localStorage)).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  describe('corrupt data starts empty (with a warning)', () => {
    it.each([
      ['invalid JSON', '{not json'],
      ['not an array', '{"a":1}'],
      ['null', 'null'],
      ['a link in the old pre-payments shape', JSON.stringify([{ id: 'x', amountPaise: 100, description: 'd', createdAt: 1, paidAt: 5 }])],
      ['a negative amount', JSON.stringify([makeLink({ amountPaise: -5 })])],
      ['a fractional amount', JSON.stringify([makeLink({ amountPaise: 10.5 })])],
      ['a bad payment', JSON.stringify([{ ...makeLink(), payments: [{ id: 'p', amountPaise: 'x', at: 1 }] }])],
      ['one bad link among good ones', JSON.stringify([makeLink(), { nope: true }])],
    ])('%s', (_name, raw) => {
      window.localStorage.setItem(STORAGE_KEY, raw)
      expect(readLinks(window.localStorage)).toEqual([])
      expect(warn).toHaveBeenCalled()
    })

    it('the API still works and then overwrites the bad data', async () => {
      window.localStorage.setItem(STORAGE_KEY, '{not json')
      const api = createLinksApi({ delayMs: 0, storage: window.localStorage })
      expect(await api.listLinks()).toEqual([])
      await api.createLink(input)
      expect(readLinks(window.localStorage)).toHaveLength(1)
    })
  })

  it('survives unavailable storage: reads give empty, writes are ignored', async () => {
    expect(readLinks(throwingStorage('getItem'))).toEqual([])
    const api = createLinksApi({ delayMs: 0, storage: throwingStorage('setItem') })
    await expect(api.createLink(input)).resolves.toMatchObject({ description: 'Persisted' })
    expect(readLinks(null)).toEqual([])
    expect(() => writeLinks(null, [])).not.toThrow()
  })

  it('accepts valid stored links', () => {
    expect(isPaymentLink(makeLink({ payments: [makePayment(100)], expiresAt: 5, email: 'a@b.co' }))).toBe(true)
  })
})
