import { WHATSAPP_TEST_MAX, type OfficeView, type WhatsAppMode, type WhatsAppStatus } from '@sh/shared'
import { useEffect, useState } from 'react'
import { Refusal, useAct } from './act.tsx'
import { getJson, useAsked } from './jobs/rms.ts'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * Offers on WhatsApp under Admin › Connections (ADR 0125), for the office. Once on, an offer goes to its person on
 * WhatsApp by itself as the office makes it, straight to Meta with no provider between, to everyone who hasn't
 * turned them off on their own page. Off to start, as every way the app reaches anyone outside it is (ADR 0048);
 * Test sends only to the numbers listed, so it can be tried on the office's own phones before launch.
 */

const MODES: { mode: WhatsAppMode; label: string; line: string }[] = [
  { mode: 'off', label: 'Off', line: 'Nothing is sent on WhatsApp.' },
  { mode: 'test', label: 'Only to the numbers below', line: 'For trying it out: offers to anyone else are made as before, with nothing sent.' },
  { mode: 'on', label: 'On', line: 'Offers go on WhatsApp to everyone with a mobile who hasn’t turned them off.' },
]

const NAME_WAITING: Record<string, string> = {
  PENDING_REVIEW: 'Meta is still checking the name.',
  DECLINED: 'Meta turned the name down: change it in WhatsApp Manager.',
}

export function WhatsAppCard({ office }: { office: OfficeView }) {
  const { run, error } = useAct()
  const status = useAsked(true, 'whatsapp', () => getJson<WhatsAppStatus>('/api/whatsapp'))
  const s = status.state === 'ready' ? status.data : undefined
  const [numbers, setNumbers] = useState(office.whatsappTestTo.join('\n'))
  // What the server holds comes back as typed; another device's change shows here too, unless this one is mid-edit.
  const saved = office.whatsappTestTo.join('\n')
  useEffect(() => setNumbers(saved), [saved])
  const listed = numbers
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter(Boolean)
  const save = (mode: WhatsAppMode, testTo = listed) => void run(() => client.mutate('whatsapp.use', { mode, testTo }))
  const notSetUp = !!s && !s.configured
  return (
    <section className="card" aria-label="WhatsApp">
      <h2>
        Offers on WhatsApp <Pending pending={office.whatsappPending} />
      </h2>
      <p>
        When it’s on, an offer goes on WhatsApp by itself as soon as someone here makes it, at the same moment as the calendar invite. It shows the job,
        the days, the call time, the venue and the rate, with buttons to answer. Everyone gets offers there unless they turn them off on their own page.
        It goes straight to Meta, with nothing in between, and Meta charges about 1.5 cent a message.
      </p>
      <div className="choices" role="radiogroup" aria-label="Offers on WhatsApp">
        {MODES.map((m) => (
          <label key={m.mode} className="signal">
            <input
              type="radio"
              name="whatsapp"
              value={m.mode}
              checked={office.whatsapp === m.mode}
              // Only off until the server is set up, so it's never on with nothing behind it; always there to turn off.
              disabled={m.mode !== 'off' && notSetUp && office.whatsapp !== m.mode}
              onChange={() => save(m.mode)}
            />
            <span>
              <b>{m.label}</b>
              <small>{m.line}</small>
            </span>
          </label>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save(office.whatsapp)
        }}
      >
        <div className="field">
          <label htmlFor="whatsapp-test">Numbers to try it on</label>
          <small className="hint" id="whatsapp-test-hint">
            Up to {WHATSAPP_TEST_MAX} mobiles, one a line, with the country code. Each one must be a person in Crew with that mobile, and gets their offers
            on WhatsApp while this is on “Only to the numbers below”.
          </small>
          <textarea id="whatsapp-test" aria-describedby="whatsapp-test-hint" rows={3} value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="+353 87 123 4567" />
        </div>
        <button disabled={numbers === saved}>Save the numbers</button>
      </form>
      {notSetUp && (
        <p className="hint">
          Not set up on the server yet: whoever looks after the server adds WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Railway, from Session Hire’s Meta
          business account.
        </p>
      )}
      {s?.configured && s.problem && (
        <p className="alert" role="alert">
          Meta won’t say how the number is: {s.problem}
        </p>
      )}
      {s?.configured && s.number && (
        <p className="hint">
          Sending from {s.number}
          {s.name ? ` as “${s.name}”` : ''}.{s.nameStatus && NAME_WAITING[s.nameStatus] ? ` ${NAME_WAITING[s.nameStatus]}` : ''}
          {s.quality === 'RED' ? ' Meta rates its messages poorly and may stop it sending: look at WhatsApp Manager › Insights.' : ''}
          {s.quality === 'YELLOW' ? ' Meta’s rating of its messages has dropped: look at WhatsApp Manager › Insights.' : ''}
        </p>
      )}
      {s?.configured && s.missing.length > 0 && (
        <p className="hint">
          For answers to come back, add {s.missing.join(' and ')} in Railway, and give Meta this address for the app’s webhook: <code>{s.hook}</code>
        </p>
      )}
      <Refusal error={error} />
    </section>
  )
}
