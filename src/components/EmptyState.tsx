import { filterLabel } from '../domain/status'
import type { StatusFilter } from '../domain/types'

interface EmptyStateProps {
  /** Total number of links, ignoring the filter. */
  totalCount: number
  filter: StatusFilter
}

export function EmptyState({ totalCount, filter }: EmptyStateProps) {
  if (totalCount === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No payment links yet</p>
        <p>Create your first link using the form above.</p>
      </div>
    )
  }
  return (
    <div className="empty">
      <p className="empty__title">No {filterLabel(filter).toLowerCase()} links</p>
      <p>No payment links match this filter. Try another status.</p>
    </div>
  )
}
