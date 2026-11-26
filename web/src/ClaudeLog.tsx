import type { ClaudeLog, ClaudeRead, ReadDecision, ReadDid, View } from '@sh/shared'
import { useState } from 'react'
import { when } from './format.ts'
import { Heading } from './Icon.tsx'
import { getJson, useAsked } from './jobs/rms.ts'
import { StatusPill, type PillTone } from './StatusPill.tsx'

/**
 * Admin › Claude's log (ADR 0200): every email thread Claude read in the operations mailbox lately, newest first, so
 * the office can see what it read, what it made of each and why, and what that cost, and not only the threads that
 * became jobs. A thread it read as nothing to quote is listed with its reason, so a missed enquiry can be found; one
 * it couldn't read says so, and whether it was set aside. The mail itself stays in Gmail: only its subject, sender
 * and Claude's reason are kept here, and only for 90 days.
 */

type Show = 'all' | 'made' | 'aside' | 'problems'
const SHOWS: { key: Show; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'made', label: 'Made something' },
  { key: 'aside', label: 'Not for a quote' },
  { key: 'problems', label: 'Problems' },
]

const DECISION: Record<ReadDecision, { word: string; tone: PillTone }> = {
  enquiry: { word: 'New enquiry', tone: 'confirmed' },
  job: { word: 'About a job', tone: 'confirmed' },
  other: { word: 'Not for a quote', tone: 'cancelled' },
  skipped: { word: 'Not sent to Claude', tone: 'cancelled' },
  failed: { word: 'Couldn’t read', tone: 'pending' },
  'set-aside': { word: 'Set aside', tone: 'pending' },
}

/** What Claude did, said in the order it matters to the office: the job first, then what came with it. */
const ORDER: ReadDid['what'][] = ['job', 'quote', 'days', 'client', 'venue', 'redraft', 'offered', 'linked']

/** US cents as Anthropic bills them: "$0.04", or "under a cent". */
export const usd = (c: number) => (c === 0 ? 'nothing' : c < 1 ? 'under a cent' : `$${(c / 100).toFixed(2)}`)

export function ClaudeLogCard({ view }: { view: View }) {
  const [show, setShow] = useState<Show>('all')
  const [again, setAgain] = useState(0)
  const log = useAsked(true, `claude-log-${show}`, () => getJson<ClaudeLog>(`/api/assistant/log?show=${show}`), again)
  const l = log.state === 'ready' ? log.data : undefined
  return (
    <section className="card claude-log" aria-labelledby="claude-log-head">
      <Heading icon="mail" id="claude-log-head">
        What Claude read
      </Heading>
      <p className="hint">
        Every email thread Claude read in the operations mailbox in the last {l?.days ?? 90} days, newest first: what it took it to be and why, what it made
        or changed, and what that read cost. A thread is listed again each time new mail comes on it. The mail itself stays in Gmail.
      </p>
      <div className="pills" role="group" aria-label="Show">
        {SHOWS.map((s) => (
          <button key={s.key} type="button" aria-pressed={show === s.key} onClick={() => setShow(s.key)}>
            {s.label}
            {l && ` (${l.counts[s.key]})`}
          </button>
        ))}
      </div>
      {log.state === 'loading' && (
        <p className="hint" role="status" aria-busy="true">
          Getting what Claude read…
        </p>
      )}
      {log.state === 'offline' && <p className="hint">Needs signal: what Claude read is kept on the server.</p>}
      {log.state === 'gone' && (
        <p className="alert" role="alert">
          {log.error}
        </p>
      )}
      {l && l.reads.length === 0 && (
        <p className="empty">
          {show === 'all'
            ? 'Nothing read yet. Claude looks at the mailbox every five minutes while it’s on, from the moment it was turned on.'
            : show === 'problems'
              ? 'No problems: Claude read every thread it was given.'
              : 'None of these.'}
        </p>
      )}
      {l && l.reads.length > 0 && (
        <ul className="claude-reads">
          {l.reads.map((r) => (
            <ReadRow key={r.id} r={r} view={view} />
          ))}
        </ul>
      )}
      {l && (
        <div className="actions">
          <button type="button" className="link" onClick={() => setAgain((n) => n + 1)}>
            Check again
          </button>
        </div>
      )}
    </section>
  )
}

function ReadRow({ r, view }: { r: ClaudeRead; view: View }) {
  const d = DECISION[r.decision]
  const job = r.projectId ? view.jobs.jobs.find((j) => j.id === r.projectId) : undefined
  return (
    <li className="claude-read">
      <div className="claude-read-head">
        <b>{r.subject || 'No subject'}</b>
        <StatusPill tone={d.tone}>{d.word}</StatusPill>
      </div>
      <small className="hint">
        {[r.from || 'Someone', r.messages === 1 ? '1 mail' : `${r.messages} mails`, `read ${when(r.at)}`, `cost ${usd(r.costCents)}`].join(' · ')}
      </small>
      {r.reason && <p>{r.reason}</p>}
      {r.problem && <p className="claude-read-problem">Why: {r.problem}</p>}
      {r.did.length > 0 && (
        <ul className="claude-did">
          {[...r.did].sort((a, b) => ORDER.indexOf(a.what) - ORDER.indexOf(b.what)).map((x, i) => (
            <li key={`${x.what}-${x.id}-${i}`}>
              <Did x={x} view={view} projectId={r.projectId} />
            </li>
          ))}
        </ul>
      )}
      {!r.did.length && job && (
        <p>
          <a href={`#jobs/${encodeURIComponent(job.id)}`}>{job.name}</a>
        </p>
      )}
    </li>
  )
}

/** One thing Claude did, in words, linked to what it made where that's still there. */
function Did({ x, view, projectId }: { x: ReadDid; view: View; projectId: string | null }) {
  const job = (id: string | null) => (id ? view.jobs.jobs.find((j) => j.id === id) : undefined)
  const jobLink = (id: string | null, tab = '') => {
    const j = job(id)
    return j ? <a href={`#jobs/${encodeURIComponent(j.id)}${tab}`}>{j.name}</a> : <span className="muted">a job since deleted</span>
  }
  switch (x.what) {
    case 'job':
      return <>Made the enquiry {jobLink(x.id)}</>
    case 'client': {
      const c = view.jobs.clients.find((c) => c.id === x.id)
      return c ? (
        <>
          Added the client <a href={`#jobs/clients/${encodeURIComponent(c.id)}`}>{c.name}</a>, not found among yours
        </>
      ) : (
        <>Added a client, since deleted or combined</>
      )
    }
    case 'venue': {
      const v = view.jobs.venues.find((v) => v.id === x.id)
      return v ? (
        <>
          Added the venue <a href={`#jobs/venues/${encodeURIComponent(v.id)}`}>{v.name}</a>, not found among yours
        </>
      ) : (
        <>Added a venue, since deleted or combined</>
      )
    }
    case 'days':
      return <>Gave the job its days</>
    case 'quote':
      return <>Drafted the quote on {jobLink(projectId, '/quote')}</>
    case 'redraft':
      return <>Brought the draft quote on {jobLink(projectId, '/quote')} up to date with the new mail</>
    case 'offered':
      return <>Offered changes on the quote for {jobLink(projectId, '/quote')}, to take or leave</>
    case 'linked':
      return <>Linked the thread to {jobLink(x.id)}</>
  }
}
