import { CHANGELOG, APP_VERSION, isNewerVersion as newer, type Release } from '@sh/shared'
import { useEffect, useState } from 'react'
import { Top } from './jobs/common.tsx'
import { useAccess } from './role.ts'
import { ADMIN, MENU, type Step } from './Up.tsx'
import { useView } from './view.ts'

/**
 * Admin › What's changed (#admin/changes, ADR 0071): every version of the
 * app, newest first, in plain words, each with the pull requests and
 * decisions behind it for anyone who wants the detail. Read only; the list
 * itself is shared/src/changelog.ts.
 */

const REPO = 'https://github.com/sessionhire/sess-sys'

export const pad = (n: number) => String(n).padStart(4, '0')

export const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function ReleaseEntry({ release, heading: H = 'h2', fresh }: { release: Release; heading?: 'h2' | 'h3'; fresh?: boolean }) {
  return (
    <article className={fresh ? 'release new' : 'release'}>
      <H>
        {fresh && <span className="new-word">New: </span>}
        <span className="release-version">{release.version}</span> {release.title}
      </H>
      <p className="hint">{day(release.date)}</p>
      <p>{release.what}</p>
      <p className="hint release-refs">
        {release.prs.map((n) => (
          <a key={`pr${n}`} href={`${REPO}/pull/${n}`} target="_blank" rel="noreferrer">
            PR #{n}
          </a>
        ))}
        {release.adrs?.map((n) => (
          // The decision itself, which the server finds by its number (audit, 5 November 2026, finding 80).
          <a key={`adr${n}`} href={`/adr/${n}`} target="_blank" rel="noreferrer">
            Decision {pad(n)}
          </a>
        ))}
      </p>
    </article>
  )
}

/** Where this device keeps the version it last showed What's changed at (a convenience: lost, every entry just reads as seen). */
const SEEN = 'sh.changesSeen'

/** How many versions are drawn before the rest fold by month. */
const SHOWN = 5

const monthOf = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * The latest few, then the rest folded by month, with what's new since this
 * device last looked marked: the whole list was one page of 160 versions
 * (audit, 5 November 2026, finding 80). Anyone can open it, from You.
 */
export function ChangesScreen() {
  const view = useView()
  // Up to Admin for who has it; to You, where it's linked, for everyone else.
  const from: Step = useAccess().can('settings') ? ADMIN : { href: '#me', label: 'You' }
  const [seen] = useState(() => {
    try {
      return localStorage.getItem(SEEN) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(SEEN, APP_VERSION)
    } catch {
      // Nothing kept: next time nothing is marked new.
    }
  }, [])
  const fresh = (r: Release) => !!seen && newer(r.version, seen)
  const months = new Map<string, Release[]>()
  for (const r of CHANGELOG.slice(SHOWN)) months.set(monthOf(r.date), [...(months.get(monthOf(r.date)) ?? []), r])
  return (
    <div className="app account changes">
      <Top view={view} title="What's changed" up={{ steps: [MENU, from], here: "What's changed" }} heading="What's changed" />
      <p className="hint">You're on version {APP_VERSION}. Newest first. The middle number goes up for something new, the last for a fix.</p>
      <section className="card">
        {CHANGELOG.slice(0, SHOWN).map((r) => (
          <ReleaseEntry key={r.version} release={r} fresh={fresh(r)} />
        ))}
        {[...months].map(([month, releases]) => (
          <details key={month} className="release-month" open={releases.some(fresh) || undefined}>
            <summary>
              {month}: {releases.length === 1 ? '1 version' : `${releases.length} versions`}
            </summary>
            {releases.map((r) => (
              <ReleaseEntry key={r.version} release={r} heading="h3" fresh={fresh(r)} />
            ))}
          </details>
        ))}
      </section>
    </div>
  )
}

/** On Admin: the version, the latest change, and the way to the rest. */
export function ChangesCard() {
  const latest = CHANGELOG[0]!
  return (
    <section className="card">
      <h2>Version {APP_VERSION}</h2>
      <ReleaseEntry release={latest} heading="h3" />
      <a href="#admin/changes">See every change</a>
    </section>
  )
}
