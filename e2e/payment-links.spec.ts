import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/')
  await expect(page.getByText('No payment links yet')).toBeVisible()
}

async function fillAndCreate(
  page: Page,
  fields: { amount: string; description: string; email?: string; phone?: string; expiry?: string },
) {
  await page.getByLabel('Amount (INR)').fill(fields.amount)
  await page.getByLabel('Description').fill(fields.description)
  if (fields.email) await page.getByLabel('Customer email').fill(fields.email)
  if (fields.phone) await page.getByLabel('Customer phone').fill(fields.phone)
  if (fields.expiry) await page.getByLabel('Expiry (optional)').fill(fields.expiry)
  await page.getByRole('button', { name: 'Create payment link' }).click()
}

test('create -> appears in the list -> filter by status', async ({ page }) => {
  await open(page)

  await fillAndCreate(page, {
    amount: '1250.50',
    description: 'Consulting fee',
    email: 'buyer@example.com',
  })

  const row = page.getByRole('row', { name: /Consulting fee/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('₹1,250.50')
  await expect(row).toContainText('Active')
  await expect(page.getByRole('status').filter({ hasText: 'created' })).toBeVisible()

  await page.getByRole('button', { name: /^Paid/ }).click()
  await expect(page.getByText('No paid links')).toBeVisible()

  await page.getByRole('button', { name: /^Active/ }).click()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: /Mark as paid/ }).click()
  await expect(page.getByText('No active links')).toBeVisible()
  await page.getByRole('button', { name: /^Paid/ }).click()
  await expect(row).toContainText('Paid')
})

test('shows validation errors and blocks submission', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Create payment link' }).click()
  await expect(page.getByLabel('Amount (INR)')).toBeFocused()
  await expect(page.getByText('Enter an amount.')).toBeVisible()
  await expect(page.getByText('Enter a description.')).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(0)
})

test('a link flips to Expired when its expiry passes (page.clock)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-01T10:00:00') })
  await open(page)

  await fillAndCreate(page, {
    amount: '100',
    description: 'Short lived',
    phone: '9876543210',
    expiry: '2026-06-01T10:05',
  })

  const row = page.getByRole('row', { name: /Short lived/ })
  await expect(row.getByText('Active')).toBeVisible()
  await expect(row.getByRole('button', { name: /Mark as paid/ })).toBeVisible()

  await page.clock.fastForward('06:00')

  await expect(row.getByText('Expired', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: /Mark as paid/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Expired \(1\)/ })).toBeVisible()
})

test('can be used with the keyboard only', async ({ page }) => {
  await open(page)

  await page.getByLabel('Amount (INR)').focus()
  await page.keyboard.type('99.50')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Description')).toBeFocused()
  await page.keyboard.type('Keyboard link')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Customer email')).toBeFocused()
  await page.keyboard.type('kb@example.com')
  await page.keyboard.press('Enter') // implicit form submission

  const row = page.getByRole('row', { name: /Keyboard link/ })
  await expect(row).toContainText('₹99.50')

  const paidFilter = page.getByRole('button', { name: /^Paid/ })
  await paidFilter.focus()
  await page.keyboard.press('Enter')
  await expect(paidFilter).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('No paid links')).toBeVisible()
})

test.describe('360px viewport', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('has no horizontal scroll, even with long content', async ({ page }) => {
    await open(page)
    await fillAndCreate(page, {
      amount: '500000',
      description: 'x'.repeat(100),
      email: `${'long'.repeat(12)}@example-domain-name.com`,
      phone: '9876543210',
      expiry: '2099-01-01T10:00',
    })
    await expect(page.getByRole('row', { name: /xxxxxxxx/ })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
