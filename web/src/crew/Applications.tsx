import { APPLICANT_LEVEL, DEFAULT_LEVEL, levelLine, notVetted, type ApplicantEmailNotGone, listHeading, STANDING_HEADINGS, APPLICATION_KEPT_MONTHS, APPLICATION_WARN_DAYS, applicationGoesOn, irishToday, newId, phoneShown, TRADES_AS_LABELS, type ApplicationView, type OfficeView, type View } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { Empty } from '../Empty.tsx'
import { Heading } from '../Icon.tsx'
import { Top } from '../jobs/common.tsx'
import { showToast } from '../notices.ts'
import { useAccess } from '../role.ts'
import { rateText } from '../format.ts'
import { client } from '../sync.ts'
import { CrewViews } from './CrewViews.tsx'
import { getJson, useAsked } from '../jobs/rms.ts'

/**
 * Applications to join the crew (ADR 0190), at #crew/applications: what people who'd like work sent from the public
 * Apply page, newest first. One job: decide each one. Take on makes them a freelancer at Level 0 (an applicant), out of
 * Offer to… until someone vets them, and opens nothing for them; Turn down deletes what they sent. Neither tells the
 * person anything: the office rings or emails them the usual way.
 */

/**
 * An application nobody acts on goes after 6 months (ADR 0193), as a turned-down one does: said on it for its last week,
 * so the office can still decide it.
 */
function GoesSoon({ appliedAt }: { appliedAt: string }) {
  const goes = applicationGoesOn(appliedAt)
  const today = irishToday()
  const left = Math.round((Date.parse(goes) - Date.parse(today)) / 86_400_000)
  if (left > APPLICATION_WARN_DAYS) return null
  const day = new Date(`${goes}T12:00:00Z`).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <p className="warn-line" role="note">
      Waiting {APPLICATION_KEPT_MONTHS} months: it’s deleted {left <= 0 ? 'today' : `on ${day}`} unless you take them on or turn them down first.
    </p>
  )
}

/** The page's address for crew to apply at, as the app is open on: the server's own page (ADR 0186). */
export const applyAddress = () => `${location.origin}/join`

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Dublin' })

export function ApplicationsScreen({ view }: { view: View }) {
  const mayCrew = useAccess().can('crew')
  const all = view.applications.all
  return (
    <div className="app crew applications-screen">
      <Top view={view} title="Crew" views={<CrewViews view={view} current="applications" />} heading="Applications" />
      <ApplyLink office={view.office} waiting={all.length} />
      {all.length === 0 ? (
        <section className="card">
          <Empty>No applications waiting. Each one sent from the Apply page comes in here for you to take on or turn down.</Empty>
        </section>
      ) : (
        <>
          {/* The list Home's count lands on, headed with the same number (user flows of 24 November 2026, gap 4). */}
          <section className="card plain">
            <h2 className="group">{listHeading(STANDING_HEADINGS.applications, all.length)}</h2>
          </section>
          {all.map((a) => (
            <ApplicationCard key={a.id} a={a} mayDecide={mayCrew} emails={view.office.emailApplicants} />
          ))}
        </>
      )}
      {mayCrew && <EmailsNotGone />}
      {mayCrew && <NotVetted view={view} />}
    </div>
  )
}

/**
 * Emails to people who applied that haven't gone (user flows of 24 November 2026, gap 7): Take on says they're emailed
 * the link to their page, and when the mailbox couldn't send it nothing said so. Asked of the server, so only with
 * signal; with none, or nothing to say, the card isn't there.
 */
function EmailsNotGone() {
  const loaded = useAsked(true, 'applicant-emails', () => getJson<{ notGone: ApplicantEmailNotGone[] }>('/api/applications/emails'))
  const list = loaded.state === 'ready' ? loaded.data.notGone : []
  if (!list.length) return null
  return (
    <section className="card" aria-label="Emails that didn't go">
      <Heading icon="mail">Emails that didn't go ({list.length})</Heading>
      <ul className="plain">
        {list.map((e) => (
          <li key={e.id}>
            <p className="warn-line" role="note">
              {e.kind === 'taken' ? (
                e.person ? (
                  <>
                    <b>{e.person.name}</b>'s email with the link to their page {e.state === 'failed' ? "didn't go" : "hasn't gone yet"}. {e.problem}{' '}
                    {e.state === 'failed' ? <a href={`#crew/person/${e.person.id}`}>Send their page yourself</a> : 'It’s tried again each minute for a day.'}
                  </>
                ) : (
                  <>An email to someone taken on {when(e.madeAt)} {e.state === 'failed' ? "didn't go" : "hasn't gone yet"}. {e.problem}</>
                )
              ) : (
                <>
                  The email to someone turned down {when(e.madeAt)} {e.state === 'failed' ? "didn't go" : "hasn't gone yet"}. {e.problem}{' '}
                  {e.state === 'failed' && 'What they sent is deleted, so there’s nobody to write to.'}
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Taken on and not vetted yet (gap 6): nothing listed who was still waiting to be moved up a level, so someone taken on
 * could sit out of Offer to… for good. Each opens their page, where their link is sent, and moves up in a press.
 */
function NotVetted({ view }: { view: View }) {
  const { run, error } = useAct()
  const people = view.crew.people.filter((p) => notVetted(p) && !p.levelHidden)
  if (!people.length) return null
  return (
    <section className="card" aria-label="Taken on, not vetted yet">
      <Heading icon="people">Taken on, not vetted yet ({people.length})</Heading>
      <p className="hint">At {levelLine(APPLICANT_LEVEL)} they're on the crew list and out of Offer to…. Move someone up once you're happy to offer them work.</p>
      <ul className="plain not-vetted">
        {people.map((p) => (
          <li key={p.id}>
            <a href={`#crew/person/${p.id}`}>
              <b>{p.name}</b>
            </a>
            <small>{[p.department, p.skills.slice(0, 3).join(', ')].filter(Boolean).join(' · ') || 'No department or skills yet'}</small>
            <button type="button" onClick={() => void run(() => client.mutate('person.level', { id: p.id, level: DEFAULT_LEVEL }))}>
              Move up<span className="sr-only"> {p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <Refusal error={error} />
    </section>
  )
}

/** Where crew apply, to copy and share, or why there's nowhere yet. */
function ApplyLink({ office, waiting }: { office: OfficeView; waiting: number }) {
  const [copied, setCopied] = useState(false)
  const settings = useAccess().can('settings')
  if (!office.takeApplications)
    return (
      <section className="card plain">
        <p className="hint">
          The Apply page is off, so nobody can send a new application{waiting ? ': those already in stay here until you decide them' : ''}.{' '}
          {settings ? (
            <>
              Turn it on under <a href="#admin/company">Admin › Company › Applications to join</a>.
            </>
          ) : (
            'The office or a director turns it on under Admin.'
          )}
        </p>
      </section>
    )
  const address = applyAddress()
  return (
    <section className="card plain">
      <p className="hint">
        Anyone with this address can apply: put it on the website or send it to someone who asks about work.{' '}
        {office.emailApplicants
          ? 'Each one is emailed when you take them on, with the link to their own page, or turn them down.'
          : 'Nothing is sent to them; you get in touch the usual way.'}
      </p>
      <div className="actions">
        <a className="button" href={address} target="_blank" rel="noreferrer">
          Open the Apply page
        </a>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(address).then(() => setCopied(true))}>
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </div>
    </section>
  )
}

function ApplicationCard({ a, mayDecide, emails }: { a: ApplicationView; mayDecide: boolean; emails: boolean }) {
  const money = useAccess().can('money')
  const { run, error } = useAct()
  const [asking, setAsking] = useState<'take' | 'drop'>()
  const take = () => {
    setAsking(undefined)
    const personId = newId()
    void run(() => client.mutate('application.take', { id: a.id, personId })).then((ok) => {
      if (ok)
        showToast({
          id: `taken-${a.id}`,
          title: `Took on ${a.name}`,
          // What happens next is on their page (user flows of 24 November 2026, gap 6): their link to send, and moving them up.
          body: `On the Crew tab as an applicant, Level 0: out of Offer to… until you move them up a level. ${emails ? 'They’re emailed the link to their page.' : 'Open their page to send them their link.'}`,
          href: `#crew/person/${personId}`,
          action: 'Open',
        })
    })
  }
  const drop = () => {
    setAsking(undefined)
    void run(() => client.mutate('application.drop', { id: a.id })).then((ok) => {
      if (ok) showToast({ id: `dropped-${a.id}`, title: `Turned down ${a.name}`, body: emails ? 'What they sent is deleted. They’re emailed to say so, politely.' : 'What they sent is deleted. Nobody told them.' })
    })
  }
  return (
    <section className="card application" aria-label={a.name}>
      <Heading icon="person">{a.name}</Heading>
      {a.known && (
        <p className="warn-line" role="note">
          Already on the Crew tab as <a href={`#crew/person/${a.known.id}`}>{a.known.name}</a>
          {a.known.archived ? ', archived' : ''}, with the same {a.known.email?.trim().toLowerCase() === a.email ? 'email' : 'phone'}. Turn this down
          rather than take them on twice.
        </p>
      )}
      <GoesSoon appliedAt={a.appliedAt} />
      <dl className="facts">
        <div>
          <dt>Applied</dt>
          <dd>{when(a.appliedAt)}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{a.department ?? 'None the roles name'}</dd>
        </div>
        <div>
          <dt>Mobile</dt>
          <dd>
            <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`}>{phoneShown(a.phone)}</a>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${a.email}`}>{a.email}</a>
          </dd>
        </div>
        <div>
          <dt>Day rate</dt>
          <dd>{a.rateHidden ? rateText(null, true) : a.dayRateCents === null ? 'Not said' : rateText(a.dayRateCents, false)}</dd>
        </div>
        <div>
          <dt>Works as</dt>
          <dd>{a.rateHidden ? 'Hidden' : a.tradesAs ? TRADES_AS_LABELS[a.tradesAs] : 'Not said'}</dd>
        </div>
        <div className="wide">
          <dt>What they do</dt>
          <dd>{a.skills.length ? a.skills.join(', ') : 'Not said'}</dd>
        </div>
        {money && (
          <div className="wide">
            <dt>Payment details</dt>
            <dd>{a.paymentGiven ? 'Given, kept locked: on their page once you take them on' : 'Not given'}</dd>
          </div>
        )}
        <div className="wide">
          <dt>Based in</dt>
          <dd>{a.basedIn || 'Not said'}</dd>
        </div>
        <div className="wide">
          <dt>Experience</dt>
          <dd className="said">{a.about || 'Not said'}</dd>
        </div>
      </dl>
      {mayDecide &&
        (asking === 'drop' ? (
          <Confirm question={`Turn down ${a.name}?`} yes="Turn down" no="Keep it" loss onYes={drop} onNo={() => setAsking(undefined)}>
            What they sent is deleted and can't be brought back.{' '}
            {emails ? 'They get a short, polite email saying we have no work for them just now.' : 'Nobody tells them: ring or email them first if you’d like to.'}
          </Confirm>
        ) : asking === 'take' ? (
          <Confirm question={`Take on ${a.name} a second time?`} yes="Take on" no="Keep it" onYes={take} onNo={() => setAsking(undefined)}>
            {a.known?.name} is on the Crew tab with the same details already. Taking them on makes a second person.
          </Confirm>
        ) : (
          <div className="actions">
            <button type="button" className="primary" onClick={() => (a.known ? setAsking('take') : take())}>
              Take on
            </button>
            <button type="button" onClick={() => setAsking('drop')}>
              Turn down
            </button>
          </div>
        ))}
      <Refusal error={error} />
    </section>
  )
}
