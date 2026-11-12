import { filterLabel } from '../domain/status'
import type { StatusFilter as Filter } from '../domain/types'

const FILTERS: readonly Filter[] = ['all', 'active', 'partially_paid', 'paid', 'expired']

interface StatusFilterProps {
  value: Filter
  counts: Record<Filter, number>
  onChange: (filter: Filter) => void
}

export function StatusFilter({ value, counts, onChange }: StatusFilterProps) {
  return (
    <div role="group" aria-label="Filter by status" className="filter">
      {FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className="filter__btn"
          aria-pressed={value === filter}
          onClick={() => onChange(filter)}
        >
          {filterLabel(filter)} ({counts[filter]})
        </button>
      ))}
    </div>
  )
}
