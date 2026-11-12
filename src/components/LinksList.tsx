import { formatDateTime, formatPhone } from '../domain/format'
import { formatPaise } from '../domain/money'
import { canMarkPaid, getStatus, statusLabel } from '../domain/status'
import type { PaymentLink } from '../domain/types'

interface LinksListProps {
  links: PaymentLink[]
  now: number
  pendingIds: ReadonlySet<string>
  onMarkPaid: (id: string) => void
}

function Time({ epochMs }: { epochMs: number }) {
  return <time dateTime={new Date(epochMs).toISOString()}>{formatDateTime(epochMs)}</time>
}

/**
 * A real <table> on wide screens; CSS restyles rows into stacked cards on narrow screens.
 * Explicit roles keep the table semantics when CSS changes the display type.
 */
export function LinksList({ links, now, pendingIds, onMarkPaid }: LinksListProps) {
  return (
    <table className="links-table" role="table" aria-label="Payment links">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Amount</th>
          <th role="columnheader" scope="col">Description</th>
          <th role="columnheader" scope="col">Customer</th>
          <th role="columnheader" scope="col">Status</th>
          <th role="columnheader" scope="col">Created</th>
          <th role="columnheader" scope="col">Action</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {links.map((link) => {
          const status = getStatus(link, now)
          const pending = pendingIds.has(link.id)
          return (
            <tr key={link.id} role="row">
              <td role="cell" data-label="Amount" className="amount">
                {formatPaise(link.amountPaise)}
              </td>
              <td role="cell" data-label="Description">{link.description}</td>
              <td role="cell" data-label="Customer">
                {link.email && <div>{link.email}</div>}
                {link.phone && <div>{formatPhone(link.phone)}</div>}
              </td>
              <td role="cell" data-label="Status">
                <span className={`badge badge--${status}`}>{statusLabel(status)}</span>
                {link.expiresAt !== undefined && status !== 'paid' && (
                  <div className="muted">
                    {status === 'expired' ? 'Expired on ' : 'Expires '}
                    <Time epochMs={link.expiresAt} />
                  </div>
                )}
              </td>
              <td role="cell" data-label="Created">
                <Time epochMs={link.createdAt} />
              </td>
              <td role="cell" data-label="Action">
                {canMarkPaid(status) && (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    aria-label={`Mark as paid: ${link.description}`}
                    aria-disabled={pending}
                    onClick={() => {
                      if (!pending) onMarkPaid(link.id)
                    }}
                  >
                    {pending ? 'Marking…' : 'Mark as paid'}
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
