import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { formatPaise, paiseToRupeeString } from '../domain/money'
import { validateRecordPayment } from '../domain/payments'
import { duePaise, paidPaise } from '../domain/status'
import type { PaymentLink } from '../domain/types'

interface RecordPaymentFormProps {
  link: PaymentLink
  pending: boolean
  /** Resolves true when the payment was recorded. */
  onSubmit: (amountPaise: number) => Promise<boolean>
  onCancel: () => void
}

function ruleHint(link: PaymentLink): string {
  const due = formatPaise(duePaise(link))
  if (!link.allowPartial) return `Partial payments are not allowed. Pay the full amount due (${due}).`
  if (paidPaise(link) === 0 && link.minFirstPaymentPaise !== undefined) {
    return `Amount due ${due}. Minimum first payment ${formatPaise(link.minFirstPaymentPaise)}.`
  }
  return `Amount due ${due}.`
}

export function RecordPaymentForm({ link, pending, onSubmit, onCancel }: RecordPaymentFormProps) {
  const id = useId()
  const [value, setValue] = useState(() => paiseToRupeeString(duePaise(link)))
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const result = validateRecordPayment(value, link, Date.now())
    if (!result.ok) {
      setError(result.error)
      inputRef.current?.focus()
      return
    }
    setError(null)
    await onSubmit(result.amountPaise)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel()
  }

  const inputId = `${id}-amount`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  return (
    <form
      className="record"
      noValidate
      aria-label={`Record payment for ${link.description}`}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <label htmlFor={inputId}>Payment amount (INR)</label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          if (error) setError(null)
        }}
        aria-invalid={error !== null}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      />
      <p id={hintId} className="hint">
        {ruleHint(link)}
      </p>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
      <div className="record__actions">
        <button type="submit" className="btn btn--primary" aria-disabled={pending}>
          {pending ? 'Recording…' : 'Record'}
        </button>
        <button type="button" className="btn btn--link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
