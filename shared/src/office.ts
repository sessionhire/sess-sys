import { z } from 'zod'
import { cableColourList } from './cable-colours.ts'
import { day } from './day.ts'
import { cleanText, text } from './plain.ts'

/**
 * The office's own details (audit finding 10): the name, phone and email
 * shown on every freelancer page, so someone booked has a way back to the
 * office without the app. They are one setting record, with the id
 * "office"; other settings can join it later under ids of their own. The
 * company's VAT number and address are on it too, for the printed quote
 * (ADR 0042's open item), and nowhere on the freelancers' pages.
 */

const id = z.string().min(1).max(64)
const phone = z.string().regex(/^\+?[0-9 ()-]{6,40}$/, 'Phone numbers need digits only, ideally starting with +353.')
/** An Irish VAT number such as IE 1234567T, or another country's: letters, digits and spaces. */
const vatNumber = z.string().trim().regex(/^[A-Za-z0-9 ]{4,20}$/, 'A VAT number is letters and digits, such as IE 1234567T.')
/** The company's postal address, a line each as written. */
export const ADDRESS_LENGTH = 300
/** A company's number at the Companies Registration Office: digits only, six for most companies today. */
const croNumber = z.string().trim().regex(/^\d{1,8}$/, 'A CRO number is digits only, such as 612345.')
/** The directors' names, as they're to be printed: "Aoife Byrne, Colm Hewson". */
export const DIRECTORS_LENGTH = 300
/** What the company trades as, until the office says otherwise. */
export const TRADING_NAME = 'Session Hire'

export const OFFICE_SETTING_ID = 'office'
/** What the office's block is headed until the office names it. */
export const OFFICE_NAME = 'Session Hire office'
/** What heads of department read (ADR 0046): the second setting, with only `headsSeeRates` to it. */
export const READING_SETTING_ID = 'reading'
/** Whether the app prompts messages to crew (ADR 0048): the third setting, with only `promptMessages` to it. */
export const MESSAGES_SETTING_ID = 'messages'
/** Whether the company uses timesheets (ADR 0090): the fourth setting, with only `useTimesheets` to it. */
export const TIMESHEETS_SETTING_ID = 'timesheets'
/** Whether Claude is offered inside the app (ADR 0096): the fifth setting, with only `useAssistant` to it. */
export const ASSISTANT_SETTING_ID = 'assistant'
/** The colour each cable length takes (ADR 0106): the sixth setting, with only `cableColours` to it. */
export const CABLES_SETTING_ID = 'cables'
/** The company's logo on labels (ADR 0106): the seventh setting, with only `logo` to it, put up as a photo is. */
export const LOGO_SETTING_ID = 'logo'
/** Whether a freelancer's link asks for a code on a phone it hasn't seen (ADR 0114): the eighth setting, with only `checkLinks` to it. */
export const LINKS_SETTING_ID = 'links'
/** Whether offers go to crew on WhatsApp by themselves (ADR 0125): the ninth setting, with only `whatsapp` and `whatsappTestTo` to it. */
export const WHATSAPP_SETTING_ID = 'whatsapp'

/** Offers on WhatsApp (ADR 0125): off; only to the numbers listed, for trying it out; or to everyone who hasn't turned them off. */
export const WHATSAPP_MODES = ['off', 'test', 'on'] as const
export type WhatsAppMode = (typeof WHATSAPP_MODES)[number]
/** At most this many numbers to try WhatsApp on, as Meta's own test number allows. */
export const WHATSAPP_TEST_MAX = 5

/**
 * A mobile as WhatsApp addresses it: digits only, country code first, an Irish 08x made +3538x (as wa.me wants, see
 * whatsappNumber in crew.ts). Undefined when what's left can't be a mobile: fewer than 8 or more than 15 digits.
 */
export function whatsappDigits(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined
  let digits = phone.replace(/[^0-9+]/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('0')) digits = `353${digits.slice(1)}`
  digits = digits.replace(/\+/g, '')
  return /^\d{8,15}$/.test(digits) ? digits : undefined
}

const testNumber = z
  .string()
  .trim()
  .max(40)
  .refine((n) => whatsappDigits(n) !== undefined, { message: 'A number to try WhatsApp on needs its country code, such as +353 87 123 4567.' })

export const setting = z.object({
  id,
  /** What the block is headed, such as "Session Hire office". */
  name: z.string().max(200),
  phone: phone.nullable(),
  email: z.string().email().max(200).nullable(),
  /** On the "office" setting, once one is saved: the company's VAT number and address, printed on quotes. */
  vatNumber: z.string().max(20).nullable().optional(),
  address: z.string().max(ADDRESS_LENGTH).nullable().optional(),
  /**
   * On the "office" setting, once saved (ADR 0181): the company as the law knows it, for the foot of every quote. What
   * it trades as ("Session Hire"), its registered name ("Session Hire Productions Limited"), its number at the CRO, its
   * registered office, and its directors.
   */
  tradingName: z.string().max(200).nullable().optional(),
  legalName: z.string().max(200).nullable().optional(),
  croNumber: z.string().max(8).nullable().optional(),
  registeredAddress: z.string().max(ADDRESS_LENGTH).nullable().optional(),
  directors: z.string().max(DIRECTORS_LENGTH).nullable().optional(),
  /** On the "reading" setting (ADR 0046): a director lets heads of department see crew rates. Off unless said. */
  headsSeeRates: z.boolean().optional(),
  /**
   * On the "messages" setting (ADR 0048): whether Offer, Send, Tell and Ask
   * open a WhatsApp, text or email to a real person. Off until the office
   * says, so a company whose crew came in from a calendar can tidy the
   * lists without a mis-tap messaging a freelancer about a job in October.
   */
  promptMessages: z.boolean().optional(),
  /**
   * On the "timesheets" setting (ADR 0090): whether the company uses
   * timesheets at all. Off until the office says, so a company that pays
   * crew from its own records sees no Timesheets page, tile or count, and
   * no freelancer is asked for one. What's kept stays kept.
   */
  useTimesheets: z.boolean().optional(),
  /** On the "timesheets" setting (ADR 0110): bookings that started before this day aren't asked for one. Set by the server when they're turned on. */
  timesheetsFrom: day.nullable().optional(),
  /**
   * On the "assistant" setting (ADR 0096): whether Claude is offered to the
   * office and directors, to read an enquiry into a quote and suggest
   * changes to one. Off until the office says, since what's asked is sent
   * to Anthropic.
   */
  useAssistant: z.boolean().optional(),
  /**
   * On the "links" setting (ADR 0114): whether a freelancer's private link,
   * opened on a phone it hasn't seen before, asks for a code sent to their
   * email, and whether a freelancer who has lost their link can have it
   * emailed. Off until the office says, since both send an email.
   */
  checkLinks: z.boolean().optional(),
  /**
   * On the "whatsapp" setting (ADR 0125): whether an offer goes to its person on WhatsApp by itself, as the office makes
   * it. Off until the office says; "test" sends only to the numbers in whatsappTestTo, to try it out before launch.
   */
  whatsapp: z.enum(WHATSAPP_MODES).optional(),
  /** On the "whatsapp" setting: the numbers WhatsApp goes to in test mode, as typed. */
  whatsappTestTo: z.array(z.string().max(40)).max(WHATSAPP_TEST_MAX).optional(),
  /** On the "cables" setting (ADR 0106): the colour for each cable length, shortest first; the default list until the office saves one. */
  cableColours: cableColourList.optional(),
  /** On the "logo" setting (ADR 0106): when the logo was put up, which makes its address (logoPath). Set by the server alone. */
  logo: z.object({ at: z.string() }).nullable().optional(),
  /** On the "logo" setting (ADR 0163): labels print the logo in pure black and white, every grey and colour made one or the other. Off until the office says. */
  logoBlackWhite: z.boolean().optional(),
})
export type Setting = z.infer<typeof setting>

/** The office's details as the pages and Admin use them. */
export type OfficeDetails = Pick<Setting, 'name' | 'phone' | 'email'>

export interface SettingEntities {
  setting: Setting
}
export const SETTING_ENTITY_NAMES = ['setting'] as const

/** Text that may be left out: trimmed, and null when empty. */
const optionalText = (max: number, what: string) =>
  text(max, what)
    .pipe(z.string().trim())
    .nullable()
    .transform((v) => v || null)

export const officeCommandSchemas = {
  /** Set the office's details, all of them at once: there is only one office. */
  'office.update': z.object({
    name: z.string().transform(cleanText).pipe(z.string().trim().max(200, "The office's name can be up to 200 characters.")),
    phone: phone.nullable(),
    email: z.string().trim().email('That email address doesn’t look right.').max(200, 'The email address can be up to 200 characters.').nullable(),
    // Optional, so a change from an app older than them leaves them as they were.
    vatNumber: vatNumber.nullable().optional(),
    address: text(ADDRESS_LENGTH, 'The address').pipe(z.string().trim()).nullable().optional(),
  }),
  /**
   * The company's details for the foot of every quote (ADR 0181), all at once: what it trades as, its registered name,
   * CRO number, registered office and directors, its VAT number, and the address it trades from. Empty is not said.
   */
  'company.details': z.object({
    tradingName: optionalText(200, 'The trading name'),
    legalName: optionalText(200, 'The registered name'),
    croNumber: croNumber.nullable(),
    registeredAddress: optionalText(ADDRESS_LENGTH, 'The registered office'),
    directors: optionalText(DIRECTORS_LENGTH, "The directors' names"),
    vatNumber: vatNumber.nullable(),
    address: optionalText(ADDRESS_LENGTH, 'The address'),
  }),
  /** Whether heads of department see crew rates and timesheet amounts (ADR 0046). A director's to decide. */
  'reading.heads': z.object({ rates: z.boolean() }),
  /** Whether the app prompts messages to crew (ADR 0048). The office's to decide, under Admin. */
  'messages.prompt': z.object({ on: z.boolean() }),
  /** Whether the company uses timesheets (ADR 0090). The office's to decide, under Admin. */
  'timesheets.use': z.object({
    on: z.boolean(),
    /**
     * The first day whose bookings are asked for a timesheet (ADR 0110).
     * Left out, turning them on starts from today, and changing nothing
     * else keeps the day already set.
     */
    from: day.optional(),
  }),
  /** Whether Claude is offered inside the app (ADR 0096). The office's to decide, under Admin. */
  'assistant.use': z.object({ on: z.boolean() }),
  /** Whether freelancers' links check new phones and can be emailed when lost (ADR 0114). The office's to decide, under Admin. */
  'links.check': z.object({ on: z.boolean() }),
  /**
   * Whether offers go on WhatsApp by themselves (ADR 0125), and the numbers to try it on. The office's to decide, under
   * Admin › Connections. The numbers are kept whatever the mode, so test mode can be left and come back to.
   */
  'whatsapp.use': z.object({
    mode: z.enum(WHATSAPP_MODES),
    testTo: z.array(testNumber).max(WHATSAPP_TEST_MAX, `Up to ${WHATSAPP_TEST_MAX} numbers to try it on.`),
  }),
  /** The colour for each cable length (ADR 0106), the whole list at once. The office's, under Admin. */
  'cables.colours': z.object({ colours: cableColourList }),
  /** Whether labels print the logo in pure black and white (ADR 0163). The office's, under Admin › Company › Logo. */
  'logo.blackWhite': z.object({ on: z.boolean() }),
} as const

/** The details when there is a way back in them: a phone or an email. A name alone is nothing to show. */
export function officeContact(o: OfficeDetails | null | undefined): OfficeDetails | null {
  if (!o) return null
  const phone = o.phone?.trim() || null
  const email = o.email?.trim() || null
  if (!phone && !email) return null
  return { name: o.name.trim() || 'The office', phone, email }
}

/** "Session Hire office · 01 234 5678 · office@sessionhire.com". */
export function officeLine(o: OfficeDetails | null | undefined): string {
  const c = officeContact(o)
  return c ? [c.name, c.phone, c.email].filter(Boolean).join(' · ') : ''
}

/** A tel: link wants only the digits and a leading +; the "(0)" written after a country code is not dialled. */
export const telHref = (phone: string) => `tel:${phone.replace(/\(0\)/g, '').replace(/[^\d+]/g, '')}`

/** WhatsApp as Admin › Connections shows it (ADR 0125): set up on the server, and the number as Meta has it. */
export interface WhatsAppStatus {
  /** The server has a token and the number's id for Meta. */
  configured: boolean
  /** What's still to set in Railway for answers to come back: the app's secret and the word for the web address. */
  missing: string[]
  /** The address Meta posts answers and receipts to, to paste into Meta's app settings. */
  hook: string
  /** As Meta has it, once read: the number people see, the approved name and how well its messages are taken. */
  number?: string
  name?: string
  quality?: string
  nameStatus?: string
  /** Why the number couldn't be read, in Meta's words. */
  problem?: string
}

/** An address written a line each, said on one line: "Unit 4, Park West, Dublin 12". */
export const addressOnOneLine = (a: string | null | undefined) =>
  (a ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(', ')

/** What the company trades as: the office's own, or "Session Hire". */
export const tradingNameOf = (o: Pick<Setting, 'tradingName'> | null | undefined) => o?.tradingName?.trim() || TRADING_NAME

/**
 * The company as the law asks it to be named on its business letters and order forms (Companies Act 2014, section 151;
 * ADR 0181), for the foot of a quote: "Session Hire is a trading name of Session Hire Productions Limited, registered in
 * Ireland, number 612345. Registered office: Unit 4, Park West, Dublin 12. Directors: Aoife Byrne, Colm Hewson." What
 * isn't set is left out; empty when nothing is.
 */
export function legalLine(o: Pick<Setting, 'tradingName' | 'legalName' | 'croNumber' | 'registeredAddress' | 'directors'> | null | undefined): string {
  const trade = tradingNameOf(o)
  const legal = o?.legalName?.trim()
  const cro = o?.croNumber?.trim()
  const office = addressOnOneLine(o?.registeredAddress)
  const directors = addressOnOneLine(o?.directors)
  const out: string[] = []
  const named = legal && legal.toLowerCase() !== trade.toLowerCase() ? `${trade} is a trading name of ${legal}` : legal || (cro ? trade : '')
  if (named) out.push(`${named}${cro ? `, registered in Ireland, number ${cro}` : ''}.`)
  if (office) out.push(`Registered office: ${office}.`)
  if (directors) out.push(`Directors: ${directors}.`)
  return out.join(' ')
}
