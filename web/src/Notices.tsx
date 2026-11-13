import { APP_VERSION, dsTiming, historyDays, historyTime, makerOf, NOTICE_WHY_WORDS, plan, plural, releasesSince, shortSoon, sortOutDays, type Notice, type NoticeLine, type View } from '@sh/shared'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth.ts'
import { Empty } from './Empty.tsx'
import { Icon } from './Icon.tsx'
import { Top } from './jobs/common.tsx'
import { QuotesToChase } from './jobs/Money.tsx'
import { SortOut } from './jobs/PlanScreen.tsx'
import { KitToCheck } from './stock/Trackers.tsx'
import { TodoCard } from './TodoCard.tsx'
import {
  dismissToast,
  isNew,
  jobOfNotice,
  linesOf,
  loadNotices,
  markAllRead,
  offerToYou,
  pauseToast,
  placeOf,
  resumeToast,
  setToastsOn,
  showToast,
  toastsOn,
  useNotices,
  useToasts,
} from './notices.ts'
import { useAccess } from './role.ts'
import { takeLoadedFrom } from './update.tsx'
import { MENU } from './Up.tsx'
import { useLate } from './useLate.ts'
import { useToday, useView } from './view.ts'

/**
 * Notifications (ADR 0058): the bell in the top bar with how many are new,
 * the list it opens (#notifications, under the Menu), and the pop-ups at the
 * screen's edge as changes come in. Built from the design system's badge,
 * toast and toaster; the list is the History tab's rows, narrowed to what's
 * this person's own.
 */

/**
 * Where pop-ups arrive: one region, there from the start so a screen reader
 * hears each as it's added, at the bottom corner, above the phone's bar.
 * Each has one action (Open, See them, or What's changed) and Dismiss, and waits while the
 * pointer or the keyboard is on it.
 */
export function Toaster() {
  const toasts = useToasts()
  // Back from loading a new version: what it changed, as the first pop-up (update.tsx).
  useEffect(() => sayWhatChanged(), [])
  return (
    <section className="toaster" aria-label="Notifications">
      {/* Polite, as role="status" is, without being a second status on the page beside the sync state. */}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast"
            data-leaving={t.leaving ? 'true' : undefined}
            onPointerEnter={() => pauseToast(t.id)}
            onPointerLeave={() => resumeToast(t.id)}
            onFocus={() => pauseToast(t.id)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && resumeToast(t.id)}
          >
            <div className="toast-body">
              <b>{t.title}</b>
              <small>{t.body}</small>
            </div>
            {t.href && (
              <div className="toast-actions">
                <a className="button" href={t.href} onClick={() => dismissToast(t.id)} {...(t.away ? { target: '_blank', rel: 'noreferrer' } : {})}>
                  {t.action}
                </a>
              </div>
            )}
            {/* Last in reading order, after the action, though it sits in the top corner. */}
            <button type="button" className="toast-dismiss icon-button" onClick={() => dismissToast(t.id)} aria-label={`Dismiss: ${t.title}`}>
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Back from loading a new version: a toast with what came in since the version this tab was on, from the changelog
 * (ADR 0071): the newest by name and how many more, and What's changed for the whole of each. Asked for as the toaster
 * first draws, so its timer starts when it can be seen. It stays `timing.undo` rather than `timing.notice`: a sentence
 * of news someone asked for takes longer than four seconds to read, and it waits while the pointer or the keyboard is
 * on it. It shows with news pop-ups turned off, being the result of their own tap. Nothing when the version didn't
 * change (a rebuild with no entry).
 */
function sayWhatChanged() {
  const from = takeLoadedFrom()
  if (!from) return
  const came = releasesSince(from)
  if (came.length === 0) return
  const more = came.length - 1
  showToast(
    {
      id: `version-${APP_VERSION}`,
      title: `Updated to ${APP_VERSION}`,
      body: more === 0 ? came[0]!.title : `${came[0]!.title}, and ${plural(more, 'other change')}`,
      href: '#admin/changes',
      action: "What's changed",
    },
    dsTiming.undo,
  )
}

/** The list: what others changed lately on what's yours, newest first, under the day it reached the server. */
export function NoticesScreen() {
  const view = useView()
  const auth = useAuth()
  const notices = useNotices()
  const late = useLate(notices.status === 'loading')
  const [popUps, setPopUps] = useState(toastsOn)
  // What was new as the list was opened stays marked while it's open, though opening it reads them.
  const [readAsOpened] = useState(notices.readUpTo)
  const [opened] = useState(() => notices.status === 'ready')
  const mark = opened ? readAsOpened : notices.readUpTo
  useEffect(() => void loadNotices(), [])
  useEffect(() => {
    if (notices.status === 'ready') void markAllRead()
  }, [notices.status, notices.notices[0]?.id])

  // Clashes and checks from today to four weeks out (ADR 0069), for whoever books crew: worked out on this device, so they show without signal too.
  const today = useToday()
  const access = useAccess()
  const booksCrew = access.can('crew')
  const seesMoney = access.can('money')
  const ahead = useMemo(() => (booksCrew ? plan(view, sortOutDays(today), today) : null), [booksCrew, view, today])

  const days = useMemo(() => historyDays(notices.notices), [notices.notices])
  const lines = useMemo(() => linesOf(notices.notices, view), [notices.notices, view])

  return (
    <div className="app notices">
      <Top view={view} title="Menu" up={{ steps: [MENU], here: 'Notifications' }} heading="Notifications" />

      <section className="card">
        <p className="hint">
          What others changed in the last 30 days on what's yours: the jobs you're on or made, the offers you sent, and your own details, bookings,
          leave and timesheets. Your own changes aren't here. They stay in the app: nobody is emailed or texted.
        </p>
        <label className="signal">
          <input
            type="checkbox"
            role="switch"
            checked={popUps}
            onChange={(e) => {
              setToastsOn(e.target.checked)
              setPopUps(e.target.checked)
            }}
          />
          <span>
            <b>Pop up as they come in</b>
            <small>
              {popUps
                ? 'Each change shows at the bottom of the screen for a few seconds, on this device.'
                : 'Off on this device: they wait here, counted on the bell.'}
            </small>
          </span>
        </label>
        {notices.status === 'ready' && !notices.found && auth.status === 'signed-in' && (
          <p className="hint">Your email isn't on anyone on the Crew tab, so only the jobs you made and the offers you sent are yours here.</p>
        )}
        {notices.status === 'loading' && late && <p className="hint">Getting your notifications…</p>}
        {notices.status === 'offline' && (
          <>
            <p className="hint">Notifications need signal: they're kept on the server, not on this device.</p>
            <button type="button" onClick={() => void loadNotices()}>
              Try again
            </button>
          </>
        )}
        {notices.status === 'ready' && notices.notices.length === 0 && (
          <Empty>When someone changes a job you're on, your leave or an offer you sent, it shows here.</Empty>
        )}
      </section>

      <TodoCard view={view} />
      {ahead && (
        <SortOut
          problems={ahead.problems}
          vanProblems={ahead.vanProblems}
          short={shortSoon(view.crew, today)}
          hint="Calls short of crew in the next three days, then clashes and checks from today to four weeks out. Each goes once it's sorted."
        />
      )}
      <KitToCheck view={view} />
      {seesMoney && <QuotesToChase view={view} />}

      {days.map((d) => lines.some((l) => l.day === d.day) && (
        <section className="card day" key={d.day} aria-labelledby={`notices-${d.day}`}>
          <h2 id={`notices-${d.day}`}>{d.label}</h2>
          <ol className="entries">
            {lines
              .filter((l) => l.day === d.day)
              .map((l) =>
                l.kind === 'one' ? (
                  <NoticeRow key={l.id} notice={l.notices[0]!} day={d.day} fresh={isNew(l.notices[0]!, mark)} view={view} />
                ) : (
                  <LineRow key={l.id} line={l} day={d.day} mark={mark} view={view} />
                ),
              )}
          </ol>
        </section>
      ))}
    </div>
  )
}

function NoticeRow({ notice: n, day, fresh, view }: { notice: Notice; day: string; fresh: boolean; view: View }) {
  // An offer to them is said to them, and opens their own page, where it's answered (UX sweep, 6 November 2026, move 6).
  const yours = offerToYou(n, view)
  // Someone else's change said as what it meant for them, with the history's words under it.
  const what = yours?.what ?? n.said ?? n.what
  const href = yours?.href ?? placeOf(n, view)
  return (
    <li className={fresh ? 'entry notice new' : 'entry notice'}>
      <p>
        {/* New in words as well as the dot: never colour alone. */}
        {fresh && (
          <span className="new-mark">
            <span className="dot" aria-hidden="true" />
            New<span className="sr-only">: </span>
          </span>
        )}
        {href ? (
          <a href={href} {...(yours?.href ? { target: '_blank', rel: 'noreferrer' } : {})}>
            {what}
          </a>
        ) : (
          what
        )}
      </p>
      {n.said && <p className="for-you">{n.what}</p>}
      {n.forYou && <p className="for-you">{n.forYou}</p>}
      <span className="meta">
        {makerOf(n)} · {NOTICE_WHY_WORDS[n.why]} · {historyTime(n.arrivedAt, day)}
      </span>
    </li>
  )
}

/**
 * Several changes as one line (audit, 20 October 2026, finding 68): a day's
 * to one job, opening the job; or one maker's to many jobs at once. Each
 * opens to show its changes.
 */
function LineRow({ line, day, mark, view }: { line: NoticeLine; day: string; mark: string | null; view: View }) {
  const newest = line.notices[0]!
  const oldest = line.notices.at(-1)!
  const fresh = line.notices.some((n) => isNew(n, mark))
  const makers = [...new Set(line.notices.map(makerOf))]
  const whys = [...new Set(line.notices.map((n) => NOTICE_WHY_WORDS[n.why]))]
  const jobId = line.kind === 'job' ? jobOfNotice(newest, view) : undefined
  const job = jobId ? view.jobs.jobs.find((j) => j.id === jobId) : undefined
  const from = historyTime(oldest.arrivedAt, day)
  const to = historyTime(newest.arrivedAt, day)
  const title = line.kind === 'job' ? `${plural(line.notices.length, 'change')} to ${job?.name ?? 'a job'}` : `${plural(line.notices.length, 'change')} to ${plural(line.jobs, 'job')} of yours at once`
  return (
    <li className={fresh ? 'entry notice new' : 'entry notice'}>
      <p>
        {fresh && (
          <span className="new-mark">
            <span className="dot" aria-hidden="true" />
            New<span className="sr-only">: </span>
          </span>
        )}
        {jobId ? <a href={`#jobs/${jobId}`}>{title}</a> : title}
      </p>
      <span className="meta">
        {makers.length <= 2 ? makers.join(' and ') : `${makers[0]} and ${plural(makers.length - 1, 'other')}`} · {whys.join(', ')} · {from === to ? to : `${from} to ${to}`}
      </span>
      <details className="notice-fold">
        <summary>Show {line.notices.length === 2 ? 'both' : `all ${line.notices.length}`}</summary>
        <ol>
          {line.notices.map((n) => {
            // Said to them here as on a line of its own: an offer to them opens their page, where it's answered.
            const yours = offerToYou(n, view)
            const what = yours?.what ?? n.said ?? n.what
            const href = yours?.href ?? placeOf(n, view)
            return (
              <li key={n.id}>
                {href ? (
                  <a href={href} {...(yours?.href ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    {what}
                  </a>
                ) : (
                  what
                )}
                {n.said && <span className="for-you"> {n.what}</span>}
                {n.forYou && <span className="for-you"> {n.forYou}</span>}
                <span className="meta">
                  {' '}
                  · {makerOf(n)} · {historyTime(n.arrivedAt, day)}
                </span>
              </li>
            )
          })}
        </ol>
      </details>
    </li>
  )
}
