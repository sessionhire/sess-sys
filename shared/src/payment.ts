/**
 * A freelancer's details for paying them (Colly, 23 November 2026: "provide a VAT or PPSN as well as bank details for
 * invoicing ... so that payroll can be streamlined"), ADR 0193. Given on the Apply page or typed in by the office, kept
 * locked on the server (sealed, as the calendar's key is), never in the change feed, and read only by those who see
 * money (directors and the office), shown masked until they ask to see them in full. Invoicing waits: these are kept,
 * not used, until the office says how it pays people.
 */

export interface PaymentDetails {
  /** Their PPS number, as 1234567FA. */
  ppsn: string
  /** Their VAT number, if they're registered, as IE1234567T. */
  vatNumber: string
  /** The name on the bank account. */
  accountName: string
  /** The account's IBAN, without spaces, as IE29AIBK93115212345678. */
  iban: string
  /** The bank's BIC, as AIBKIE2D; optional, as an IBAN in the euro area is enough. */
  bic: string
}

export type PaymentField = keyof PaymentDetails

export const NO_PAYMENT_DETAILS: PaymentDetails = { ppsn: '', vatNumber: '', accountName: '', iban: '', bic: '' }

/** What a reader who sees money gets back without asking for them in full: enough to tell which, not enough to use. */
export interface PaymentDetailsShown {
  /** Whether any are kept. */
  kept: boolean
  /** Masked, or in full when asked for. */
  details: PaymentDetails
  /** Whether `details` is in full. */
  full: boolean
  /** When they were last given or changed, and by whom ("The Apply page", or a person's name). */
  changedAt?: string
  changedBy?: string
}

const squash = (s: string) => s.replace(/[\s.-]+/g, '').toUpperCase()

const LETTERS = 'WABCDEFGHIJKLMNOPQRSTUV'

/**
 * A PPS number checked by its own check letter (Revenue's: seven digits weighted 8 to 2, the second letter's place in
 * the alphabet weighted 9, the sum's remainder over 23 as a letter, 0 being W).
 */
export function isPpsn(typed: string): boolean {
  const t = squash(typed)
  const m = /^(\d{7})([A-W])([A-IW]?)$/.exec(t)
  if (!m) return false
  const digits = m[1]!.split('').reduce((sum, d, i) => sum + Number(d) * (8 - i), 0)
  const second = m[3] && m[3] !== 'W' ? (m[3].charCodeAt(0) - 64) * 9 : 0
  return LETTERS[(digits + second) % 23] === m[2]
}

/** An IBAN checked by its two check digits (ISO 13616: the country and check moved to the end, letters as numbers, mod 97 is 1). */
export function isIban(typed: string): boolean {
  const t = squash(typed)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(t)) return false
  const moved = t.slice(4) + t.slice(0, 4)
  let rest = 0
  for (const c of moved) {
    const n = c >= 'A' ? String(c.charCodeAt(0) - 55) : c
    for (const d of n) rest = (rest * 10 + Number(d)) % 97
  }
  return rest === 1
}

export const isBic = (typed: string) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(squash(typed))
/** A VAT number: letters and digits, the country's letters first or not, as the office's own is read. */
export const isVatNumber = (typed: string) => /^[A-Z0-9+*]{4,16}$/.test(squash(typed))

/** An IBAN in groups of four, as a bank prints it: IE29 AIBK 9311 5212 3456 78. */
export const ibanShown = (iban: string) => squash(iban).replace(/(.{4})(?=.)/g, '$1 ')

/** The details as typed, read: tidied, or what's wrong with each, in the form's own words. Nothing at all is fine. */
export function readPaymentDetails(typed: Partial<PaymentDetails>): { ok: true; details: PaymentDetails } | { ok: false; errors: Partial<Record<PaymentField, string>> } {
  const errors: Partial<Record<PaymentField, string>> = {}
  const ppsn = squash(typed.ppsn ?? '')
  const vatNumber = squash(typed.vatNumber ?? '')
  const accountName = (typed.accountName ?? '').replace(/\s+/g, ' ').trim().slice(0, 100)
  const iban = squash(typed.iban ?? '')
  const bic = squash(typed.bic ?? '')
  if (ppsn && !isPpsn(ppsn)) errors.ppsn = "That isn't a PPS number: seven numbers then one or two letters, such as 1234567FA."
  if (vatNumber && !isVatNumber(vatNumber)) errors.vatNumber = 'A VAT number is letters and numbers, such as IE1234567T.'
  if (iban && !isIban(iban)) errors.iban = "That IBAN doesn't add up. Copy it from your banking app or a bank statement, such as IE29 AIBK 9311 5212 3456 78."
  if (bic && !isBic(bic)) errors.bic = 'A BIC is 8 or 11 letters and numbers, such as AIBKIE2D.'
  if ((accountName || bic) && !iban) errors.iban = 'Put in the IBAN as well, or leave the bank details empty.'
  if (iban && !accountName) errors.accountName = 'Put in the name on the account as well.'
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, details: { ppsn, vatNumber, accountName, iban, bic } }
}

export const hasPaymentDetails = (d: PaymentDetails) => Object.values(d).some((v) => !!v)

/** Masked: a PPS number's last three, an IBAN's country and last four; the name, BIC and VAT number as they are, as they're on every invoice. */
export function maskPaymentDetails(d: PaymentDetails): PaymentDetails {
  const dots = (n: number) => '•'.repeat(Math.max(0, n))
  return {
    ppsn: d.ppsn ? `${dots(d.ppsn.length - 3)}${d.ppsn.slice(-3)}` : '',
    vatNumber: d.vatNumber,
    accountName: d.accountName,
    iban: d.iban ? `${d.iban.slice(0, 2)}•• •••• … ${d.iban.slice(-4)}` : '',
    bic: d.bic,
  }
}

/**
 * Where someone's payment details stand, for the places the paying is done (user flows of 24 November 2026, gap 8):
 * whether any are held, when they last changed, and whether that was on their own page, from a link. Never the details.
 */
export interface PaymentStanding {
  personId: string
  /** When they were last given or changed. */
  changedAt: string
  /** Changed by them on their own page: a link can be passed on, the usual way money goes to the wrong account. */
  own: boolean
}

export interface PaymentLine {
  text: string
  /** `warn` asks for a phone call before paying; `ask` is something to get; `quiet` needs nothing. */
  tone: 'quiet' | 'ask' | 'warn'
}

/**
 * The one line a row carries where someone decides to pay: "Payment details held", "No payment details yet: ask for
 * them", or, when they were changed on their own page and nothing has been marked paid since, "Payment details changed
 * on their own page 21 Nov: ring before paying". Once a payment is marked paid after the change, the office has paid to
 * that account, and the line is quiet again.
 */
export function paymentLine(st: PaymentStanding | undefined, lastPaidOn: string | undefined, day: (iso: string) => string): PaymentLine {
  if (!st) return { text: 'No payment details yet: ask for them', tone: 'ask' }
  const changed = st.changedAt.slice(0, 10)
  if (st.own && (!lastPaidOn || lastPaidOn <= changed)) return { text: `Payment details changed on their own page ${day(changed)}: ring before paying`, tone: 'warn' }
  return { text: 'Payment details held', tone: 'quiet' }
}
