import { z } from 'zod'
import { hasEmail } from './roles.ts'
import { CREW_DEPARTMENTS, NOTES_LENGTH, TRADES_AS, tidyDepartment, type Person, type TradesAs } from './crew.ts'
import { cleanText } from './plain.ts'
import { phoneDigits } from './crew-import.ts'
import { phoneWithCountry } from './phone.ts'
import { APPLICANT_LEVEL } from './crew-departments.ts'
import { dayLabel } from './crew-days.ts'
import { irishToday } from './day.ts'
import type { CommandArgs } from './commands.ts'

/**
 * Applications to join the crew (ADR 0190). Someone who'd like work fills in
 * the public Apply page (/join), with no sign-in and no link; what they send
 * waits under Crew › Applications for the office, which takes them on into
 * People, as an applicant (Level 0) nobody has vetted yet, or turns them
 * down, which deletes what they sent. Nothing here sends anything to the
 * person who applied (ADR 0048): they see a thank-you page, and the office
 * gets in touch the usual way.
 *
 * Only the office, directors and heads of department read applications, as
 * they read people's email and notes (ADR 0062); a head who doesn't read rates
 * isn't sent the rate asked for, nor how they trade (ADR 0184).
 */

export const APPLICATION_ABOUT_LENGTH = 2000
export const APPLICATION_SKILLS_LENGTH = 300
export const APPLICATION_BASED_LENGTH = 100
/** The most waiting at once: past it, the page says to ring the office, so a flood of junk can't fill the database. */
export const APPLICATIONS_MOST = 300

/** What someone sent, as devices keep it. */
export interface Application {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  /** The department they picked, as the Crew tab spells them, or null for "not sure". */
  department: string | null
  /** What they do, in their own words, split at commas into the skills a person has. */
  skills: string[]
  /** The day rate they asked for, or null for none said. */
  dayRateCents: number | null
  tradesAs: TradesAs | null
  /** Where they're based: a town or county. */
  basedIn: string
  /** Their experience, in their own words. */
  about: string
  /** When it came in, and when it was last sent again by the same email. */
  appliedAt: string
  /** Set by the server for a reader who doesn't read this rate (ADR 0046): rate and trading left out. Never stored. */
  rateHidden?: boolean
}

export interface ApplicationEntities {
  application: Application
}
export const APPLICATION_ENTITY_NAMES = ['application'] as const

const id = z.string().min(1).max(64)

export const applicationCommandSchemas = {
  /**
   * Take someone on (ADR 0190): they become a freelancer on the Crew tab, at Level 0 (an applicant), with what they sent,
   * and the application goes. The device names the new person, so it can open their page straight away.
   */
  'application.take': z.object({ id, personId: id }),
  /** Turn someone down: what they sent is deleted, and nobody is told. */
  'application.drop': z.object({ id }),
} as const

/** "FOH, monitors / RF" as skills: split at commas, slashes, semicolons and new lines, each tidied, none twice, up to 30. */
export function skillsFrom(typed: string): string[] {
  const out: string[] = []
  for (const s of typed.split(/[,;/\n]+/)) {
    const t = cleanText(s).trim().replace(/\s+/g, ' ').slice(0, 60)
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out.slice(0, 30)
}

/** The rate as typed on the page: "250", "€250", "250.50". Null for nothing; undefined for something that isn't money. */
export function rateFrom(typed: string): number | null | undefined {
  const t = typed.replace(/[€\s,]/g, '')
  if (!t) return null
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return undefined
  const cents = Math.round(Number(t) * 100)
  return cents <= 100_000_00 ? cents : undefined
}

/** A phone as typed: digits, spaces, brackets, dashes and a leading +, as the person form takes it. */
export const PHONE_SHAPE = /^\+?[0-9 ()-]{6,40}$/
/**
 * Something@somewhere.tld, read without a regular expression that backtracks, as the Apply page's text is anyone's: one @,
 * something before it, and a dot with something either side after it, no spaces, up to 200 characters.
 */
export function isEmailShape(s: string): boolean {
  if (s.length > 200 || /\s/.test(s)) return false
  const at = s.indexOf('@')
  if (at < 1 || at !== s.lastIndexOf('@')) return false
  const domain = s.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  return dot > 0 && dot < domain.length - 1
}

/** What the Apply page asks, as its fields are named. */
export interface ApplyForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  /** The country code picked beside the mobile, as its digits (353 for Ireland); empty or unknown reads as Ireland. */
  country: string
  department: string
  skills: string
  rate: string
  tradesAs: string
  basedIn: string
  about: string
  agree: boolean
}

export type ApplyField = keyof ApplyForm


/** The page's form read: the application it makes, or what's wrong with each field, in the page's own order. */
export function readApplyForm(f: ApplyForm): { ok: true; application: Omit<Application, 'id' | 'appliedAt'> } | { ok: false; errors: Partial<Record<ApplyField, string>> } {
  const errors: Partial<Record<ApplyField, string>> = {}
  const line = (s: string, max: number) => cleanText(s).trim().replace(/\s+/g, ' ').slice(0, max)
  const firstName = line(f.firstName, 100)
  const lastName = line(f.lastName, 100)
  const email = f.email.trim().toLowerCase()
  // In international form, as the crew list keeps phones, so WhatsApp links work and the same number matches.
  const read = phoneWithCountry(f.country, f.phone)
  const phone = read.phone ?? ''
  if (!firstName) errors.firstName = 'Put in your first name.'
  if (!lastName) errors.lastName = 'Put in your last name.'
  if (!isEmailShape(email)) errors.email = "That doesn't look like an email address. Check it and try again."
  if (!phone || read.problem !== undefined || !PHONE_SHAPE.test(phone)) errors.phone = 'Put in a mobile number we can ring, such as 087 123 4567 with Ireland picked beside it.'
  const rate = rateFrom(f.rate)
  if (rate === undefined) errors.rate = 'Put the day rate in euro as a number, such as 250, or leave it empty.'
  const department = (CREW_DEPARTMENTS as readonly string[]).includes(f.department) ? tidyDepartment(f.department) : null
  const tradesAs = (TRADES_AS as readonly string[]).includes(f.tradesAs) ? (f.tradesAs as TradesAs) : null
  if (!f.agree) errors.agree = 'Tick this so we can keep your details to offer you work.'
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    application: {
      firstName,
      lastName,
      email,
      phone,
      department,
      skills: skillsFrom(f.skills.slice(0, APPLICATION_SKILLS_LENGTH)),
      dayRateCents: rate ?? null,
      tradesAs,
      basedIn: line(f.basedIn, APPLICATION_BASED_LENGTH),
      about: cleanText(f.about).trim().slice(0, APPLICATION_ABOUT_LENGTH),
    },
  }
}

/** Someone already on the Crew tab with the same email or phone, archived too: the office checks before taking them on twice. */
export function alreadyHave<P extends Pick<Person, 'email' | 'phone' | 'archived'> & { otherEmails?: readonly string[] }>(a: Pick<Application, 'email' | 'phone'>, people: readonly P[]): P | undefined {
  const digits = phoneDigits(a.phone)
  return (
    people.find((p) => hasEmail(p, a.email.trim().toLowerCase())) ??
    (digits.length >= 8 ? people.find((p) => phoneDigits(p.phone) === digits) : undefined)
  )
}

/** The notes a person taken on starts with: what they wrote, and where they're based. */
export function notesFrom(a: Pick<Application, 'about' | 'basedIn' | 'appliedAt'>, day: string): string {
  return [`Applied on ${day}.`, a.basedIn ? `Based in ${a.basedIn}.` : '', a.about].filter(Boolean).join('\n\n').slice(0, NOTES_LENGTH)
}

/**
 * The person an application becomes when it's taken on, as the office would add them: a freelancer, at Level 0 so they
 * stay out of Offer to… until vetted (ADR 0025). The server saves it, and a device shows it while the change waits.
 */
export function applicantAsPerson(app: Application, personId: string): CommandArgs<'person.upsert'> {
  return {
    id: personId,
    name: `${app.firstName} ${app.lastName}`.trim(),
    firstName: app.firstName,
    lastName: app.lastName,
    kind: 'freelancer',
    email: app.email,
    phone: app.phone,
    skills: app.skills,
    dayRateCents: app.dayRateCents,
    notes: notesFrom(app, dayLabel(irishToday(new Date(app.appliedAt)))),
    department: app.department,
    level: APPLICANT_LEVEL,
    company: app.tradesAs ? { as: app.tradesAs, name: '', vatNumber: null, croNumber: null } : null,
    nameChecked: true,
  }
}
