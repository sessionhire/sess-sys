import { likelyAddress, newId, QUOTE_EMAIL_LIMITS, type QuoteAddressCheck, type QuoteEmail, type QuoteEmailPrefill, type QuoteSendState, type QuoteView } from '@sh/shared'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { when } from '../format.ts'
import { Icon } from '../Icon.tsx'
import { ask, NoAnswer, post, serverUrl } from '../server.ts'
import { client, syncSoon } from '../sync.ts'
import { useLate } from '../useLate.ts'
import { setSendingWords } from './quoteSend.ts'
import { getJson, useAsked } from './rms.ts'

/**
 * Sending a quote to the client by email (ADR 0101): a compose box filled
 * in by the server from the quote and the client's contacts, which the
 * office reads over, changes where it likes, and sends. It goes from
 * operations@ with the quote attached as a PDF; a draft is marked sent as
 * it goes, which gives it its number. Nothing here is kept on the device:
 * what went is on the quote's page once the server says so.
 */

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "a@b.ie, c@d.ie" as typed, split into addresses. */
const addressesOf = (typed: string) => typed.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean)

export function SendQuote({ q, onSent, onCancel }: { q: QuoteView; onSent: (email: QuoteEmail) => void; onCancel: () => void }) {
  const [again, setAgain] = useState(0)
  const loaded = useAsked(true, `${q.id}-${again}`, () => getJson<QuoteEmailPrefill>(`/api/quotes/${encodeURIComponent(q.id)}/email`), again)
  return (
    <div className="compose" role="group" aria-label="Send the quote by email">
      {loaded.state === 'loading' ? (
        <p className="hint">Getting the client's details…</p>
      ) : loaded.state === 'ready' ? (
        <Compose key={again} q={q} start={loaded.data} onSent={onSent} onCancel={onCancel} onAgain={() => setAgain((n) => n + 1)} />
      ) : (
        <>
          <p className="warn-line">{loaded.state === 'gone' ? loaded.error : 'The server can’t be reached, so the email can’t be put together. Try again with signal.'}</p>
          <div className="actions">
            <button type="button" onClick={() => setAgain((n) => n + 1)}>
              Try again
            </button>
            <button type="button" className="link" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

type Field = 'to' | 'subject'

/** Where Send is (ADR 0171): open, saving this device's changes, with Gmail, or asking whether a press with no answer went. */
type Going = 'idle' | 'saving' | 'sending' | 'checking'
const GOING_WORDS: Record<Exclude<Going, 'idle'>, string> = {
  saving: 'Saving your changes…',
  sending: 'Sending…',
  checking: 'Checking whether it went…',
}
/** How often, and how many times, a press with no answer is asked about before the office is told to look in Sent. */
const CHECK_EVERY_MS = 3_000
const CHECKS = 20

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

function Compose({ q, start, onSent, onCancel, onAgain }: { q: QuoteView; start: QuoteEmailPrefill; onSent: (email: QuoteEmail) => void; onCancel: () => void; onAgain: () => void }) {
  const [to, setTo] = useState(start.to.join(', '))
  const [subject, setSubject] = useState(start.subject)
  const [message, setMessage] = useState(start.message)
  // A copy to whoever sends it, on unless they take it off (ADR 0171): the proof in their own inbox, at no cost.
  const [copy, setCopy] = useState(true)
  const [touched, setTouched] = useState<Set<Field>>(new Set())
  const [tried, setTried] = useState(false)
  const [going, setGoing] = useState<Going>('idle')
  const [error, setError] = useState('')
  // What the mail system says of each address, asked once each is typed and left (ADR 0171).
  const [checked, setChecked] = useState<Map<string, QuoteAddressCheck>>(new Map())
  // This box's one press of Send (ADR 0171): sent again after a lost signal, it can't go twice.
  const key = useRef(newId())
  const busy = going !== 'idle'
  const late = useLate(busy)
  const ids = { to: useId(), subject: useId(), message: useId(), copy: useId() }
  const draft = q.status === 'draft'

  // Next says what Send says while it goes (ADR 0171).
  useEffect(() => {
    setSendingWords(q.projectId, going === 'idle' ? undefined : GOING_WORDS[going])
    return () => setSendingWords(q.projectId, undefined)
  }, [q.projectId, going])

  const addresses = addressesOf(to)
  const wrong = addresses.find((a) => !ADDRESS.test(a))
  const bounces = addresses.map((a) => checked.get(a.toLowerCase())?.problem).find(Boolean)
  const faults: Partial<Record<Field, string>> = {
    to: !addresses.length
      ? 'Say who it goes to.'
      : wrong
        ? `“${wrong}” doesn’t look like an email address.`
        : addresses.length > QUOTE_EMAIL_LIMITS.to
          ? `Up to ${QUOTE_EMAIL_LIMITS.to} addresses, please.`
          : (bounces ?? undefined),
    subject: subject.trim() ? undefined : 'A subject is needed.',
  }
  // A likely slip in a common domain, said as soon as it's typed and left, without stopping the send: "anna@gmial.com".
  const slips = addresses.map((a) => ({ a, better: checked.get(a.toLowerCase())?.suggest ?? likelyAddress(a) })).filter((x): x is { a: string; better: string } => !!x.better)
  // A fault shows once its field is left, or once Send is pressed (design system rule 18): never while it's being typed.
  const shown = (f: Field) => (touched.has(f) || tried ? faults[f] : undefined)
  const touch = (f: Field) => setTouched((was) => new Set(was).add(f))
  const problem = faults.to ?? faults.subject

  /** Asks the server about addresses not asked about yet; no signal leaves them unasked, which stops nothing. */
  const check = async (list: string[]): Promise<Map<string, QuoteAddressCheck>> => {
    const fresh = list.filter((a) => ADDRESS.test(a) && !checked.has(a.toLowerCase()))
    if (!fresh.length) return checked
    try {
      const { addresses: found } = await post<{ addresses: QuoteAddressCheck[] }>('/api/quotes/email/check', { to: fresh }, 8_000)
      const next = new Map(checked)
      for (const c of found) next.set(c.address.toLowerCase(), c)
      setChecked(next)
      return next
    } catch {
      return checked
    }
  }

  // Nothing typed here outlives the box, so the browser's own Back or a reload takes it away; that's said once something has changed.
  const changed = to !== start.to.join(', ') || subject !== start.subject || message !== start.message
  useEffect(() => {
    if (!changed && !busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [changed, busy])
  // The client's own addresses are asked about as the box opens, so a dead one is said before anyone presses Send.
  useEffect(() => {
    void check(start.to)
    // Once, as it opens.
  }, [])

  const done = (email: QuoteEmail) => {
    setGoing('idle')
    syncSoon()
    // Fetched when needed, as the still-out list does: notices.ts reaches the job screens through the messages, a loop otherwise.
    void import('../notices.ts').then(({ showToast }) => showToast({
      id: `quote-sent-${email.id}`,
      title: `${email.number ? `Quote ${email.number}` : 'The quote'} sent to ${email.to.length === 1 ? email.to[0] : `${email.to.length} people`}`,
      body: `${email.inSentAt ? 'In the Sent folder of ' : 'From '}${email.from}${email.copyTo ? `, with a copy to you` : ''}.`,
    }))
    onSent(email)
  }

  /** No answer came to the press: ask whether it went, rather than offer a Send that might go twice. */
  const findOut = async () => {
    setGoing('checking')
    for (let i = 0; i < CHECKS; i++) {
      try {
        const state = await ask<QuoteSendState>(`/api/quotes/${encodeURIComponent(q.id)}/email/sends/${encodeURIComponent(key.current)}`, undefined, 8_000)
        if (state.state === 'sent') return done(state.email)
        if (state.state === 'none') {
          setError('It didn’t go: nothing reached the client. Press Send to try again.')
          return setGoing('idle')
        }
        if (state.state === 'unsure') {
          setError('The server stopped while sending this, so it can’t tell whether it went. Look in the operations mailbox’s Sent folder; if it isn’t there, start the email again.')
          return setGoing('idle')
        }
      } catch {
        // Still no signal: keep asking.
      }
      await pause(CHECK_EVERY_MS)
    }
    setError('Still no answer from the server, so it can’t say whether the quote went. Press Send again once you have signal: it only goes once.')
    setGoing('idle')
  }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setTried(true)
    if (problem || !start.canSend) return
    setError('')
    // What's typed on this device goes first (ADR 0130), so the PDF the server draws has it all.
    if (client.pendingCount) {
      setGoing('saving')
      await client.sync().catch(() => undefined)
    }
    if (client.pendingCount) {
      setError('Changes made on this device haven’t reached the server yet, so the quote would go without them. Send it once it says Up to date.')
      setGoing('idle')
      return
    }
    setGoing('sending')
    // A last look at the addresses: one that can't take email stops it here, not as a bounce later.
    const known = await check(addresses)
    const dead = addresses.map((a) => known.get(a.toLowerCase())?.problem).find(Boolean)
    if (dead) {
      setGoing('idle')
      return
    }
    try {
      const { email } = await post<{ email: QuoteEmail }>(
        `/api/quotes/${encodeURIComponent(q.id)}/email`,
        { to: addresses, subject: subject.trim(), message, number: start.number, key: key.current, ...(start.me ? { copy } : {}) },
        60_000
      )
      done(email)
    } catch (err) {
      if (err instanceof NoAnswer || /still going/.test((err as Error).message)) return void findOut()
      setError((err as Error).message)
      setGoing('idle')
    }
  }
  const fault = (f: Field, id: string) => {
    const why = shown(f)
    return why ? (
      <small className="line-problem" id={`${id}-problem`} role="alert">
        {why}
      </small>
    ) : null
  }
  const bad = (f: Field, id: string) => (shown(f) ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-problem` } : {})

  return (
    // Not a <form>: the draft it opens under is one, and a form in a form is sent by the browser itself, leaving the app.
    <div role="form" aria-label="Send the quote by email">
      {!start.canSend && (
        <p className="warn-line">
          {start.why} <a href="#admin/connections">Admin › Connections</a>
        </p>
      )}
      <p className="hint compose-from">
        From {start.from ?? 'the operations mailbox'}, with <b>{start.fileName}</b> attached.{' '}
        <a href={serverUrl(`/api/quotes/${encodeURIComponent(q.id)}/pdf`)} target="_blank" rel="noopener">
          Look at the PDF
        </a>
        {draft ? `. Sending marks it sent, as quote ${start.number}, and it then stays as it is.` : '.'}
      </p>
      <label className="field" htmlFor={ids.to}>
        To
      </label>
      <input
        id={ids.to}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        onBlur={() => {
          touch('to')
          void check(addressesOf(to))
        }}
        inputMode="email"
        autoComplete="off"
        placeholder="name@client.ie, another@client.ie"
        aria-label="To"
        readOnly={busy}
        {...bad('to', ids.to)}
      />
      {fault('to', ids.to)}
      {slips.map(({ a, better }) => (
        <p className="hint address-slip" key={a}>
          Did you mean {better}?{' '}
          <button type="button" className="link" onClick={() => setTo(addressesOf(to).map((x) => (x === a ? better : x)).join(', '))} disabled={busy}>
            Use {better}
          </button>
        </p>
      ))}
      <label className="field" htmlFor={ids.subject}>
        Subject
      </label>
      <input id={ids.subject} value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => touch('subject')} maxLength={QUOTE_EMAIL_LIMITS.subject} aria-label="Subject" readOnly={busy} {...bad('subject', ids.subject)} />
      {fault('subject', ids.subject)}
      <label className="field" htmlFor={ids.message}>
        Message
      </label>
      <textarea id={ids.message} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={QUOTE_EMAIL_LIMITS.message} rows={9} aria-label="Message" readOnly={busy} />
      {start.me && (
        <label className="tick" htmlFor={ids.copy}>
          <input id={ids.copy} type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} disabled={busy} /> Send me a copy ({start.me})
        </label>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="primary" aria-busy={busy || undefined} disabled={!start.canSend} onClick={() => void send()}>
          {busy ? (late || going === 'checking' ? GOING_WORDS[going] : 'Send') : (
            <>
              <Icon name="send" /> Send
            </>
          )}
        </button>
        <button type="button" className="link" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {error && !busy && (
          <button type="button" className="link quiet" onClick={onAgain}>
            Start the email again
          </button>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? GOING_WORDS[going] : ''}
      </p>
    </div>
  )
}

/**
 * The emails a quote went in, newest first, each with the PDF that went, and how far it's known to have got (ADR 0171): taken
 * by Gmail, then found in the mailbox's Sent folder, and who had a copy.
 */
export function Emails({ emails }: { emails: readonly QuoteEmail[] }) {
  if (!emails.length) return null
  return (
    <ul className="plain quote-emails" aria-label="Emailed to the client">
      {emails.map((e) => (
        <li key={e.id}>
          <span className="sent-line">
            <Icon name="done" />
            <span>
              <b>Sent {when(e.at)}</b>
              {e.by ? ` by ${e.by}` : ''} to {e.to.join(', ')}
            </span>
          </span>
          <small>
            {e.inSentAt ? `In the Sent folder of ${e.from}` : `Gmail took it from ${e.from}; not yet seen in its Sent folder`}
            {e.copyTo ? ` · a copy went to ${e.copyTo}` : ''}
          </small>
          <small>
            {e.subject} ·{' '}
            <a href={serverUrl(`/api/quotes/emails/${encodeURIComponent(e.id)}/pdf`)} target="_blank" rel="noopener">
              The PDF that went
            </a>
          </small>
        </li>
      ))}
    </ul>
  )
}
