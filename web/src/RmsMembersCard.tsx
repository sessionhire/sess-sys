import { plural, type Contact, type RmsMemberAdd, type RmsMemberFill, type RmsMembersStatus, type View } from '@sh/shared'
import { useEffect, useState, type ReactNode } from 'react'
import { Refusal, useAct } from './act.tsx'
import { markSignedOut } from './auth.ts'
import { when } from './format.ts'
import { client } from './sync.ts'

/**
 * Clients and venues from Current RMS, on Admin under its hire prices (ADR
 * 0136). Reading them runs on the server, a page a second, with how far it's
 * got; then the card says what filling in would do before anything changes:
 * an address where there's none, contacts a client hasn't got, a venue's
 * contact where it has none. Nothing typed here changes. Those on Current
 * RMS's quotes not here yet are added only when ticked. The lists open in
 * place and grow the page, never a box of their own to scroll.
 */

const base = import.meta.env.VITE_API_BASE ?? ''

type Loaded = { state: 'loading' } | { state: 'offline' } | { state: 'ready'; status: RmsMembersStatus }

const STAGE_WORDS = { organisation: "Reading Current RMS's organisations", venue: 'Reading its venues', contact: 'Reading its contacts' } as const

/** The clients and venues as they stand, so the card asks again once a fill-in or an edit elsewhere reaches it. */
const listsKey = (view: View) =>
  [...view.jobs.clients.map((c) => `${c.id}:${c.address ?? ''}:${c.contacts.length}`), ...view.jobs.venues.map((v) => `${v.id}:${v.address}:${v.contact ? 1 : 0}`)].join(',')

export function RmsMembersCard({ view, canRead }: { view: View; canRead: boolean }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [busy, setBusy] = useState(false)
  const [add, setAdd] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>()
  const { run, error } = useAct()
  const key = listsKey(view)

  const refresh = async () => {
    try {
      const res = await fetch(`${base}/api/rms/members`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (res.status === 401) return markSignedOut()
      if (!res.ok) throw new Error(`Server answered ${res.status}`)
      setLoaded({ state: 'ready', status: (await res.json()) as RmsMembersStatus })
    } catch {
      setLoaded((l) => (l.state === 'ready' ? l : { state: 'offline' }))
    }
  }
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 400)
    return () => clearTimeout(t)
  }, [key])

  const running = loaded.state === 'ready' && loaded.status.running !== null
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => void refresh(), 3_000)
    return () => clearInterval(t)
  }, [running])

  const post = async (what: 'read' | 'stop') => {
    setBusy(true)
    setNote(undefined)
    try {
      const res = await fetch(`${base}/api/rms/members/${what}`, { method: 'POST', signal: AbortSignal.timeout(30_000) })
      if (res.status === 401) return markSignedOut()
      if (!res.ok) setNote({ ok: false, text: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.` })
      await refresh()
    } catch {
      setNote({ ok: false, text: "Couldn't reach the server. Try again when you have signal." })
    } finally {
      setBusy(false)
    }
  }

  if (loaded.state === 'loading') return null
  if (loaded.state === 'offline')
    return (
      <section className="card">
        <h2>Clients and venues from Current RMS</h2>
        <p className="hint">Can't read Current RMS's clients and venues without signal.</p>
      </section>
    )
  const { status } = loaded
  if (!status.configured) return null

  const { plan, last, running: progress, counts } = status
  const adding = plan ? plan.clients.add.length + plan.venues.add.length : 0
  const writes = plan ? plan.clients.fill.length + plan.venues.fill.length + (add ? adding : 0) : 0
  const fill = () =>
    void run(async () => {
      await client.mutate('rms.fillMembers', { add })
      setNote({ ok: true, text: `Filling in ${plural(writes, 'client or venue', 'clients and venues')}. The lists here catch up as the server takes it.` })
      setAdd(false)
    })

  return (
    <section className="card rms-prices" aria-labelledby="rms-members-title">
      <h2 id="rms-members-title">Clients and venues from Current RMS</h2>
      <p>
        Fills in the clients and venues here from Current RMS's organisations and venues, found by name: an address where there's none, contacts a client hasn't got, and
        who to ask for at a venue that has nobody. Nothing typed here changes, and nothing changes in Current RMS.
      </p>
      {progress ? (
        <div role="status">
          <p>
            {STAGE_WORDS[progress.stage]}: {progress.done.toLocaleString('en-IE')}
            {progress.total ? ` of ${progress.total.toLocaleString('en-IE')}` : ''}.
          </p>
          <progress max={progress.total || 1} value={progress.done} aria-label={STAGE_WORDS[progress.stage]} />
          <p className="hint">Current RMS answers about a request a second, so this takes a minute or two. You can leave this page; it carries on.</p>
          {canRead && (
            <button type="button" className="secondary" onClick={() => void post('stop')} disabled={busy}>
              Stop reading
            </button>
          )}
        </div>
      ) : (
        <>
          {last?.error && (
            <p className="alert" role="alert">
              The last read stopped{last.finishedAt ? ` ${when(last.finishedAt)}` : ''}: {last.error}
            </p>
          )}
          {last && !last.error && last.finishedAt && (
            <p className="hint">
              Last read {when(last.finishedAt)}
              {last.stopped
                ? ', stopped part way, so the read before it stands'
                : `: ${plural(counts.organisations, 'organisation')}, ${plural(counts.venues, 'venue')} and ${plural(counts.contacts, 'contact')} who belong to them`}
              .
            </p>
          )}
          {!plan && (
            <p className="hint">
              {canRead ? 'Read them first; the card then shows what would change before anything does.' : 'They haven’t been read from Current RMS yet: someone who looks after the settings reads them here.'}
            </p>
          )}
        </>
      )}

      {plan && (
        <>
          <h3>Clients</h3>
          <ul className="rms-price-plan">
            <Part n={plan.clients.fill.length} title="to fill in" hint="Here already, found by name. Only what's missing is added.">
              <Fills rows={plan.clients.fill} />
            </Part>
            <Part n={plan.clients.same} title="already have what Current RMS has" />
            <Part n={plan.clients.add.length} title="on Current RMS's quotes, not here yet" hint="Added only if you tick below.">
              <Adds rows={plan.clients.add} />
            </Part>
            <Part n={plan.clients.neverQuoted} title="more in Current RMS, never on a quote there, left out" />
          </ul>
          <h3>Venues</h3>
          <ul className="rms-price-plan">
            <Part n={plan.venues.fill.length} title="to fill in" hint="Here already, found by name. Only what's missing is added.">
              <Fills rows={plan.venues.fill} />
            </Part>
            <Part n={plan.venues.same} title="already have what Current RMS has" />
            <Part n={plan.venues.add.length} title="on Current RMS's quotes, not here yet" hint="Added only if you tick below.">
              <Adds rows={plan.venues.add} />
            </Part>
            <Part n={plan.venues.neverQuoted} title="more in Current RMS, never on a quote there, left out" />
          </ul>
          <p className="hint">A name that's written differently here isn't found. Rename one to match and read again, or fill it in by hand.</p>
          {adding > 0 && (
            <label className="tick">
              <input type="checkbox" checked={add} onChange={(e) => setAdd(e.target.checked)} />
              Also add the {adding === 1 ? 'one' : adding.toLocaleString('en-IE')} on Current RMS's quotes that {adding === 1 ? "isn't" : "aren't"} here yet
            </label>
          )}
        </>
      )}

      <Refusal error={error} />
      {note && (
        <p className={note.ok ? 'hint' : 'alert'} role={note.ok ? 'status' : 'alert'}>
          {note.text}
        </p>
      )}
      {!progress && (
        <div className="row">
          {plan && (
            <button type="button" className="primary" onClick={fill} disabled={writes === 0}>
              {writes === 0 ? 'Nothing to fill in' : `Fill in ${plural(writes, 'client or venue', 'clients and venues')}`}
            </button>
          )}
          {canRead && (
            <button type="button" className={plan ? 'secondary' : 'primary'} onClick={() => void post('read')} disabled={busy} aria-busy={busy}>
              {plan ? 'Read again' : 'Read clients and venues'}
            </button>
          )}
        </div>
      )}
      {plan && <p className="hint">Each change is kept in the history.</p>}
    </section>
  )
}

function Part({ n, title, hint, children }: { n: number; title: string; hint?: string; children?: ReactNode }) {
  if (n === 0) return null
  const head = (
    <span>
      <b>{n.toLocaleString('en-IE')}</b> {title}
    </span>
  )
  return (
    <li>
      {children ? (
        <details>
          <summary>{head}</summary>
          {hint && <p className="hint">{hint}</p>}
          {children}
        </details>
      ) : (
        head
      )}
    </li>
  )
}

const who = (c: Contact) => [c.name, c.email, c.phone].filter(Boolean).join(', ')

function Fills({ rows }: { rows: readonly RmsMemberFill[] }) {
  return (
    <ul className="hint">
      {rows.map((r) => (
        <li key={r.id}>
          <b>{r.name}</b>: {[r.address ? `address ${r.address.split('\n').join(', ')}` : '', ...r.contacts.map((c) => `contact ${who(c)}`)].filter(Boolean).join('; ')}
        </li>
      ))}
    </ul>
  )
}

function Adds({ rows }: { rows: readonly RmsMemberAdd[] }) {
  return (
    <ul className="hint">
      {rows.map((r) => (
        <li key={r.rmsId}>
          <b>{r.name}</b>
          {r.address ? `, ${r.address.split('\n').join(', ')}` : ''}
          {r.contacts.length ? ` (${plural(r.contacts.length, 'contact')})` : ''}
        </li>
      ))}
    </ul>
  )
}
