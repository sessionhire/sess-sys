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
    copy.querySelectorAll('input, select, textarea, small, .hint').forEach((n) => n.remove())
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
  }
}

/** Lines left behind by a field the screen has since taken away. */
function sweep() {
  document.querySelectorAll<HTMLElement>(`.${LINE}`).forEach((line) => {
    if (!document.querySelector(`[data-refusal="${line.id}"]`)) line.remove()
  })
}

function refuse(field: Field) {
  clear(field)
  sweep()
  const line = document.createElement('span')
  line.id = `${LINE}-${++count}`
  line.className = `alert ${LINE}`
  line.setAttribute('role', 'alert')
  line.textContent = sayWhatsNeeded(field)
  // After the field, or after the label round it, so the line sits under what it's about.
  const label = field.closest('label')
  ;(label ?? field).after(line)
  field.dataset.refusal = line.id
  field.setAttribute('aria-invalid', 'true')
  field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), line.id].filter(Boolean).join(' '))
}

export function refuseEmptyFieldsInWords() {
  document.addEventListener(
    'invalid',
    (e) => {
      const field = e.target as Field
      if (!field.validity?.valueMissing) return
      e.preventDefault()
      refuse(field)
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
    if (field instanceof HTMLElement && field.dataset.refusal && field.validity?.valid !== false) clear(field)
  }
  document.addEventListener('input', settle, true)
  document.addEventListener('change', settle, true)
  // A form emptied takes its lines with it, and moving to another screen any left behind.
  document.addEventListener('reset', (e) => (e.target as HTMLFormElement).querySelectorAll<Field>('[data-refusal]').forEach(clear), true)
  addEventListener('hashchange', sweep)
}
