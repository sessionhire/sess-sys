import type { Locator } from '@playwright/test'

/** Types a whole name into a person's form, which asks for it in two (ADR 0066): the first word, and the rest as the last name. */
export async function fillName(form: Locator, name: string) {
  const [first = '', ...rest] = name.trim().split(' ')
  await form.getByLabel('First name').fill(first)
  await form.getByLabel('Last name').fill(rest.join(' '))
}

/**
 * Picks one record in a record picker (UX sweep, move 5c): types what's given into the combobox and takes the offer whose name
 * starts with it, as a person would.
 */
export async function pickRecord(scope: Locator, label: string, name: string) {
  await scope.getByRole('combobox', { name: label }).fill(name)
  await scope.getByRole('option').filter({ has: scope.page().locator('span', { hasText: name }) }).first().click()
}
