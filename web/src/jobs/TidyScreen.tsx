import {
  normalisePhone,
  phoneShown,
  clientWords,
  fullName,
  samePeople,
  joinedPhaseName,
  jobsNaming,
  namedFromAddress,
  nameKey,
  nameParts,
  newId,
  plural,
  sameJobs,
  spanLabel,
  tailOf,
  venueGuesses,
  withCapital,
  type JobView,
  type NameParts,
  type PersonView,
  type SameJob,
  type TidyJob,
  type View,
} from '@sh/shared'
import { useMemo, useState, type FormEvent } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { SamePeople } from '../crew/Combine.tsx'
import { Empty } from '../Empty.tsx'
import { ShowAll } from '../Fold.tsx'
import { Heading } from '../Icon.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { JOBS, type Step } from '../Up.tsx'
import { Top } from './common.tsx'

/**
 * Tidy up what came in (ADR 0050): what a bring-in from Google Calendar
 * couldn't tell, found in the jobs and people already in the app (audit of
 * 16 October 2026, findings 5, 7, 8 and 15), for the office to put right a
 * group at a time. Nothing changes until someone chooses: each section
 * suggests, and its button sends the ordinary changes (a job made part of
 * another, a name, a venue, a client), each in the history.
 */

export const TIDY: Step = { href: '#jobs/tidy', label: 'Tidy up' }

const tidyJob = (j: JobView): TidyJob => ({ ...j, phaseVenues: j.phases.map((p) => p.venueId) })
const whenOf = (j: TidyJob) => (j.span ? spanLabel(j.span) : 'No dates yet')

/** The last analysis, kept while the jobs and people it read are the same, so leaving Jobs and coming back doesn't redo it (audit, 20 October 2026, finding 2). */
let kept: { jobs: View['jobs']; people: View['crew']['people']; tidy: Tidy } | undefined

type Tidy = ReturnType<typeof tidyOf>

function tidyOf(view: View) {
  const jobs = view.jobs.jobs.map(tidyJob)
  return {
    same: sameJobs(jobs),
    // The same person brought in twice (ADR 0055), before naming anyone: combining may give them their name.
    twice: samePeople(view.crew.people),
    people: view.crew.people.filter(namedFromAddress),
    venues: venueGuesses(jobs, view.jobs.venues),
    words: clientWords(jobs, { clients: view.jobs.clients, venues: view.jobs.venues }).slice(0, 12),
    small: view.jobs.jobs.filter((j) => withCapital(j.name) !== j.name),
  }
}

/** Everything the page would suggest, worked out once per change of the jobs or people. */
export function tidyFor(view: View): Tidy {
  const { jobs } = view
  const { people } = view.crew
  if (kept?.jobs !== jobs || kept.people !== people) kept = { jobs, people, tidy: tidyOf(view) }
  return kept.tidy
}

/** How much there is to tidy. */
export function tidyCount(t: Tidy) {
  return t.same.length + t.twice.length + t.people.length + t.venues.length + t.small.length
}

export function TidyScreen({ view }: { view: View }) {
  const t = tidyFor(view)
  const access = useAccess()
  const phones = useMemo(() => phoneFixes(view, (a) => access.can(a)), [view, access])
  const nothing = tidyCount(t) === 0 && t.words.length === 0 && phones.fixes.length === 0 && phones.unread === 0
  return (
    <div className="app crew jobs import tidy">
      <Top view={view} up={{ steps: [JOBS], here: TIDY.label }} />
      <section className="card intro">
        <header className="title">
          <h1>Tidy up what came in</h1>
        </header>
        <p className="hint">
          What the calendars couldn't say, found in the jobs and people already in the app. Nothing changes until you choose, and each change is in the history like any
          other.
        </p>
        {nothing && (
          <Empty>Nothing to tidy: no job or person looks brought in twice, everyone has a name, every phone number is written in full, and no venue or client is waiting to be put on a job.</Empty>
        )}
      </section>
      {access.can('jobs') && t.same.length > 0 && <SameJobs view={view} groups={t.same} />}
      {/* Always there for crew, so what it combined stays said once the last pair has gone. */}
      {access.can('crew') && <SamePeople view={view} groups={t.twice} />}
      {access.can('crew') && t.people.length > 0 && <Names people={t.people} />}
      {access.can('jobs') && t.venues.length > 0 && <Venues guesses={t.venues} />}
      {access.can('jobs') && <Clients view={view} words={t.words} />}
      {access.can('jobs') && t.small.length > 0 && <Capitals jobs={t.small} />}
      <Phones {...phones} />
    </div>
  )
}

/** Jobs a calendar had as several: one group at a time, each made one job with a press and a question. */
function SameJobs({ view, groups }: { view: View; groups: readonly SameJob[] }) {
  return (
    <section className="card" aria-label="The same job, brought in as several">
      <Heading icon="calendar">The same job, brought in as several</Heading>
      <p className="hint">
        A calendar with a day for each department or stage ("EP - LX", "EP - Audio") came in as a job for each. Tick the ones that are one job, name it, and make it
        one: their days, crew, kit and notes go onto it, each day named for what its title said.
      </p>
      <ShowAll items={groups} limit={6} what="groups">
        {(shown) => (
          <ul className="found">
            {shown.map((g) => (
              <SameJobGroup key={g.key} view={view} group={g} />
            ))}
          </ul>
        )}
      </ShowAll>
    </section>
  )
}

function SameJobGroup({ view, group }: { view: View; group: SameJob }) {
  const [name, setName] = useState(group.name)
  // Sure groups start ticked: the one action is still a press and a question away.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(group.sure ? group.jobs.map((j) => j.id) : []))
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState('')
  const { run, error, refuse } = useAct()
  const chosen = group.jobs.filter((j) => ticked.has(j.id))
  const quoted = (j: TidyJob) => view.money.quotesOf(j.id).length > 0
  // The job kept: the one with a quote, or the one already called that, or the first.
  const into = chosen.find(quoted) ?? chosen.find((j) => nameKey(j.name) === nameKey(name)) ?? chosen[0]
  const days = chosen.flatMap((j) => {
    const phases = view.jobs.jobs.find((x) => x.id === j.id)?.phases ?? []
    return phases.map((p) => joinedPhaseName(p.name, tailOf(j.name, name), j.kind))
  })
  const shownDays = [...new Set(days)]

  const ask = () => {
    if (chosen.length < 2) return refuse('Tick at least two jobs to make them one.')
    if (!name.trim()) return refuse('Give the job a name.')
    setAsking(true)
  }
  const merge = () => {
    setAsking(false)
    if (!into) return
    const from = chosen.filter((j) => j.id !== into.id).map((j) => j.id)
    void run(() => client.mutate('project.merge', { id: into.id, from, name: name.trim() })).then((ok) => ok && setDone(`Made ${plural(chosen.length, 'job')} one: ${name.trim()}.`))
  }

  if (done)
    return (
      <li>
        <p className="added" role="status">
          {done} <a href={`#jobs/${encodeURIComponent(into?.id ?? '')}`}>Open it</a>
        </p>
      </li>
    )
  return (
    <li className="is-on">
      <label className="kind">
        One job called
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} aria-label={`Name for ${group.name} as one job`} />
      </label>
      <ul className="found people">
        {group.jobs.map((j) => (
          <li key={j.id} className={ticked.has(j.id) ? 'is-on' : 'is-off'}>
            <label className="tick">
              <input
                type="checkbox"
                checked={ticked.has(j.id)}
                onChange={() => {
                  const next = new Set(ticked)
                  if (!next.delete(j.id)) next.add(j.id)
                  setTicked(next)
                }}
              />
              <span>
                <b>{j.name}</b>
                <small>{whenOf(j)}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {chosen.length >= 2 && <p>Its days: {shownDays.slice(0, 12).join(', ') + (shownDays.length > 12 ? ` and ${shownDays.length - 12} more` : '')}</p>}
      <Refusal error={error} />
      {asking ? (
        <Confirm question={`Make ${plural(chosen.length, 'job')} one job, ${name.trim()}?`} yes="Make it one job" no="Not now" onYes={merge} onNo={() => setAsking(false)}>
          <p>
            Their days, crew, kit, vans and notes go onto {into?.name}, which is renamed {name.trim()}; the other {plural(chosen.length - 1, 'job')} {chosen.length === 2 ? 'is' : 'are'}{' '}
            removed. Anyone booked stays booked. It can't be split again in one go: each day can be moved to a new job by hand.
          </p>
        </Confirm>
      ) : (
        <div className="actions">
          <button type="button" className="primary" onClick={ask} disabled={chosen.length < 2}>
            Make {plural(chosen.length, 'job')} one
          </button>
        </div>
      )}
    </li>
  )
}

/** People named from their address: a name to type for each, saved one at a time. */
function Names({ people }: { people: readonly PersonView[] }) {
  return (
    <section className="card" aria-label="People named from their address">
      <Heading icon="person">People named from their address</Heading>
      <p className="hint">
        Google had no name for these guests, so they're named from their email. That name is what call sheets, the planner and their own page show. Put their first
        and last name right and Save, or Save as it is when it's already right.
      </p>
      <ShowAll items={people} limit={10} what="people">
        {(shown) => (
          <ul className="found people">
            {shown.map((p) => (
              <NameRow key={p.id} person={p} />
            ))}
          </ul>
        )}
      </ShowAll>
      <KeepNames people={people} />
    </section>
  )
}

function NameRow({ person }: { person: PersonView }) {
  // Filled from the name they have, so one that's already right is one press of Save (audit, 5 November 2026, finding 52).
  const [names, setNames] = useState<NameParts>(() => nameParts(person))
  const { run, error, refuse } = useAct()
  const save = (e: FormEvent) => {
    e.preventDefault()
    const typed = { firstName: names.firstName.trim(), lastName: names.lastName.trim() }
    if (!typed.firstName) return refuse('Type their first name.')
    const { id, kind, email, phone, skills, notes } = person
    // Checked, so they leave the list even when their name is what their address spells (ADR 0068).
    void run(() => client.mutate('person.upsert', { id, name: fullName(typed), ...typed, kind, email, phone, skills, notes, nameChecked: true }))
  }
  return (
    <li>
      <form className="tick" onSubmit={save} aria-label={`Name for ${person.email}`}>
        <span>
          <span className="names">
            <input
              className="name"
              value={names.firstName}
              placeholder="First name"
              onChange={(e) => setNames({ ...names, firstName: e.target.value })}
              maxLength={100}
              aria-label={`First name for ${person.email}`}
            />
            <input
              className="name"
              value={names.lastName}
              placeholder="Last name"
              onChange={(e) => setNames({ ...names, lastName: e.target.value })}
              maxLength={100}
              aria-label={`Last name for ${person.email}`}
            />
          </span>
          <small>
            {person.name} · {person.email} · {person.kind === 'staff' ? 'staff' : 'freelancer'}
          </small>
          <Refusal error={error} />
        </span>
        <button type="submit">Save</button>
      </form>
    </li>
  )
}

/** The names left as they are, all at once: each is marked checked so the list empties (ADR 0068). */
function KeepNames({ people }: { people: readonly PersonView[] }) {
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  const keep = () =>
    void run(async () => {
      for (const p of people) {
        const { id, kind, email, phone, skills, notes } = p
        await client.mutate('person.upsert', { id, name: p.name, ...nameParts(p), kind, email, phone, skills, notes, nameChecked: true })
      }
    }).then(() => setAsking(false))
  return (
    <>
      <Refusal error={error} />
      {asking ? (
        <Confirm
          question={`Keep all ${plural(people.length, 'name')} as they are?`}
          yes="Keep them"
          no="Not now"
          onYes={keep}
          onNo={() => setAsking(false)}
        >
          <p>Each person keeps the name shown and leaves this list. A name can still be changed on their page.</p>
        </Confirm>
      ) : (
        <div className="actions">
          <button type="button" onClick={() => setAsking(true)}>
            Keep these names
          </button>
        </div>
      )}
    </>
  )
}

/** Venues found in job names, to tick and put on the jobs. */
function Venues({ guesses }: { guesses: ReturnType<typeof venueGuesses> }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const [done, setDone] = useState('')
  const { run, error } = useAct()
  const chosen = guesses.filter((g) => ticked.has(g.job.id))
  const give = () => {
    const n = chosen.length
    void run(async () => {
      for (const g of chosen) await client.mutate('project.update', { id: g.job.id, venueId: g.venue.id })
    }).then((ok) => {
      if (!ok) return
      setTicked(new Set())
      setDone(`Gave ${plural(n, 'job')} their venue. Each can be changed on its job.`)
    })
  }
  return (
    <section className="card" aria-label="Venues in job names">
      <Heading icon="venue">Venues in job names</Heading>
      <p className="hint">Jobs with no venue whose name has one the app knows in it ("Real events button factory"), or whose others of the same name were at one.</p>
      {done && (
        <p className="added" role="status">
          {done}
        </p>
      )}
      <ShowAll items={guesses} limit={10} what="jobs">
        {(shown) => (
          <ul className="found people">
            {shown.map((g) => (
              <li key={g.job.id} className={ticked.has(g.job.id) ? 'is-on' : 'is-off'}>
                <label className="tick">
                  <input
                    type="checkbox"
                    checked={ticked.has(g.job.id)}
                    onChange={() => {
                      const next = new Set(ticked)
                      if (!next.delete(g.job.id)) next.add(g.job.id)
                      setTicked(next)
                    }}
                  />
                  <span>
                    <b>{g.job.name}</b>
                    <small>
                      {g.venue.name} · {g.why === 'name' ? 'in its name' : 'where the others of that name were'} · {whenOf(g.job)}
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </ShowAll>
      <Refusal error={error} />
      <div className="actions">
        <button type="button" onClick={() => setTicked(new Set(guesses.map((g) => g.job.id)))} disabled={ticked.size === guesses.length}>
          Tick all {guesses.length}
        </button>
        <button type="button" className="primary" onClick={give} disabled={chosen.length === 0}>
          Give {plural(chosen.length, 'job')} {chosen.length === 1 ? 'its' : 'their'} venue
        </button>
      </div>
    </section>
  )
}

/** A client for every job whose name has a word in it: the word, the client, the jobs to tick. */
function Clients({ view, words }: { view: View; words: readonly { word: string; jobs: number }[] }) {
  const [word, setWord] = useState('')
  const [who, setWho] = useState('')
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [done, setDone] = useState('')
  const { run, error, refuse } = useAct()
  const jobs = useMemo(() => jobsNaming(view.jobs.jobs.map(tidyJob), word), [view.jobs.jobs, word])
  const chosen = jobs.filter((j) => !unticked.has(j.id))
  const pick = (w: string) => {
    setWord(w)
    setWho(view.jobs.clients.find((c) => nameKey(c.name) === nameKey(w))?.name ?? w)
    setUnticked(new Set())
    setDone('')
  }
  const give = (e: FormEvent) => {
    e.preventDefault()
    const name = who.trim()
    if (!name) return refuse("Type the client's name.")
    if (chosen.length === 0) return refuse('No job is ticked.')
    const known = view.jobs.clients.find((c) => nameKey(c.name) === nameKey(name))
    const n = chosen.length
    void run(async () => {
      const id = known?.id ?? newId()
      if (!known) await client.mutate('client.upsert', { id, name, contacts: [], notes: '' })
      for (const j of chosen) await client.mutate('project.update', { id: j.id, clientId: id })
    }).then((ok) => {
      if (!ok) return
      setDone(`Gave ${plural(n, 'job')} the client ${name}.`)
      setWord('')
      setWho('')
    })
  }
  return (
    <section className="card" aria-label="Clients from job names">
      <Heading icon="company">Clients from job names</Heading>
      <p className="hint">
        The calendars put the client in the title ("Joanna verve KPMG"). Pick a word, or type one, and the client it stands for: every job without a client whose name has
        the word is listed to tick.
      </p>
      {words.length > 0 && (
        <div className="filters" role="group" aria-label="Words in many job names">
          {words.map((w) => (
            <button key={w.word} type="button" aria-pressed={nameKey(word) === nameKey(w.word)} onClick={() => pick(w.word)}>
              {w.word} ({w.jobs})
            </button>
          ))}
        </div>
      )}
      {done && (
        <p className="added" role="status">
          {done}
        </p>
      )}
      <form className="grid-form" onSubmit={give} aria-label="Give jobs a client">
        <label>
          Word in the name
          <input value={word} onChange={(e) => (setWord(e.target.value), setUnticked(new Set()))} placeholder="verve" />
        </label>
        <label>
          Client
          <input value={who} onChange={(e) => setWho(e.target.value)} list="tidy-clients" placeholder="Verve" maxLength={200} />
          <datalist id="tidy-clients">
            {view.jobs.clients.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>
        {word.trim() && (
          <div className="wide">
            {jobs.length === 0 ? (
              <p className="hint">No job without a client has "{word.trim()}" in its name.</p>
            ) : (
              <ShowAll items={jobs} limit={10} what="jobs">
                {(shown) => (
                  <ul className="found people">
                    {shown.map((j) => (
                      <li key={j.id} className={unticked.has(j.id) ? 'is-off' : 'is-on'}>
                        <label className="tick">
                          <input
                            type="checkbox"
                            checked={!unticked.has(j.id)}
                            onChange={() => {
                              const next = new Set(unticked)
                              if (!next.delete(j.id)) next.add(j.id)
                              setUnticked(next)
                            }}
                          />
                          <span>
                            <b>{j.name}</b>
                            <small>{whenOf(j)}</small>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </ShowAll>
            )}
          </div>
        )}
        <Refusal error={error} className="wide" />
        <div className="actions wide">
          <button type="submit" className="primary">
            Give {plural(chosen.length, 'job')} the client {who.trim() || '…'}
          </button>
        </div>
      </form>
    </section>
  )
}

/** Names typed with a small first letter: a capital for each, in one go. */
function Capitals({ jobs }: { jobs: readonly JobView[] }) {
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  const fix = () => {
    setAsking(false)
    void run(async () => {
      for (const j of jobs) await client.mutate('project.update', { id: j.id, name: withCapital(j.name) })
    })
  }
  return (
    <section className="card" aria-label="Names starting with a small letter">
      <Heading icon="edit">Names starting with a small letter</Heading>
      <p className="hint">Typed quickly into a calendar ("cms uplighter shop hire"). Only the first letter changes; the rest stays as typed.</p>
      <ShowAll items={jobs} limit={5} what="jobs">
        {(shown) => (
          <ul className="found">
            {shown.map((j) => (
              <li key={j.id}>
                <p>
                  {j.name} → <b>{withCapital(j.name)}</b>
                </p>
              </li>
            ))}
          </ul>
        )}
      </ShowAll>
      <Refusal error={error} />
      {asking ? (
        <Confirm question={`Start ${plural(jobs.length, 'job')}' names with a capital?`} yes="Give them capitals" no="Not now" onYes={fix} onNo={() => setAsking(false)}>
          <p>Each is a change to its job, in the history, and can be renamed again on its job.</p>
        </Confirm>
      ) : (
        <div className="actions">
          <button type="button" className="primary" onClick={() => setAsking(true)}>
            Start {plural(jobs.length, 'name')} with a capital
          </button>
        </div>
      )}
    </section>
  )
}

/** One number to write in full: where it is, as it's kept, as it will be, and the ordinary change that does it. */
type PhoneFix = { key: string; where: string; was: string; to: string; send: () => Promise<unknown> }

/** A kept number in international form, or nothing when it's that already or can't be read for sure. */
function fullForm(kept: string | null | undefined): string | undefined {
  const typed = (kept ?? '').trim()
  if (!typed) return undefined
  const read = normalisePhone(typed)
  return read.problem === undefined && read.phone && read.phone !== typed ? read.phone : undefined
}

/**
 * Every number the app keeps, written in full with its country code (ADR 0190, then system-wide), as the phone field
 * now saves them: people, clients' and venues' contacts, and the office's own. Only those the app reads for sure; one it
 * can't is counted, to fix by hand. Each is the ordinary change for its record, in the history.
 */
function phoneFixes(view: View, can: (a: 'crew' | 'jobs' | 'settings') => boolean): { fixes: PhoneFix[]; unread: number } {
  const fixes: PhoneFix[] = []
  let unread = 0
  const count = (kept: string | null | undefined) => {
    const typed = (kept ?? '').trim()
    if (typed && normalisePhone(typed).problem !== undefined) unread++
  }
  if (can('crew'))
    for (const p of view.crew.people) {
      count(p.phone)
      const to = fullForm(p.phone)
      if (to) fixes.push({ key: `p-${p.id}`, where: p.name, was: p.phone!, to, send: () => client.mutate('person.contact', { id: p.id, phone: to }) })
    }
  if (can('jobs')) {
    for (const c of view.jobs.clients) {
      c.contacts.forEach((x) => count(x.phone))
      if (!c.contacts.some((x) => fullForm(x.phone))) continue
      const contacts = c.contacts.map((x) => ({ ...x, phone: fullForm(x.phone) ?? x.phone }))
      c.contacts.forEach((x, i) => {
        const to = fullForm(x.phone)
        if (to)
          fixes.push({
            key: `c-${c.id}-${i}`,
            where: `${x.name || 'A contact'} at ${c.name}`,
            was: x.phone!,
            to,
            // Once for the client, with every contact's number, from its first contact's line.
            send: i === c.contacts.findIndex((y) => fullForm(y.phone))
              ? () => client.mutate('client.upsert', { id: c.id, name: c.name, contacts, notes: c.notes, address: c.address ?? '', paymentTerms: c.paymentTerms })
              : async () => undefined,
          })
      })
    }
    for (const v of view.jobs.venues) {
      count(v.contact?.phone)
      const to = fullForm(v.contact?.phone)
      if (to && v.contact)
        fixes.push({
          key: `v-${v.id}`,
          where: `${v.contact.name} at ${v.name}`,
          was: v.contact.phone!,
          to,
          send: () => client.mutate('venue.upsert', { id: v.id, name: v.name, address: v.address, notes: v.notes, contact: { ...v.contact!, phone: to } }),
        })
    }
  }
  const office = view.office.details
  if (can('settings') && office) {
    count(office.phone)
    const to = fullForm(office.phone)
    if (to)
      fixes.push({ key: 'office', where: 'The office', was: office.phone!, to, send: () => client.mutate('office.update', { name: office.name, phone: to, email: office.email }) })
  }
  return { fixes, unread }
}

/** Numbers kept as they were typed, before the country picker: written in full with a press and a question. */
function Phones({ fixes, unread }: { fixes: PhoneFix[]; unread: number }) {
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  if (fixes.length === 0 && unread === 0) return null
  const fix = () => {
    setAsking(false)
    void run(async () => {
      for (const f of fixes) await f.send()
    })
  }
  return (
    <section className="card" aria-label="Phone numbers without their country code">
      <Heading icon="phone">Phone numbers to write in full</Heading>
      <p className="hint">
        Every phone field now has its country beside it and keeps the number in full, so a call, a text or WhatsApp needs nothing added. These were kept as they were
        typed. Only the way they&rsquo;re written changes.
        {unread > 0 && ` ${plural(unread, 'number')} can't be read for sure, so ${unread === 1 ? "it's" : "they're"} left for you to fix where ${unread === 1 ? 'it is' : 'they are'}.`}
      </p>
      {fixes.length > 0 && (
        <>
          <ShowAll items={fixes} limit={5} what="numbers">
            {(shown) => (
              <ul className="found">
                {shown.map((f) => (
                  <li key={f.key}>
                    <p>
                      {f.where}: {f.was} → <b>{phoneShown(f.to)}</b>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </ShowAll>
          <Refusal error={error} />
          {asking ? (
            <Confirm question={`Write ${plural(fixes.length, 'number')} in full?`} yes="Write them in full" no="Not now" onYes={fix} onNo={() => setAsking(false)}>
              <p>Each is a change to its person, client, venue or the office, in the history, and can be changed again there.</p>
            </Confirm>
          ) : (
            <div className="actions">
              <button type="button" className="primary" onClick={() => setAsking(true)}>
                Write {plural(fixes.length, 'number')} in full
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
