import { useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode, RefObject } from 'react'
import { formatPaise } from '../domain/money'
import type { NewLinkInput } from '../domain/types'
import { DESCRIPTION_MAX, FIELD_ORDER, validateLinkInput } from '../domain/validation'
import type { FieldErrors, FieldName, LinkFormValues } from '../domain/validation'
import { ErrorAlert } from './ErrorAlert'

type InputName = Exclude<FieldName, 'contact'>

const EMPTY: LinkFormValues = { amount: '', description: '', email: '', phone: '', expiry: '' }

interface FieldProps {
  baseId: string
  name: InputName
  label: string
  hint?: string
  error?: string
  /** Id of a group-level error that also describes this field. */
  extraDescribedBy?: string
  counter?: string
  children: (a11y: { id: string; 'aria-describedby'?: string; 'aria-invalid': boolean }) => ReactNode
}

function Field({ baseId, name, label, hint, error, extraDescribedBy, counter, children }: FieldProps) {
  const id = `${baseId}-${name}`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, counter && `${id}-counter`, error && errorId, extraDescribedBy]
    .filter(Boolean)
    .join(' ')
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': Boolean(error || extraDescribedBy),
      })}
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {counter && (
        <p id={`${id}-counter`} className="hint">
          {counter}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

interface CreateLinkFormProps {
  /** Rejects on failure. */
  onCreate: (input: NewLinkInput) => Promise<unknown>
}

export function CreateLinkForm({ onCreate }: CreateLinkFormProps) {
  const baseId = useId()
  const [values, setValues] = useState<LinkFormValues>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const lastInput = useRef<NewLinkInput | null>(null)

  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const expiryRef = useRef<HTMLInputElement>(null)
  const focusTargets: Record<FieldName, RefObject<HTMLInputElement | null>> = {
    amount: amountRef,
    description: descriptionRef,
    contact: emailRef,
    email: emailRef,
    phone: phoneRef,
    expiry: expiryRef,
  }

  function revalidate(next: LinkFormValues, fields: FieldName[]) {
    const result = validateLinkInput(next, Date.now())
    const found: FieldErrors = result.ok ? {} : result.errors
    setErrors((previous) => {
      const merged = { ...previous }
      for (const field of fields) {
        if (found[field]) merged[field] = found[field]
        else delete merged[field]
      }
      return merged
    })
  }

  function handleChange(field: InputName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = { ...values, [field]: event.target.value }
      setValues(next)
      setSuccess('')
      const isContact = field === 'email' || field === 'phone'
      if (errors[field] || (isContact && errors.contact)) {
        revalidate(next, isContact ? [field, 'contact'] : [field])
      }
    }
  }

  function handleBlur(field: InputName) {
    return () => revalidate(values, [field])
  }

  async function send(input: NewLinkInput) {
    setSubmitting(true)
    setSubmitError(null)
    lastInput.current = input
    try {
      await onCreate(input)
      setValues(EMPTY)
      setErrors({})
      setSuccess(`Payment link for ${formatPaise(input.amountPaise)} created.`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create the payment link.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSuccess('')
    const result = validateLinkInput(values, Date.now())
    if (!result.ok) {
      setErrors(result.errors)
      const first = FIELD_ORDER.find((field) => result.errors[field])
      if (first) focusTargets[first].current?.focus()
      return
    }
    setErrors({})
    await send(result.value)
  }

  const contactErrorId = `${baseId}-contact-error`

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Create payment link" className="form">
      <div className="form__grid">
        <Field
          baseId={baseId}
          name="amount"
          label="Amount (INR)"
          hint="Up to ₹5,00,000, with at most 2 decimals."
          error={errors.amount}
        >
          {(a11y) => (
            <input
              {...a11y}
              ref={amountRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.amount}
              onChange={handleChange('amount')}
              onBlur={handleBlur('amount')}
            />
          )}
        </Field>

        <Field
          baseId={baseId}
          name="description"
          label="Description"
          counter={`${values.description.length}/${DESCRIPTION_MAX}`}
          error={errors.description}
        >
          {(a11y) => (
            <input
              {...a11y}
              ref={descriptionRef}
              type="text"
              maxLength={DESCRIPTION_MAX}
              autoComplete="off"
              value={values.description}
              onChange={handleChange('description')}
              onBlur={handleBlur('description')}
            />
          )}
        </Field>
      </div>

      <fieldset className="fieldset">
        <legend>Customer contact</legend>
        <p className="hint">Provide an email, a phone number, or both.</p>
        {errors.contact && (
          <p id={contactErrorId} className="field-error">
            {errors.contact}
          </p>
        )}
        <div className="form__grid">
          <Field
            baseId={baseId}
            name="email"
            label="Customer email"
            error={errors.email}
            extraDescribedBy={errors.contact ? contactErrorId : undefined}
          >
            {(a11y) => (
              <input
                {...a11y}
                ref={emailRef}
                type="email"
                autoComplete="off"
                value={values.email}
                onChange={handleChange('email')}
                onBlur={handleBlur('email')}
              />
            )}
          </Field>
          <Field
            baseId={baseId}
            name="phone"
            label="Customer phone"
            hint="10-digit Indian mobile, e.g. 98765 43210."
            error={errors.phone}
            extraDescribedBy={errors.contact ? contactErrorId : undefined}
          >
            {(a11y) => (
              <input
                {...a11y}
                ref={phoneRef}
                type="tel"
                autoComplete="off"
                value={values.phone}
                onChange={handleChange('phone')}
                onBlur={handleBlur('phone')}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <Field
        baseId={baseId}
        name="expiry"
        label="Expiry (optional)"
        hint="Leave blank for a link that never expires."
        error={errors.expiry}
      >
        {(a11y) => (
          <input
            {...a11y}
            ref={expiryRef}
            type="datetime-local"
            value={values.expiry}
            onChange={handleChange('expiry')}
            onBlur={handleBlur('expiry')}
          />
        )}
      </Field>

      {submitError && (
        <ErrorAlert
          message={submitError}
          onRetry={() => {
            if (lastInput.current && !submitting) void send(lastInput.current)
          }}
        />
      )}

      <button type="submit" className="btn btn--primary" aria-disabled={submitting}>
        {submitting ? 'Creating…' : 'Create payment link'}
      </button>

      <p role="status" aria-live="polite" className="success">
        {success}
      </p>
    </form>
  )
}
