const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(epochMs: number): string {
  return dateTime.format(new Date(epochMs))
}

export function formatPhone(tenDigits: string): string {
  return `+91 ${tenDigits}`
}
