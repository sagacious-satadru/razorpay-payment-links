import { expect, test } from '@playwright/test'

test('partial payment: create -> record part -> Partially paid -> reload -> pay the rest -> Paid', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('No payment links yet')).toBeVisible()

  // Create a link that allows partial payments (min first payment ₹100)
  await page.getByLabel('Amount (INR)').fill('500')
  await page.getByLabel('Allow partial payments').check()
  await page.getByLabel('Minimum first payment (INR)').fill('100')
  await page.getByLabel('Description').fill('Instalments')
  await page.getByLabel('Customer email').fill('buyer@example.com')
  await page.getByRole('button', { name: 'Create payment link' }).click()

  const row = page.getByRole('row', { name: /Instalments/ })
  await expect(row.getByText('Active', { exact: true })).toBeVisible()
  await expect(row).toContainText('₹0.00 paid')
  await expect(row).toContainText('₹500.00 due')

  // A first payment below the minimum is rejected inline
  await row.getByRole('button', { name: /Record payment/ }).click()
  await row.getByLabel('Payment amount (INR)').fill('50')
  await row.getByRole('button', { name: 'Record', exact: true }).click()
  await expect(row.getByText(/at least ₹100\.00/)).toBeVisible()

  // A valid part payment -> Partially paid
  await row.getByLabel('Payment amount (INR)').fill('200')
  await row.getByRole('button', { name: 'Record', exact: true }).click()
  await expect(row.getByText('Partially paid', { exact: true })).toBeVisible()
  await expect(row).toContainText('₹200.00 paid')
  await expect(row).toContainText('₹300.00 due')
  await expect(page.getByRole('button', { name: /^Partially paid \(1\)/ })).toBeVisible()

  // Reload: the link and its payment are still there (localStorage)
  await page.reload()
  await expect(row.getByText('Partially paid', { exact: true })).toBeVisible()
  await expect(row).toContainText('₹200.00 paid')
  await expect(row).toContainText('₹300.00 due')
  await expect(page.getByRole('button', { name: /^All \(1\)/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Partially paid \(1\)/ })).toBeVisible()

  // Pay the rest (prefilled with the due) -> Paid
  await row.getByRole('button', { name: /Record payment/ }).click()
  await expect(row.getByLabel('Payment amount (INR)')).toHaveValue('300.00')
  await row.getByRole('button', { name: 'Record', exact: true }).click()
  await expect(row.getByText('Paid', { exact: true })).toBeVisible()
  await expect(row).toContainText('₹500.00 paid')
  await expect(row).toContainText('₹0.00 due')
  await expect(row.getByRole('button', { name: /Record payment/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Paid \(1\)/ })).toBeVisible()

  // ...and Paid survives another reload
  await page.reload()
  await expect(row.getByText('Paid', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Partially paid \(0\)/ })).toBeVisible()
})
