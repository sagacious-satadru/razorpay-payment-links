import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateLinkForm } from './CreateLinkForm'

function pad(n: number) {
  return String(n).padStart(2, '0')
}
/** datetime-local string for `offsetMs` from now, in local time. */
function localInput(offsetMs: number) {
  const d = new Date(Date.now() + offsetMs)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const amount = () => screen.getByLabelText('Amount (INR)')
const description = () => screen.getByLabelText('Description')
const email = () => screen.getByLabelText('Customer email')
const phone = () => screen.getByLabelText('Customer phone')
const expiry = () => screen.getByLabelText('Expiry (optional)')
const submit = () => screen.getByRole('button', { name: 'Create payment link' })

describe('CreateLinkForm', () => {
  it('shows inline errors on submit and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateLinkForm onCreate={onCreate} />)

    await user.click(submit())

    expect(onCreate).not.toHaveBeenCalled()
    expect(amount()).toHaveFocus()
    expect(amount()).toHaveAttribute('aria-invalid', 'true')
    expect(amount()).toHaveAccessibleDescription(/Enter an amount/)
    expect(description()).toHaveAccessibleDescription(/Enter a description/)
    expect(email()).toHaveAccessibleDescription(/at least one/)
    expect(phone()).toHaveAccessibleDescription(/at least one/)
  })

  it('focuses the contact field when only the contact is missing', async () => {
    const user = userEvent.setup()
    render(<CreateLinkForm onCreate={vi.fn()} />)
    await user.type(amount(), '100')
    await user.type(description(), 'Test')
    await user.click(submit())
    expect(email()).toHaveFocus()
  })

  it('validates a field on blur and clears the error once fixed', async () => {
    const user = userEvent.setup()
    render(<CreateLinkForm onCreate={vi.fn()} />)

    await user.type(amount(), '1.005')
    await user.tab()
    expect(amount()).toHaveAccessibleDescription(/valid amount/)

    await user.clear(amount())
    await user.type(amount(), '1.00')
    expect(amount()).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(/valid amount/)).not.toBeInTheDocument()
  })

  it('rejects a past expiry', async () => {
    const user = userEvent.setup()
    render(<CreateLinkForm onCreate={vi.fn()} />)
    await user.click(expiry()) // focus first so that moving away triggers blur validation
    fireEvent.change(expiry(), { target: { value: localInput(-24 * 60 * 60 * 1000) } })
    await user.click(email())
    expect(expiry()).toHaveAccessibleDescription(/in the future/)
  })

  it('shows a live character counter and caps the description at 100', async () => {
    const user = userEvent.setup()
    render(<CreateLinkForm onCreate={vi.fn()} />)
    expect(description()).toHaveAttribute('maxlength', '100')
    await user.type(description(), 'abc')
    expect(screen.getByText('3/100')).toBeInTheDocument()
  })

  it('submits valid input as paise, then resets and announces success', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateLinkForm onCreate={onCreate} />)

    await user.type(amount(), '500')
    await user.type(description(), '  Invoice 42 ')
    await user.type(email(), 'Customer@Example.com')
    await user.click(submit())

    expect(onCreate).toHaveBeenCalledWith({
      amountPaise: 50_000,
      description: 'Invoice 42',
      email: 'customer@example.com',
      allowPartial: false,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Payment link for ₹500.00 created.')
    expect(amount()).toHaveValue('')
    expect(description()).toHaveValue('')
    expect(email()).toHaveValue('')
  })

  it('passes a valid future expiry through', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateLinkForm onCreate={onCreate} />)
    await user.type(amount(), '10')
    await user.type(description(), 'With expiry')
    await user.type(phone(), '9876543210')
    fireEvent.change(expiry(), { target: { value: localInput(24 * 60 * 60 * 1000) } })
    await user.click(submit())
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0][0].expiresAt).toBeGreaterThan(Date.now())
  })

  describe('partial payments', () => {
    const allowPartial = () => screen.getByLabelText('Allow partial payments')
    const minFirst = () => screen.getByLabelText('Minimum first payment (INR)')

    it('shows the minimum first payment input only while the box is ticked', async () => {
      const user = userEvent.setup()
      render(<CreateLinkForm onCreate={vi.fn()} />)
      expect(allowPartial()).not.toBeChecked()
      expect(screen.queryByLabelText('Minimum first payment (INR)')).not.toBeInTheDocument()

      await user.click(allowPartial())
      expect(minFirst()).toBeInTheDocument()

      await user.click(allowPartial())
      expect(screen.queryByLabelText('Minimum first payment (INR)')).not.toBeInTheDocument()
    })

    it('requires the minimum when ticked, and focuses it', async () => {
      const user = userEvent.setup()
      const onCreate = vi.fn()
      render(<CreateLinkForm onCreate={onCreate} />)
      await user.type(amount(), '500')
      await user.type(description(), 'Part')
      await user.type(email(), 'a@b.co')
      await user.click(allowPartial())
      await user.click(submit())

      expect(onCreate).not.toHaveBeenCalled()
      expect(minFirst()).toHaveFocus()
      expect(minFirst()).toHaveAttribute('aria-invalid', 'true')
      expect(minFirst()).toHaveAccessibleDescription(/Enter a minimum first payment/)
    })

    it.each([
      ['0', /greater than/],
      ['500.01', /cannot exceed the link amount/],
      ['1.005', /valid amount/],
    ])('rejects a minimum of %j', async (value, message) => {
      const user = userEvent.setup()
      render(<CreateLinkForm onCreate={vi.fn()} />)
      await user.type(amount(), '500')
      await user.click(allowPartial())
      await user.type(minFirst(), value)
      await user.tab()
      expect(minFirst()).toHaveAccessibleDescription(message)
    })

    it('does not validate (or send) the minimum when the box is not ticked', async () => {
      const user = userEvent.setup()
      const onCreate = vi.fn().mockResolvedValue(undefined)
      render(<CreateLinkForm onCreate={onCreate} />)
      await user.click(allowPartial())
      await user.type(minFirst(), 'garbage')
      await user.click(allowPartial()) // untick
      await user.type(amount(), '100')
      await user.type(description(), 'Whole')
      await user.type(email(), 'a@b.co')
      await user.click(submit())
      expect(onCreate).toHaveBeenCalledWith({
        amountPaise: 10_000,
        description: 'Whole',
        email: 'a@b.co',
        allowPartial: false,
      })
    })

    it('submits the minimum as integer paise', async () => {
      const user = userEvent.setup()
      const onCreate = vi.fn().mockResolvedValue(undefined)
      render(<CreateLinkForm onCreate={onCreate} />)
      await user.type(amount(), '500')
      await user.click(allowPartial())
      await user.type(minFirst(), '150.50')
      await user.type(description(), 'Part')
      await user.type(email(), 'a@b.co')
      await user.click(submit())
      expect(onCreate).toHaveBeenCalledWith({
        amountPaise: 50_000,
        description: 'Part',
        email: 'a@b.co',
        allowPartial: true,
        minFirstPaymentPaise: 15_050,
      })
      await screen.findByText(/created/)
      expect(allowPartial()).not.toBeChecked() // form reset
    })
  })

  it('shows an error with Retry on failure and keeps the entered values', async () => {
    const user = userEvent.setup()
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('Server down'))
      .mockResolvedValueOnce(undefined)
    render(<CreateLinkForm onCreate={onCreate} />)

    await user.type(amount(), '250')
    await user.type(description(), 'Keep me')
    await user.type(email(), 'a@b.co')
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down')
    expect(amount()).toHaveValue('250')
    expect(description()).toHaveValue('Keep me')
    expect(email()).toHaveValue('a@b.co')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(onCreate.mock.calls[1][0]).toEqual(onCreate.mock.calls[0][0])
    expect(await screen.findByRole('status')).toHaveTextContent('created')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(amount()).toHaveValue('')
  })
})
