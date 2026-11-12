import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createLinksApi } from './api/linksApi'
import type { PaymentLink } from './domain/types'

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

  it('marks a link as paid and filters by status', async () => {
    const { user } = setup()
    await screen.findByText('No payment links yet')
    await createViaForm(user, '100', 'Pay me')

    await user.click(screen.getByRole('button', { name: /Mark as paid: Pay me/ }))
    expect(await screen.findByText('Paid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mark as paid/ })).not.toBeInTheDocument()
    expect(filterButton(/^Paid \(1\)/)).toBeInTheDocument()
    expect(filterButton(/^Active \(0\)/)).toBeInTheDocument()

    await user.click(filterButton(/^Active/))
    expect(filterButton(/^Active/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('No active links')).toBeInTheDocument()
    expect(screen.queryByText('Pay me')).not.toBeInTheDocument()

    await user.click(filterButton(/^Paid/))
    expect(screen.getByText('Pay me')).toBeInTheDocument()
  })

  it('shows links whose expiry has passed as Expired, without a Mark as paid button', async () => {
    const now = Date.now()
    const { user } = setup([
      { id: 'e', amountPaise: 100, description: 'Old link', email: 'a@b.co', createdAt: now - 5000, expiresAt: now - 1000 },
      { id: 'a', amountPaise: 200, description: 'Live link', email: 'a@b.co', createdAt: now - 4000 },
      { id: 'p', amountPaise: 300, description: 'Paid late', email: 'a@b.co', createdAt: now - 3000, expiresAt: now - 500, paidAt: now - 2000 },
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

  it('shows an error with Retry when marking as paid fails', async () => {
    const { api, user } = setup()
    await screen.findByText('No payment links yet')
    await createViaForm(user, '10', 'Will fail once')

    api.failNext()
    await user.click(screen.getByRole('button', { name: /Mark as paid/ }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Paid')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
