import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createLinksApi } from './api/linksApi'
import type { PaymentLink } from './domain/types'
import { makeLink, makePayment } from './test/factories'

function setup(seed: PaymentLink[] = []) {
  const api = createLinksApi({ delayMs: 0, seed })
  const user = userEvent.setup()
  render(<App api={api} />)
  return { api, user }
}

async function createViaForm(user: ReturnType<typeof userEvent.setup>, amount: string, text: string) {
  await user.type(screen.getByLabelText('Amount (INR)'), amount)
  await user.type(screen.getByLabelText('Description'), text)
  await user.type(screen.getByLabelText('Customer email'), 'buyer@example.com')
  await user.click(screen.getByRole('button', { name: 'Create payment link' }))
  await screen.findByText(text)
}

const filterButton = (name: RegExp) => screen.getByRole('button', { name })

describe('App', () => {
  it('shows a loading state, then the empty state when there are no links', async () => {
    setup()
    expect(screen.getByText('Loading payment links…')).toBeInTheDocument()
    expect(await screen.findByText('No payment links yet')).toBeInTheDocument()
    expect(filterButton(/^All \(0\)/)).toBeInTheDocument()
  })

  it('creates a link, lists it as Active, and updates the filter counts', async () => {
    const { user } = setup()
    await screen.findByText('No payment links yet')

    await createViaForm(user, '1250.50', 'Consulting fee')

    const row = screen.getByRole('row', { name: /Consulting fee/ })
    expect(within(row).getByText('₹1,250.50')).toBeInTheDocument()
    expect(within(row).getByText('buyer@example.com')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(row.querySelector('time')).toHaveAttribute('datetime')
    expect(filterButton(/^All \(1\)/)).toBeInTheDocument()
    expect(filterButton(/^Active \(1\)/)).toBeInTheDocument()
    expect(screen.queryByText('No payment links yet')).not.toBeInTheDocument()
  })

  it('lists newest first', async () => {
    const { user } = setup()
    await screen.findByText('No payment links yet')
    await createViaForm(user, '1', 'First link')
    await createViaForm(user, '2', 'Second link')
    const rows = screen.getAllByRole('row').slice(1) // skip header row
    expect(rows[0]).toHaveTextContent('Second link')
    expect(rows[1]).toHaveTextContent('First link')
  })

  it('records the full due (prefilled) on a no-partial link, making it Paid, and filters by status', async () => {
    const { user } = setup()
    await screen.findByText('No payment links yet')
    await createViaForm(user, '100', 'Pay me')

    await user.click(screen.getByRole('button', { name: 'Record payment: Pay me' }))
    const input = screen.getByLabelText('Payment amount (INR)')
    expect(input).toHaveValue('100.00')
    expect(input).toHaveFocus()
    expect(input).toHaveAccessibleDescription(/Partial payments are not allowed/)
    await user.click(screen.getByRole('button', { name: 'Record' }))

    expect(await screen.findByText('Paid', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Record payment/ })).not.toBeInTheDocument()
    expect(filterButton(/^Paid \(1\)/)).toBeInTheDocument()
    expect(filterButton(/^Active \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('₹100.00 paid')).toBeInTheDocument()
    expect(screen.getByText('₹0.00 due')).toBeInTheDocument()

    await user.click(filterButton(/^Active/))
    expect(filterButton(/^Active/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('No active links')).toBeInTheDocument()
    expect(screen.queryByText('Pay me')).not.toBeInTheDocument()

    await user.click(filterButton(/^Paid/))
    expect(screen.getByText('Pay me')).toBeInTheDocument()
  })

  describe('partial payments', () => {
    async function createPartial(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Amount (INR)'), '500')
      await user.click(screen.getByLabelText('Allow partial payments'))
      await user.type(screen.getByLabelText('Minimum first payment (INR)'), '100')
      await user.type(screen.getByLabelText('Description'), 'Instalments')
      await user.type(screen.getByLabelText('Customer email'), 'buyer@example.com')
      await user.click(screen.getByRole('button', { name: 'Create payment link' }))
      await screen.findByText('Instalments')
    }

    it('walks Active -> Partially paid -> Paid with derived paid/due and the new filter', async () => {
      const { user } = setup()
      await screen.findByText('No payment links yet')
      await createPartial(user)

      expect(screen.getByText('₹0.00 paid')).toBeInTheDocument()
      expect(screen.getByText('₹500.00 due')).toBeInTheDocument()
      expect(screen.getByText('Min. first payment ₹100.00')).toBeInTheDocument()
      expect(filterButton(/^Partially paid \(0\)/)).toBeInTheDocument()

      // first payment below the minimum is rejected inline, with focus on the field
      await user.click(screen.getByRole('button', { name: 'Record payment: Instalments' }))
      const input = screen.getByLabelText('Payment amount (INR)')
      expect(input).toHaveValue('500.00')
      await user.clear(input)
      await user.type(input, '50')
      await user.click(screen.getByRole('button', { name: 'Record' }))
      expect(input).toHaveFocus()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription(/at least ₹100\.00/)

      // a valid part payment makes it Partially paid
      await user.clear(input)
      await user.type(input, '200')
      await user.click(screen.getByRole('button', { name: 'Record' }))
      expect(await screen.findByText('Partially paid', { selector: 'span' })).toBeInTheDocument()
      expect(screen.getByText('₹200.00 paid')).toBeInTheDocument()
      expect(screen.getByText('₹300.00 due')).toBeInTheDocument()
      expect(screen.queryByText(/Min. first payment/)).not.toBeInTheDocument()
      expect(filterButton(/^Partially paid \(1\)/)).toBeInTheDocument()
      expect(filterButton(/^Active \(0\)/)).toBeInTheDocument()

      await user.click(filterButton(/^Partially paid/))
      expect(screen.getByText('Instalments')).toBeInTheDocument()

      // over-paying is rejected; the rest makes it Paid
      await user.click(screen.getByRole('button', { name: 'Record payment: Instalments' }))
      const second = screen.getByLabelText('Payment amount (INR)')
      expect(second).toHaveValue('300.00')
      await user.clear(second)
      await user.type(second, '300.01')
      await user.click(screen.getByRole('button', { name: 'Record' }))
      expect(second).toHaveAccessibleDescription(/cannot exceed the amount due \(₹300\.00\)/)
      await user.clear(second)
      await user.type(second, '300')
      await user.click(screen.getByRole('button', { name: 'Record' }))

      expect(await screen.findByText('No partially paid links')).toBeInTheDocument()
      await user.click(filterButton(/^Paid/))
      expect(screen.getByText('₹500.00 paid')).toBeInTheDocument()
      expect(screen.getByText('₹0.00 due')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Record payment/ })).not.toBeInTheDocument()
    })

    it('rejects a part payment on a link that does not allow partial payments', async () => {
      const { user } = setup()
      await screen.findByText('No payment links yet')
      await createViaForm(user, '100', 'Whole only')
      await user.click(screen.getByRole('button', { name: 'Record payment: Whole only' }))
      const input = screen.getByLabelText('Payment amount (INR)')
      await user.clear(input)
      await user.type(input, '40')
      await user.click(screen.getByRole('button', { name: 'Record' }))
      expect(input).toHaveAccessibleDescription(/does not allow partial payments/)
      expect(screen.getByText('Active', { selector: 'span' })).toBeInTheDocument()
    })

    it('cancelling (button or Escape) closes the form and returns focus to its trigger', async () => {
      const { user } = setup()
      await screen.findByText('No payment links yet')
      await createViaForm(user, '100', 'Cancel me')
      const trigger = () => screen.getByRole('button', { name: 'Record payment: Cancel me' })

      await user.click(trigger())
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByLabelText('Payment amount (INR)')).not.toBeInTheDocument()
      expect(trigger()).toHaveFocus()

      await user.click(trigger())
      await user.keyboard('{Escape}')
      expect(screen.queryByLabelText('Payment amount (INR)')).not.toBeInTheDocument()
      expect(trigger()).toHaveFocus()
    })

    it('shows Expired (not Partially paid) once the expiry passes, and offers no payment action', async () => {
      const now = Date.now()
      setup([
        makeLink({
          id: 'x',
          amountPaise: 1000,
          description: 'Lapsed part-payer',
          email: 'a@b.co',
          allowPartial: true,
          createdAt: now - 5000,
          expiresAt: now - 1000,
          payments: [makePayment(400, now - 3000)],
        }),
      ])
      const row = await screen.findByRole('row', { name: /Lapsed part-payer/ })
      expect(within(row).getByText('Expired', { selector: 'span' })).toBeInTheDocument()
      expect(within(row).getByText('₹4.00 paid')).toBeInTheDocument()
      expect(within(row).getByText('₹6.00 due')).toBeInTheDocument()
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
      expect(filterButton(/^Partially paid \(0\)/)).toBeInTheDocument()
      expect(filterButton(/^Expired \(1\)/)).toBeInTheDocument()
    })
  })

  it('shows links whose expiry has passed as Expired, without a Record payment button', async () => {
    const now = Date.now()
    const { user } = setup([
      makeLink({ id: 'e', amountPaise: 100, description: 'Old link', email: 'a@b.co', createdAt: now - 5000, expiresAt: now - 1000 }),
      makeLink({ id: 'a', amountPaise: 200, description: 'Live link', email: 'a@b.co', createdAt: now - 4000 }),
      makeLink({ id: 'p', amountPaise: 300, description: 'Paid late', email: 'a@b.co', createdAt: now - 3000, expiresAt: now - 500, payments: [makePayment(300, now - 2000)] }),
    ])
    await screen.findByText('Old link')

    const expiredRow = screen.getByRole('row', { name: /Old link/ })
    expect(within(expiredRow).getByText('Expired')).toBeInTheDocument()
    expect(within(expiredRow).queryByRole('button')).not.toBeInTheDocument()
    // Paid stays Paid after expiry
    expect(within(screen.getByRole('row', { name: /Paid late/ })).getByText('Paid')).toBeInTheDocument()
    expect(filterButton(/^All \(3\)/)).toBeInTheDocument()
    expect(filterButton(/^Expired \(1\)/)).toBeInTheDocument()

    await user.click(filterButton(/^Expired/))
    expect(screen.getByText('Old link')).toBeInTheDocument()
    expect(screen.queryByText('Live link')).not.toBeInTheDocument()
  })

  it('shows an error with Retry when loading fails', async () => {
    const api = createLinksApi({ delayMs: 0 })
    api.failNext()
    const user = userEvent.setup()
    render(<App api={api} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No payment links yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the form values and offers Retry when creating fails', async () => {
    const { api, user } = setup()
    await screen.findByText('No payment links yet')
    api.failNext()

    await user.type(screen.getByLabelText('Amount (INR)'), '75')
    await user.type(screen.getByLabelText('Description'), 'Flaky')
    await user.type(screen.getByLabelText('Customer phone'), '9876543210')
    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (INR)')).toHaveValue('75')
    expect(screen.getByLabelText('Description')).toHaveValue('Flaky')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Flaky')).toBeInTheDocument()
    expect(screen.getByText('+91 9876543210')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (INR)')).toHaveValue('')
  })

  it('shows an error with Retry when recording a payment fails, then succeeds on Retry', async () => {
    const { api, user } = setup()
    await screen.findByText('No payment links yet')
    await createViaForm(user, '10', 'Will fail once')

    api.failNext()
    await user.click(screen.getByRole('button', { name: /Record payment/ }))
    await user.click(screen.getByRole('button', { name: 'Record' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Active', { selector: 'span' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Paid', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
