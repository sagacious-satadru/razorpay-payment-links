import { createLinksApi } from './linksApi'

const input = { amountPaise: 100, description: 'Test', email: 'a@b.co' }

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

  it('marks an active link as paid', async () => {
    const api = createLinksApi({ delayMs: 0 })
    const created = await api.createLink(input)
    const paid = await api.markPaid(created.id)
    expect(paid.paidAt).toBeDefined()
  })

  it('rejects marking a paid or expired link as paid', async () => {
    let t = 1000
    const api = createLinksApi({ delayMs: 0, now: () => t })
    const paid = await api.createLink(input)
    await api.markPaid(paid.id)
    await expect(api.markPaid(paid.id)).rejects.toThrow(/already paid/)

    const expiring = await api.createLink({ ...input, expiresAt: 2000 })
    t = 2000
    await expect(api.markPaid(expiring.id)).rejects.toThrow(/expired/)
  })

  it('rejects an unknown id', async () => {
    const api = createLinksApi({ delayMs: 0 })
    await expect(api.markPaid('nope')).rejects.toThrow(/not found/)
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
