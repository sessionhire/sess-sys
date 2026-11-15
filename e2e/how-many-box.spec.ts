import { expect, test } from '@playwright/test'
import { askForCrewOn, asked, jobWithPhase } from './ask.ts'

/**
 * A How many box can be emptied to type another number (Colly, 14 November 2026): held as a number, an emptied box became 0
 * and typing 2 after it gave "02". Typed key by key, as a person does, since fill() would set the value over the trap.
 */
test('the How many box on Add a role and Change the call can be cleared and retyped', async ({ page, request }) => {
  const jobId = await jobWithPhase(request, { name: 'How many box', start: '2030-09-12' })
  const form = await askForCrewOn(page, jobId)
  await form.getByLabel('Role').fill('Rigger')
  const many = form.getByLabel('How many')
  await many.click()
  await many.press('End')
  await many.press('Backspace')
  await expect(many).toHaveValue('')
  await many.pressSequentially('2')
  await expect(many).toHaveValue('2')

  // Left empty, the press says so on the box rather than adding a role for some other number.
  await many.press('Backspace')
  await form.getByRole('button', { name: 'Add role' }).click()
  await expect(form).toBeVisible()
  await expect(many).toHaveAccessibleDescription('How many is a whole number from 1 to 100.')
  await expect(many).toBeFocused()
  await many.pressSequentially('3')
  await form.getByRole('button', { name: 'Add role' }).click()
  await asked(page)
  await expect(page.getByRole('article', { name: '3 × Rigger' })).toBeVisible()

  // Change the call keeps the same habit.
  const call = page.getByRole('article', { name: '3 × Rigger' })
  await call.locator('.call-line').click()
  await call.getByRole('button', { name: 'Change', exact: true }).click()
  const change = page.getByRole('form', { name: 'Change the call for Rigger' })
  const again = change.getByLabel('How many')
  await again.click()
  await again.press('End')
  await again.press('Backspace')
  await expect(again).toHaveValue('')
  await again.pressSequentially('4')
  await expect(again).toHaveValue('4')
  await change.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('article', { name: '4 × Rigger' })).toBeVisible()
})
