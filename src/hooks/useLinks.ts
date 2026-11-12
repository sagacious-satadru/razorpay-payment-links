import { useCallback, useEffect, useState } from 'react'
import type { LinksApi } from '../api/linksApi'
import type { NewLinkInput, PaymentLink } from '../domain/types'

export type LoadState = 'loading' | 'ready' | 'error'

export interface ActionError {
  id: string
  message: string
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

/** Keeps links created while the first load was in flight, newest first. */
function mergeLinks(loaded: PaymentLink[], current: PaymentLink[]): PaymentLink[] {
  const loadedIds = new Set(loaded.map((link) => link.id))
  const extra = current.filter((link) => !loadedIds.has(link.id))
  return [...extra, ...loaded].sort((a, b) => b.createdAt - a.createdAt)
}

export function useLinks(api: LinksApi) {
  const [links, setLinks] = useState<PaymentLink[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<ActionError | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const loaded = await api.listLinks()
      setLinks((current) => mergeLinks(loaded, current))
      setLoadState('ready')
    } catch (error) {
      setLoadError(messageOf(error))
      setLoadState('error')
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  /** Rejects on failure so the form can show its own error and keep its values. */
  const create = useCallback(
    async (input: NewLinkInput) => {
      const link = await api.createLink(input)
      setLinks((current) => [link, ...current])
      return link
    },
    [api],
  )

  const markPaid = useCallback(
    async (id: string) => {
      setActionError(null)
      setPendingIds((current) => new Set(current).add(id))
      try {
        const updated = await api.markPaid(id)
        setLinks((current) => current.map((link) => (link.id === id ? updated : link)))
      } catch (error) {
        setActionError({ id, message: messageOf(error) })
      } finally {
        setPendingIds((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
      }
    },
    [api],
  )

  const dismissActionError = useCallback(() => setActionError(null), [])

  return {
    links,
    loadState,
    loadError,
    reload: load,
    create,
    markPaid,
    pendingIds,
    actionError,
    dismissActionError,
  }
}
