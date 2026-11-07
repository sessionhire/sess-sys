import { mapLink, plural, type JobView, type VenueView, type View } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { useAccess } from '../role.ts'
import { Pending } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import { Attachments, JobsCard } from './Attachments.tsx'
import { Page } from './common.tsx'
import { TabPanel, Tabs, useTab } from '../Tabs.tsx'
import { JOBS, VENUES } from '../Up.tsx'
import { VenueMapCard } from './VenueMaps.tsx'

/**
 * One venue on a page of its own (ADR 0032, #jobs/venues/<id>): where it is,
 * what to know getting in, the documents kept for it (its tech spec, floor
 * plan, health and safety pack…), and the jobs there. Its map (ADR 0057)
 * sits under its address.
 */

/** The jobs at a venue: the job's own, or one of its phases'. */
export const jobsAt = (jobs: readonly JobView[], venueId: string) => jobs.filter((j) => j.venueId === venueId || j.phases.some((p) => p.venueId === venueId))

type VenuePart = 'details' | 'map' | 'documents' | 'jobs'
const VENUE_PARTS: readonly VenuePart[] = ['details', 'map', 'documents', 'jobs']
const VENUE_LABELS: Record<VenuePart, string> = { details: 'Details', map: 'On the map', documents: 'Documents', jobs: 'Jobs here' }
const venueHref = (id: string) => `#jobs/venues/${encodeURIComponent(id)}`

/** Where it is in a word or two, from its address: the last line that isn't an Eircode or the country. */
export function venueArea(address: string): string | undefined {
  const lines = address
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter((l) => l && !/^([ac-fhknprtv-y]\d{2}|d6w)\s?[0-9ac-fhknprtv-y]{4}$/i.test(l) && !/^(ireland|éire|eire)$/i.test(l))
  return lines.length > 1 ? lines.at(-1) : undefined
}

/** "Venue · Dublin 1 · 8 jobs here", as a person's page says who they are (Move 11 of the sweep of 6 November 2026). */
function venueLine(venue: VenueView, jobs: number): string {
  return ['Venue', venueArea(venue.address), jobs ? `${plural(jobs, 'job')} here` : 'No jobs here yet'].filter(Boolean).join(' · ')
}

export function VenueScreen({ view, id, part: asked }: { view: View; id: string; part?: string }) {
  const venue = view.jobs.venues.find((v) => v.id === id)
  const up = { steps: [JOBS, VENUES], here: venue?.name }
  const [part, pick] = useTab({ parts: VENUE_PARTS, asked, remember: 'sh.venuePart', address: (p) => `${venueHref(id)}/${p}` })
  if (!venue)
    return (
      <Page view={view} title="Venue" className="crew jobs" up={up}>
        <section className="card">
          <p className="empty">This venue isn't on this device. It may still be on its way: check again once it says “Up to date”.</p>
        </section>
      </Page>
    )
  const jobs = jobsAt(view.jobs.jobs, venue.id)
  return (
    <Page view={view} title="Venue" className="crew jobs" up={up} heading={venue.name} badge={<Pending pending={venue.pending} />} sub={venueLine(venue, jobs.length)}>
      <Tabs label={`About ${venue.name}`} id="venue" parts={VENUE_PARTS} labels={VENUE_LABELS} current={part} counts={{ jobs: jobs.length || undefined }} onPick={pick} />
      <TabPanel id="venue" current={part}>
        {part === 'details' && <VenueSummary venue={venue} onMap={() => pick('map')} />}
        {part === 'map' && <VenueMapCard venue={venue} />}
        {part === 'documents' && <Attachments owner={{ owner: 'venue', id: venue.id, name: venue.name }} />}
        {part === 'jobs' && <JobsCard jobs={jobs} title="Jobs here" client />}
      </TabPanel>
    </Page>
  )
}

function VenueSummary({ venue, onMap }: { venue: VenueView; onMap: () => void }) {
  const [editing, setEditing] = useState(false)
  const mayChange = useAccess().can('jobs')
  return (
    <section className="card" aria-label="Details">
      <dl className="facts">
        <div>
          <dt>Address</dt>
          <dd>
            {venue.address ? <span className="lines">{venue.address}</span> : 'None yet'}{' '}
            {/* Once it's on the map, its tab says where, with directions. */}
            {venue.pin ? (
              <button type="button" className="link" onClick={onMap}>
                On the map
              </button>
            ) : (
              <a href={mapLink(venue)} target="_blank" rel="noreferrer">
                Map
              </a>
            )}
          </dd>
        </div>
      </dl>
      {venue.notes && <p className="notes">{venue.notes}</p>}
      {/* Changing it is the jobs' (audit finding 9): a role without them reads it. */}
      {!mayChange ? null : editing ? (
        <EditVenue venue={venue} onDone={() => setEditing(false)} />
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Change details
        </button>
      )}
    </section>
  )
}

function EditVenue({ venue, onDone }: { venue: VenueView; onDone: () => void }) {
  const [f, setF] = useState({ name: venue.name, address: venue.address, notes: venue.notes })
  const { run, error } = useAct()
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    void run(() => client.mutate('venue.upsert', { id: venue.id, name: f.name.trim(), address: f.address.trim(), notes: f.notes.trim() })).then((ok) => ok && onDone())
  }
  return (
    <form className="grid-form" onSubmit={save} aria-label={`Change ${venue.name}`}>
      <label className="wide">
        Name <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </label>
      <label className="wide">
        Address <textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="With the Eircode, the map link goes straight there" />
      </label>
      <label className="wide">
        Notes <textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Access, load-in, power, parking" />
      </label>
      <Refusal error={error} className="wide" />
      <button type="submit" className="primary">
        Save venue
      </button>
      <button type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  )
}
