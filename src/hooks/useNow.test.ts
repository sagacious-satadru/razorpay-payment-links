import { act, renderHook } from '@testing-library/react'
import { useNow } from './useNow'

describe('useNow', () => {
  afterEach(() => vi.useRealTimers())

  it('ticks on the interval and stops after unmount', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00'))
    const { result, unmount } = renderHook(() => useNow(30_000))
    const start = result.current

    act(() => {
      vi.advanceTimersByTime(29_999)
    })
    expect(result.current).toBe(start)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(start + 30_000)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
