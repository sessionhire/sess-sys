import { MOST_SKILLS, readSkills } from './crew-import.ts'
import { departmentInWords, mostNamed } from './crew-departments.ts'

/**
 * The skills field (ADR 0063): what the crew list already calls people,
 * offered back as they type, so "Audio" stays one skill rather than
 * "audio", "Audio " and "sound" across a hundred freelancers.
 */

/** Every skill on the crew list, each once whatever its case, the most used first; it keeps the spelling most people have. */
export function skillsInUse(people: readonly { skills: readonly string[] }[]): string[] {
  const tally = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const p of people) {
    const seen = new Set<string>()
    for (const raw of p.skills) {
      const skill = raw.trim()
      const key = skill.toLowerCase()
      if (!skill || seen.has(key)) continue
      seen.add(key)
      const t = tally.get(key) ?? {
        count: 0,
        spellings: new Map<string, number>(),
      }
      t.count++
      t.spellings.set(skill, (t.spellings.get(skill) ?? 0) + 1)
      tally.set(key, t)
    }
  }
  const spelling = (s: Map<string, number>) => [...s].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0]
  return [...tally.values()]
    .map((t) => ({ skill: spelling(t.spellings), count: t.count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .map((t) => t.skill)
}

/** What to offer for what's typed: those starting with it first, then those with a word starting with it, never one already chosen. */
export function suggestSkills(known: readonly string[], typed: string, chosen: readonly string[], most = 8): string[] {
  const have = new Set(chosen.map((s) => s.toLowerCase()))
  const q = typed.trim().toLowerCase()
  const open = known.filter((s) => !have.has(s.toLowerCase()))
  if (!q) return open.slice(0, most)
  const starts = open.filter((s) => s.toLowerCase().startsWith(q))
  const word = open.filter(
    (s) =>
      !s.toLowerCase().startsWith(q) &&
      s
        .toLowerCase()
        .split(/[\s/&+-]+/)
        .some((w) => w.startsWith(q)),
  )
  return [...starts, ...word].slice(0, most)
}

/**
 * Which offer Enter takes before Up or Down has moved, so the highlight shows what Enter will do: the one spelt as typed, else
 * the first starting with it, else the new one (its index is just past the offers). None while nothing is typed, or when
 * what's typed is already chosen, so Enter there sends the form or says it's already on.
 */
export function firstPick(offered: readonly string[], typed: string, chosen: readonly string[], hasNew: boolean): number {
  const q = typed.trim().toLowerCase()
  if (!q || chosen.some((s) => s.toLowerCase() === q)) return -1
  const exact = offered.findIndex((s) => s.toLowerCase() === q)
  if (exact >= 0) return exact
  const starts = offered.findIndex((s) => s.toLowerCase().startsWith(q))
  if (starts >= 0) return starts
  return hasNew ? offered.length : -1
}

/**
 * Adds what was typed (one skill, or several pasted with commas) to those
 * chosen: each once, in the crew list's own spelling when it already has
 * one, up to the 30 a person can hold.
 */
export function addSkills(chosen: readonly string[], typed: string, known: readonly string[] = []): string[] {
  const out = [...chosen]
  const have = new Set(out.map((s) => s.toLowerCase()))
  const spelt = new Map(known.map((s) => [s.toLowerCase(), s]))
  for (const s of readSkills(typed)) {
    const key = s.toLowerCase()
    if (have.has(key) || out.length >= MOST_SKILLS) continue
    have.add(key)
    out.push(spelt.get(key) ?? s)
  }
  return out
}

/**
 * The roles an AV hire company usually asks for (Colly, 23 November 2026, for the Apply page and every role field),
 * offered after the ones the app already knows: ideas from the calendars' crew, the price list's roles and the trade's
 * usual names. Each says its department by its words (ROLE_WORDS), so an applicant who picks "Monitor engineer" is
 * Audio without being asked.
 */
export const AV_ROLES: readonly string[] = [
  // Audio
  'Sound engineer',
  'FOH engineer',
  'Monitor engineer',
  'Audio tech',
  'RF tech',
  'PA tech',
  'A2 (audio assist)',
  'Systems tech (audio)',
  // Lighting
  'LX op',
  'LX tech',
  'Lighting programmer',
  'Lighting designer',
  'Follow spot op',
  'Dimmer tech',
  // Video
  'Video engineer',
  'Video tech',
  'Camera op',
  'Vision mixer',
  'Projectionist',
  'Media server op',
  // LED
  'LED tech',
  // Lasers
  'Laser tech',
  // Backline
  'Backline tech',
  'Guitar tech',
  'Drum tech',
  // Rigging and staging
  'Rigger',
  'Head rigger',
  'Staging tech',
  'Stagehand',
  // Running the show
  'Crew chief',
  'Stage manager',
  'Production manager',
  'Site manager',
  'Runner',
  // Effects and transport
  'SFX tech',
  'Pyro tech',
  'Driver',
  'Van driver',
  'Truck driver (C licence)',
  // Power and the warehouse
  'Electrician',
  'Power tech',
  'Warehouse crew',
]

/** A charge on a quote that isn't a person's work, though it's a service line: travel, delivery, hire, a fee. */
const NOT_CREW = /\b(deliver(y|ies)|collect(ion)?s?|travel|mileage|milage|fuel|diesel|tolls?|parking|ferry|flights?|hotel|accommodation|subsistence|per diems?|hire|charges?|fees?|costs?|insurance|surcharge|disposal|consumables?|transport charge|km|kilomet(er|re)s?|discount|deposit|vehicle|truck hire|van hire)\b/i
/** Words a person's job has: "Sound engineer", "LX op", "Crew chief", "Stagehand". */
const CREW_WORDS = /\b(tech|techs|technician|engineer|operator|op|crew|hands?|stagehand|manager|designer|programmer|chief|assist(ant)?|runner|electrician|labour|labourer|loader|rigger|driver|director|producer|supervisor)\b/i

/**
 * A service line on a quote in Current RMS read as a crew role (Colly, 23 November 2026: "review the current rms quoted
 * staff also for ideas"), tidied of what it says about the charge: "Sound Engineer - per day" is "Sound Engineer". None
 * for a line that charges for something other than a person's work (delivery, travel, a fee).
 */
export function quotedCrewRole(name: string): string | null {
  const t = name
    .replace(/\s*[-–(:]\s*(per |p\/)?(day|hour|hr|shift|half day|show)\b.*$/i, '')
    .replace(/\b(day rate|daily rate|hourly rate|per day|per hour)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length < 2 || t.length > 60 || NOT_CREW.test(t) || /\d{2,}/.test(t)) return null
  return departmentInWords(t) || CREW_WORDS.test(t) ? t : null
}

/** The department the roles someone does name most often (an applicant's "Monitor engineer, RF tech" is Audio), or none. */
export const departmentOfRoles = (roles: readonly string[]): string | null => mostNamed(roles.map((r) => departmentInWords(r)))

/** A role the company already knows, for the role field on a crew call: how often it's been asked for, and by whom it's done. */
export interface RoleInUse {
  name: string
  /** Calls that asked for it. */
  calls: number
  /** People on the crew list with it as a skill. */
  people: number
  /** On the price list. */
  priced: boolean
  /** One of the trade's usual roles (AV_ROLES), whether or not anyone has it yet. */
  standard?: boolean
}

/**
 * Every role the app knows, each once whatever its case or spacing (roles
 * read alike as departmentForRole and the price list read them): those calls
 * have asked for, the crew list's skills and the price list's roles. The
 * most asked for come first, then the most people have, then the rest by
 * name, each in the spelling used most, so "LX op" stays one role rather
 * than "lx op", "LX Op" and "LX  op" across hundreds of jobs.
 */
export function rolesInUse(known: {
  calls?: readonly { role: string }[]
  people?: readonly { skills: readonly string[]; archived?: boolean }[]
  priced?: readonly string[]
  /** The trade's usual roles (AV_ROLES), offered after the rest, in the app's own spelling where it has one. */
  standard?: readonly string[]
}): RoleInUse[] {
  const tally = new Map<string, { calls: number; people: number; priced: boolean; standard: boolean; spellings: Map<string, number> }>()
  const add = (raw: string, what: 'calls' | 'people' | 'priced' | 'standard') => {
    const name = raw.trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    if (!name) return
    const t = tally.get(key) ?? { calls: 0, people: 0, priced: false, standard: false, spellings: new Map<string, number>() }
    if (what === 'priced') t.priced = true
    else if (what === 'standard') t.standard = true
    else t[what]++
    // A spelling counts more for being asked for than for being a skill, and the price list's only where nothing else has it.
    t.spellings.set(name, (t.spellings.get(name) ?? 0) + (what === 'calls' ? 1000 : what === 'people' ? 1 : what === 'standard' ? -0.5 : 0))
    tally.set(key, t)
  }
  for (const c of known.calls ?? []) add(c.role, 'calls')
  for (const p of known.people ?? []) {
    if (p.archived) continue
    const seen = new Set<string>()
    for (const s of p.skills) {
      const key = s.trim().replace(/\s+/g, ' ').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      add(s, 'people')
    }
  }
  for (const r of known.priced ?? []) add(r, 'priced')
  for (const r of known.standard ?? []) add(r, 'standard')
  // Alike counts take the one with a capital, so "Lampie" over "lampie".
  const capital = (s: string) => (s[0] !== s[0]!.toLowerCase() ? 0 : 1)
  const spelling = (s: Map<string, number>) => [...s].sort((a, b) => b[1] - a[1] || capital(a[0]) - capital(b[0]) || a[0].localeCompare(b[0]))[0]![0]
  return [...tally.values()]
    .map((t) => ({ name: spelling(t.spellings), calls: t.calls, people: t.people, priced: t.priced, ...(t.standard ? { standard: true } : {}) }))
    // The ones in use first, then the price list's, then the trade's usual ones nobody has yet, each by name.
    .sort((a, b) => b.calls - a.calls || b.people - a.people || Number(b.priced) - Number(a.priced) || a.name.localeCompare(b.name, 'en-IE'))
}
