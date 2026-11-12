import { useEffect, useRef, useState } from 'react'
import { formatDateTime, formatPhone } from '../domain/format'
import { formatPaise } from '../domain/money'
import { canRecordPayment, duePaise, getStatus, paidPaise, statusLabel } from '../domain/status'
import type { PaymentLink } from '../domain/types'
import { RecordPaymentForm } from './RecordPaymentForm'

interface LinksListProps {
  links: PaymentLink[]
  now: number
  pendingIds: ReadonlySet<string>
  /** Resolves true when the payment was recorded. */
  onRecordPayment: (id: string, amountPaise: number) => Promise<boolean>
}

function Time({ epochMs }: { epochMs: number }) {
  return <time dateTime={new Date(epochMs).toISOString()}>{formatDateTime(epochMs)}</time>
}

/**
 * A real <table> on wide screens; CSS restyles rows into stacked cards on narrow screens.
 * Explicit roles keep the table semantics when CSS changes the display type.
 */
export function LinksList({ links, now, pendingIds, onRecordPayment }: LinksListProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [returnFocusId, setReturnFocusId] = useState<string | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  // After cancelling the inline form, give focus back to its trigger button.
  useEffect(() => {
    if (returnFocusId === null) return
    tableRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-record-for="${returnFocusId}"]`)
      ?.focus()
    setReturnFocusId(null)
  }, [returnFocusId])

  function cancel(id: string) {
    setOpenId(null)
    setReturnFocusId(id)
  }

  return (
    <table ref={tableRef} className="links-table" role="table" aria-label="Payment links">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Amount</th>
          <th role="columnheader" scope="col">Description</th>
          <th role="columnheader" scope="col">Customer</th>
          <th role="columnheader" scope="col">Status</th>
          <th role="columnheader" scope="col">Paid / due</th>
          <th role="columnheader" scope="col">Created</th>
          <th role="columnheader" scope="col">Action</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {links.map((link) => {
          const status = getStatus(link, now)
          const pending = pendingIds.has(link.id)
          const paid = paidPaise(link)
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
              <td role="cell" data-label="Paid / due">
                <div>{formatPaise(paid)} paid</div>
                <div>{formatPaise(duePaise(link))} due</div>
                {link.allowPartial && paid === 0 && link.minFirstPaymentPaise !== undefined && (
                  <div className="muted">
                    Min. first payment {formatPaise(link.minFirstPaymentPaise)}
                  </div>
                )}
              </td>
              <td role="cell" data-label="Created">
                <Time epochMs={link.createdAt} />
              </td>
              <td role="cell" data-label="Action">
                {canRecordPayment(status) &&
                  (openId === link.id ? (
                    <RecordPaymentForm
                      link={link}
                      pending={pending}
                      onSubmit={async (amountPaise) => {
                        const ok = await onRecordPayment(link.id, amountPaise)
                        if (ok) setOpenId(null)
                        return ok
                      }}
                      onCancel={() => cancel(link.id)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      data-record-for={link.id}
                      aria-label={`Record payment: ${link.description}`}
                      onClick={() => setOpenId(link.id)}
                    >
                      Record payment
                    </button>
                  ))}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
