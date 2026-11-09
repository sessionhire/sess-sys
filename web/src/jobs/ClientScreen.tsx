import { PAYMENT_DAYS, paymentTermsLabel, plural, type ClientView, type Contact, type PaymentTerms, type View } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { useAccess } from '../role.ts'
import { Pending } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import { Attachments, JobsCard } from './Attachments.tsx'
import { Page } from './common.tsx'
import { TabPanel, Tabs, useTab } from '../Tabs.tsx'
import { CLIENTS, JOBS } from '../Up.tsx'

/**
 * One client on a page of its own (ADR 0032, #jobs/clients/<id>): who to talk
 * to there, the notes, the documents kept for them (their contract,
 * purchase orders, a brief…), and their jobs. Its name heads the page as a
 * job's and a person's do, with its kind, jobs and first contact under it,
 * and its three parts are tabs (Move 11 of the sweep of 6 November 2026).
 */

type ClientPart = 'details' | 'documents' | 'jobs'
const CLIENT_PARTS: readonly ClientPart[] = ['details', 'documents', 'jobs']
const CLIENT_LABELS: Record<ClientPart, string> = { details: 'Details', documents: 'Documents', jobs: 'Jobs' }
const clientHref = (id: string) => `#jobs/clients/${encodeURIComponent(id)}`

export function ClientScreen({ view, id, part: asked }: { view: View; id: string; part?: string }) {
  const found = view.jobs.clients.find((c) => c.id === id)
  const up = { steps: [JOBS, CLIENTS], here: found?.name }
  const [part, pick] = useTab({ parts: CLIENT_PARTS, asked, remember: 'sh.clientPart', address: (p) => `${clientHref(id)}/${p}` })
  if (!found)
    return (
      <Page view={view} title="Client" className="crew jobs" up={up}>
        <section className="card">
          <p className="empty">This client isn't on this device. It may still be on its way: check again once it says “Up to date”.</p>
        </section>
      </Page>
    )
  const jobs = view.jobs.jobs.filter((j) => j.clientId === found.id)
  return (
    <Page view={view} title="Client" className="crew jobs" up={up} heading={found.name} badge={<Pending pending={found.pending} />} sub={clientLine(found, jobs.length)}>
      <Tabs label={`About ${found.name}`} id="client" parts={CLIENT_PARTS} labels={CLIENT_LABELS} current={part} counts={{ jobs: jobs.length || undefined }} onPick={pick} />
      <TabPanel id="client" current={part}>
        {part === 'details' && <ClientSummary c={found} />}
        {part === 'documents' && <Attachments owner={{ owner: 'client', id: found.id, name: found.name }} />}
        {part === 'jobs' && <JobsCard jobs={jobs} title="Their jobs" />}
      </TabPanel>
    </Page>
  )
}

/** "Client · 12 jobs · Shane Lynch": its kind, its jobs and who to ask for first, as a person's page says who they are. */
function clientLine(c: ClientView, jobs: number): string {
  return ['Client', plural(jobs, 'job'), c.contacts.find((x) => x.name.trim())?.name].filter(Boolean).join(' · ')
}

function ClientSummary({ c }: { c: ClientView }) {
  const [editing, setEditing] = useState(false)
  const mayChange = useAccess().can('jobs')
  return (
    <section className="card" aria-label="Details">
      <dl className="facts">
        {c.contacts.length === 0 && (
          <div>
            <dt>Contacts</dt>
            <dd>None yet</dd>
          </div>
        )}
        {c.contacts.map((x, i) => (
          <div key={i}>
            <dt>{x.role || 'Contact'}</dt>
            <dd>
              {x.name}
              {/* Each on a line of its own, so a number never breaks across two on a phone. */}
              {x.phone && (
                <>
                  <br />
                  <a href={`tel:${x.phone.replace(/[^+\d]/g, '')}`}>{x.phone}</a>
                </>
              )}
              {x.email && (
                <>
                  <br />
                  <a href={`mailto:${x.email}`}>{x.email}</a>
                </>
              )}
            </dd>
          </div>
        ))}
        <div>
          <dt>Address for quotes</dt>
          <dd className="lines">{c.address?.trim() || 'None yet'}</dd>
        </div>
        <div>
          <dt>Pays</dt>
          <dd>{c.paymentTerms != null ? paymentTermsLabel(c.paymentTerms) : "On the company's terms"}</dd>
        </div>
      </dl>
      {c.notes && <p className="notes">{c.notes}</p>}
      {/* Changing it is the jobs' (audit finding 9): a role without them reads it. */}
      {!mayChange ? null : editing ? (
        <EditClient c={c} onDone={() => setEditing(false)} />
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Change details
        </button>
      )}
    </section>
  )
}

/** Payment terms as a picker's value (ADR 0119): '' for the company's own, 'before', or the days. */
const termsKey = (t: PaymentTerms | null | undefined) => (t === null || t === undefined ? '' : String(t))
const termsFromKey = (k: string): PaymentTerms | null => (k === '' ? null : k === 'before' ? 'before' : Number(k))
/** Before the job, the usual days, and whatever this client already has if it's another. */
const termsOffered = (has: PaymentTerms | null | undefined): PaymentTerms[] => {
  const days: number[] = [...PAYMENT_DAYS]
  if (typeof has === 'number' && !days.includes(has)) days.push(has)
  return ['before', ...days.sort((a, b) => a - b)]
}

const blankContact = (): Contact => ({ name: '', role: '', email: null, phone: null })

function EditClient({ c, onDone }: { c: ClientView; onDone: () => void }) {
  const [f, setF] = useState({ name: c.name, notes: c.notes, contacts: c.contacts, address: c.address ?? '', pays: termsKey(c.paymentTerms) })
  const { run, error } = useAct()
  const setContact = (i: number, changes: Partial<Contact>) => setF({ ...f, contacts: f.contacts.map((x, j) => (j === i ? { ...x, ...changes } : x)) })
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const contacts = f.contacts
      .filter((x) => x.name.trim())
      .map((x) => ({ name: x.name.trim(), role: x.role.trim(), email: x.email?.trim() || null, phone: x.phone?.trim() || null }))
    void run(() => client.mutate('client.upsert', { id: c.id, name: f.name.trim(), contacts, notes: f.notes.trim(), address: f.address.trim(), paymentTerms: termsFromKey(f.pays) })).then((ok) => ok && onDone())
  }
  return (
    <form className="grid-form" onSubmit={save} aria-label={`Change ${c.name}`}>
      <label className="wide">
        Name <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </label>
      {f.contacts.map((x, i) => (
        <fieldset className="wide contact" key={i}>
          <legend>Contact {i + 1}</legend>
          {/* Each field's name is over it, not only inside it, so it stays once something is typed (audit finding 22). */}
          <label>
            Name <input value={x.name} onChange={(e) => setContact(i, { name: e.target.value })} />
          </label>
          <label>
            Role <input value={x.role} onChange={(e) => setContact(i, { role: e.target.value })} placeholder="e.g. Producer" />
          </label>
          <label>
            Mobile <input type="tel" value={x.phone ?? ''} onChange={(e) => setContact(i, { phone: e.target.value })} />
          </label>
          <label>
            Email <input type="email" value={x.email ?? ''} onChange={(e) => setContact(i, { email: e.target.value })} />
          </label>
        </fieldset>
      ))}
      <button type="button" className="wide" onClick={() => setF({ ...f, contacts: [...f.contacts, blankContact()] })}>
        Add a contact
      </button>
      <label className="wide">
        Address for quotes{' '}
        <textarea rows={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={500} placeholder="A line each, as on a letter" />
      </label>
      <label className="wide">
        Pays{' '}
        <select value={f.pays} onChange={(e) => setF({ ...f, pays: e.target.value })}>
          <option value="">On the company's terms</option>
          {termsOffered(c.paymentTerms).map((t) => (
            <option key={termsKey(t)} value={termsKey(t)}>
              {paymentTermsLabel(t)}
            </option>
          ))}
        </select>
        <small>Printed on their quotes, under the deposit.</small>
      </label>
      <label className="wide">
        Notes <textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </label>
      <Refusal error={error} className="wide" />
      <button type="submit" className="primary">
        Save client
      </button>
      <button type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  )
}
