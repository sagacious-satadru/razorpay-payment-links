import { createLinksApi } from './linksApi'

const input = { amountPaise: 100, description: 'Test', email: 'a@b.co', allowPartial: false }

describe('createLinksApi', () => {
  it('creates links and lists them newest first', async () => {
    let t = 1000
    const api = createLinksApi({ delayMs: 0, now: () => t++ })
    const first = await api.createLink(input)
    const second = await api.createLink({ ...input, description: 'Second' })
    expect(first.id).not.toBe(second.id)
    const listed = await api.listLinks()
    expect(listed.map((l) => l.description)).toEqual(['Second', 'Test'])
  })

  it('gives unique ids even when two APIs share the same frozen clock', async () => {
    const a = createLinksApi({ delayMs: 0, now: () => 5000 })
    const b = createLinksApi({ delayMs: 0, now: () => 5000 })
    const fromA = await a.createLink({ ...input, amountPaise: 1000, allowPartial: true })
    const fromB = await b.createLink({ ...input, amountPaise: 1000, allowPartial: true })
    expect(fromA.id).not.toBe(fromB.id)
    const paidA = await a.recordPayment(fromA.id, 400)
    const paidB = await b.recordPayment(fromB.id, 400)
    expect(paidA.payments[0].id).not.toBe(paidB.payments[0].id)
  })

  it('creates links with no payments', async () => {
    const api = createLinksApi({ delayMs: 0 })
    const created = await api.createLink(input)
    expect(created.payments).toEqual([])
  })

  it('records payments, accumulating them in order', async () => {
    const api = createLinksApi({ delayMs: 0 })
    const created = await api.createLink({ ...input, amountPaise: 1000, allowPartial: true })
    const first = await api.recordPayment(created.id, 400)
    expect(first.payments.map((p) => p.amountPaise)).toEqual([400])
    const second = await api.recordPayment(created.id, 600)
    expect(second.payments.map((p) => p.amountPaise)).toEqual([400, 600])
    expect(first.payments).toHaveLength(1) // earlier copies are not mutated
  })

  it('enforces the payment rules server-side', async () => {
    let t = 1000
    const api = createLinksApi({ delayMs: 0, now: () => t })
    const full = await api.createLink({ ...input, amountPaise: 1000 })
    await expect(api.recordPayment(full.id, 500)).rejects.toThrow(/does not allow partial/)
    await expect(api.recordPayment(full.id, 1001)).rejects.toThrow(/cannot exceed/)
    await api.recordPayment(full.id, 1000)
    await expect(api.recordPayment(full.id, 1)).rejects.toThrow(/active or partially paid/)

    const minimum = await api.createLink({
      ...input,
      amountPaise: 1000,
      allowPartial: true,
      minFirstPaymentPaise: 300,
    })
    await expect(api.recordPayment(minimum.id, 100)).rejects.toThrow(/at least/)

    const expiring = await api.createLink({ ...input, expiresAt: 2000 })
    t = 2000
    await expect(api.recordPayment(expiring.id, 100)).rejects.toThrow(/active or partially paid/)
  })

  it('rejects an unknown id', async () => {
    const api = createLinksApi({ delayMs: 0 })
    await expect(api.recordPayment('nope', 100)).rejects.toThrow(/not found/)
  })

  it('can be told to fail the next call, then recovers', async () => {
    const api = createLinksApi({ delayMs: 0 })
    api.failNext()
    await expect(api.listLinks()).rejects.toThrow()
    await expect(api.listLinks()).resolves.toEqual([])
  })

  it('can be told to fail every call', async () => {
    const api = createLinksApi({ delayMs: 0 })
    api.setFailAll(true)
    await expect(api.createLink(input)).rejects.toThrow()
    await expect(api.createLink(input)).rejects.toThrow()
    api.setFailAll(false)
    await expect(api.createLink(input)).resolves.toMatchObject({ description: 'Test' })
  })
})
