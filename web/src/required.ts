/**
 * An empty field a form needs, refused in the app's own words and look rather
 * than the browser's bubble (audit, 5 November 2026, finding 85). The bubble
 * was in the browser's language, gone in a few seconds, and told a screen
 * reader nothing. Every form keeps its `required` fields as they are: this
 * catches the browser's refusal for the whole app, puts the focus on the
 * first empty field, marks it aria-invalid and says beside it, in a lasting
 * alert line like the app's other refusals (act.tsx), what to fill in. Typing
 * in it takes the line away.
 */

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const LINE = 'field-refusal'

/** The words its label shows, without the field's own (a label round a select holds the options' words too). */
function nameOf(field: Field): string {
  const label = field.labels?.[0]
  let words = ''
  if (label) {
    const copy = label.cloneNode(true) as HTMLElement
    copy.querySelectorAll('input, select, textarea, small, .hint, .optional').forEach((n) => n.remove())
    words = copy.textContent ?? ''
  }
  words = (words || field.getAttribute('aria-label') || '').replace(/\s+/g, ' ').replace(/[\s:*]+$/, '').trim()
  return words
}

/** "Name" → "the name"; "VAT number" keeps its capitals. */
const the = (words: string) => `the ${/^[A-Z][a-z]/.test(words) ? words[0]!.toLowerCase() + words.slice(1) : words}`

export function sayWhatsNeeded(field: Field): string {
  const words = nameOf(field)
  if (field instanceof HTMLSelectElement) return words ? `Choose ${the(words)} first.` : 'Choose one first.'
  if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) return words ? `Tick ${the(words)} first.` : 'Tick it first.'
  if (field instanceof HTMLInputElement && field.type === 'file') return 'Choose a file first.'
  return words ? `Fill in ${the(words)} first.` : 'Fill this in first.'
}

/**
 * A number out of its bounds, said in the same voice (UX sweep, 6 November 2026, move 5): a 0 in "How many" was let
 * through the browser's bubble with nothing said in the app's words. The field's own min, max and step say what's
 * wanted, so each form needs nothing new.
 */
export function sayWhatsWrong(field: Field): string | undefined {
  if (!(field instanceof HTMLInputElement) || field.type !== 'number') return undefined
  const v = field.validity
  const words = nameOf(field)
  const name = words ? `${words[0]!.toUpperCase()}${words.slice(1)}` : 'This'
  const whole = field.step === '' || field.step === '1'
  if (v.badInput) return `${name} has to be a number.`
  if (v.rangeUnderflow) return `${name} has to be at least ${field.min}.`
  if (v.rangeOverflow) return `${name} can be ${field.max} at most.`
  if (v.stepMismatch) return whole ? `${name} has to be a whole number.` : `${name} goes up in steps of ${field.step}.`
  return undefined
}

let count = 0
let focusedOne = false

function clear(field: Field) {
  // Only a line this put there: an aria-invalid the screen set itself is the screen's.
  const id = field.dataset.refusal
  if (id) {
    field.removeAttribute('aria-invalid')
    document.getElementById(id)?.remove()
    const rest = (field.getAttribute('aria-describedby') ?? '').split(' ').filter((x) => x && x !== id)
    if (rest.length) field.setAttribute('aria-describedby', rest.join(' '))
    else field.removeAttribute('aria-describedby')
    delete field.dataset.refusal
    delete field.dataset.refusedBy
    summarise(field.form)
  }
}

const SUMMARY = 'form-problems'

/** The form's submit button, whose words say what the person was trying to do. */
const submitOf = (form: HTMLFormElement) => form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])')

/**
 * Everything a form needs sorting before it can go, said beside the button that was pressed (Colly, 11 November 2026):
 * on a phone the fields at fault can be scrolled out of sight above, so a press that did nothing looked like a broken
 * button. One line for each field, in the order they're in the form, each a press away from its field; the line under
 * the field says it again where it's fixed. It goes when the last of them is put right.
 */
function summarise(form: HTMLFormElement | null) {
  if (!form) return
  const fields = [...form.querySelectorAll<Field>('[data-refusal]')]
  const box = form.querySelector<HTMLElement>(`.${SUMMARY}`)
  if (!fields.length) return void box?.remove()
  const button = submitOf(form)
  const summary = box ?? document.createElement('div')
  summary.className = `alert ${SUMMARY}`
  summary.setAttribute('role', 'group')
  const doing = button?.textContent?.trim()
  // Not read out again as it comes: each field's own line is, and the focus is on the first.
  summary.setAttribute('aria-label', 'To sort first')
  summary.replaceChildren()
  const head = document.createElement('p')
  const b = document.createElement('b')
  b.textContent = `${fields.length === 1 ? 'One thing' : `${fields.length} things`} to sort${doing ? ` before “${doing}”` : ' first'}:`
  head.append(b)
  const list = document.createElement('ul')
  for (const field of fields) {
    const li = document.createElement('li')
    const go = document.createElement('button')
    go.type = 'button'
    go.className = 'link'
    // The field's own line, after the field's name where the line doesn't say it ("Day rate: Put in a price like 250").
    const words = document.getElementById(field.dataset.refusal!)?.textContent ?? ''
    const name = nameOf(field).replace(/[^\p{L}\p{N})]+$/u, '')
    go.textContent = name && name.length <= 30 && !words.toLowerCase().includes(name.toLowerCase()) ? `${name}: ${words}` : words
    go.addEventListener('click', () => {
      field.scrollIntoView({ block: 'center', behavior: 'smooth' })
      field.focus({ preventScroll: true })
    })
    li.append(go)
    list.append(li)
  }
  summary.append(head, list)
  if (!box) {
    if (button) button.after(summary)
    else form.append(summary)
  }
}

/** Lines left behind by a field the screen has since taken away. */
function sweep() {
  document.querySelectorAll<HTMLElement>(`.${LINE}`).forEach((line) => {
    if (!document.querySelector(`[data-refusal="${line.id}"]`)) line.remove()
  })
}

function refuse(field: Field, words = sayWhatsNeeded(field), by?: 'form') {
  clear(field)
  sweep()
  const line = document.createElement('span')
  line.id = `${LINE}-${++count}`
  line.className = `alert ${LINE}`
  line.setAttribute('role', 'alert')
  line.textContent = words
  // After the field, or after the label round it, so the line sits under what it's about.
  const label = field.closest('label')
  ;(label ?? field).after(line)
  field.dataset.refusal = line.id
  if (by) field.dataset.refusedBy = by
  field.setAttribute('aria-invalid', 'true')
  field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), line.id].filter(Boolean).join(' '))
  const form = field.form
  queueMicrotask(() => summarise(form))
}

/**
 * A form's own check, one the browser can't make (a rate it can't read, a reply-by day after the job, nobody chosen to
 * offer to), said on the field it's about as an empty field is: the line under it, the field marked, the focus on it,
 * and the summary by the button. It goes on the next thing typed or picked in that field, or with `settleRefusals`.
 * Returns false, so a form's check reads `return refuseField(...)`.
 */
export function refuseField(form: HTMLFormElement | null | undefined, selector: string, words: string, { focus = true } = {}): false {
  const field = form?.querySelector<Field>(selector)
  if (!field) return false
  refuse(field, words, 'form')
  if (focus) {
    field.scrollIntoView({ block: 'center', behavior: 'smooth' })
    field.focus({ preventScroll: true })
  }
  return false
}

/** Takes a form's own refusals away, as when what they were about changes some other way than typing in the field. */
export function settleRefusals(form: HTMLFormElement | null | undefined) {
  form?.querySelectorAll<Field>('[data-refused-by="form"]').forEach(clear)
}

export function refuseEmptyFieldsInWords() {
  document.addEventListener(
    'invalid',
    (e) => {
      const field = e.target as Field
      const wrong = field.validity?.valueMissing ? undefined : sayWhatsWrong(field)
      if (!field.validity?.valueMissing && !wrong) return
      e.preventDefault()
      refuse(field, wrong)
      // The browser fires one for every empty field at once: the focus goes to the first.
      if (!focusedOne) {
        focusedOne = true
        field.focus()
        queueMicrotask(() => (focusedOne = false))
      }
    },
    true,
  )
  const settle = (e: Event) => {
    const field = e.target as Field
    // A form's own refusal goes on the next thing typed in its field; the form checks again when it's sent.
    if (field instanceof HTMLElement && field.dataset.refusal && (field.dataset.refusedBy === 'form' || field.validity?.valid !== false)) clear(field)
  }
  document.addEventListener('input', settle, true)
  document.addEventListener('change', settle, true)
  // A form emptied takes its lines with it, and moving to another screen any left behind.
  document.addEventListener('reset', (e) => (e.target as HTMLFormElement).querySelectorAll<Field>('[data-refusal]').forEach(clear), true)
  addEventListener('hashchange', sweep)
  // A wheel over a focused number field scrolls the page, never changes the number under the pointer (UX sweep, move 5).
  document.addEventListener(
    'wheel',
    (e) => {
      const t = e.target
      if (t instanceof HTMLInputElement && t.type === 'number' && t === document.activeElement) t.blur()
    },
    { passive: true, capture: true },
  )
}
