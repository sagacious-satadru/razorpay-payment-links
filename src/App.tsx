import { useState } from 'react'
import './App.css'
import { defaultLinksApi } from './api/linksApi'
import type { LinksApi } from './api/linksApi'
import { CreateLinkForm } from './components/CreateLinkForm'
import { EmptyState } from './components/EmptyState'
import { ErrorAlert } from './components/ErrorAlert'
import { LinksList } from './components/LinksList'
import { StatusFilter } from './components/StatusFilter'
import { countByStatus, filterLinks } from './domain/status'
import type { StatusFilter as Filter } from './domain/types'
import { useLinks } from './hooks/useLinks'
import { useNow } from './hooks/useNow'

interface AppProps {
  api?: LinksApi
}

export default function App({ api = defaultLinksApi }: AppProps) {
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('all')
  const {
    links,
    loadState,
    loadError,
    reload,
    create,
    markPaid,
    pendingIds,
    actionError,
  } = useLinks(api)

  const counts = countByStatus(links, now)
  const visible = filterLinks(links, filter, now)

  return (
    <div className="app">
      <header className="app__header">
        <h1>Payment Links</h1>
      </header>

      <main>
        <section aria-labelledby="create-heading" className="card">
          <h2 id="create-heading">Create a payment link</h2>
          <CreateLinkForm onCreate={create} />
        </section>

        <section aria-labelledby="list-heading" className="card">
          <h2 id="list-heading">Your payment links</h2>

          {loadState === 'loading' && <p role="status">Loading payment links…</p>}

          {loadState === 'error' && (
            <ErrorAlert message={loadError ?? 'Could not load payment links.'} onRetry={reload} />
          )}

          {loadState === 'ready' && (
            <>
              <StatusFilter value={filter} counts={counts} onChange={setFilter} />
              {actionError && (
                <ErrorAlert
                  message={actionError.message}
                  onRetry={() => void markPaid(actionError.id)}
                />
              )}
              {visible.length === 0 ? (
                <EmptyState totalCount={links.length} filter={filter} />
              ) : (
                <LinksList
                  links={visible}
                  now={now}
                  pendingIds={pendingIds}
                  onMarkPaid={(id) => void markPaid(id)}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
