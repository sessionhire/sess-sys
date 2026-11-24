import type { PersonView } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal } from '../act.tsx'
import { markSignedOut } from '../auth.ts'
import { Heading } from '../Icon.tsx'
import { showToast } from '../notices.ts'
import { useAccess } from '../role.ts'

const base = import.meta.env.VITE_API_BASE ?? ''

/**
 * Signing a member of staff out of the app on every phone and computer (the breach plan, docs/data-protection.md): for
 * a device lost or stolen while signed in. A director's, on the person's Details tab; they sign in again with Google.
 */
export function SignOutEverywhere({ person }: { person: PersonView }) {
  const access = useAccess()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!access.can('company') || person.kind !== 'staff' || !person.email?.trim()) return null
  const go = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${base}/api/people/${encodeURIComponent(person.id)}/sign-out`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (res.status === 401) markSignedOut()
      const body = (await res.json().catch(() => ({}))) as { ended?: number; error?: string }
      if (!res.ok) return setError(body.error ?? `The server answered ${res.status}.`)
      setAsking(false)
      showToast({
        id: `signed-out-${person.id}`,
        title: 'Signed out everywhere',
        body: body.ended ? `${person.name} is signed out on ${body.ended === 1 ? 'one device' : `${body.ended} devices`}.` : `${person.name} wasn’t signed in anywhere.`,
      })
    } catch {
      setError('Nothing was signed out: there’s no signal. Try again once it’s back.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card" aria-label="Signed in to the app">
      <Heading icon="locked">Signed in to the app</Heading>
      <p className="hint">If a phone or computer of theirs is lost or stolen, sign them out everywhere. They sign in again with Google on the devices they still have.</p>
      {asking ? (
        <Confirm question={`Sign ${person.name} out everywhere?`} yes="Sign out everywhere" no="Keep them signed in" loss onYes={() => void go()} onNo={() => setAsking(false)}>
          Every phone and computer they use the app on asks them to sign in again. Anything waiting to go up on a device goes once they do.
        </Confirm>
      ) : (
        <div className="actions">
          <button type="button" aria-busy={busy || undefined} disabled={busy} onClick={() => setAsking(true)}>
            Sign out everywhere
          </button>
        </div>
      )}
      <Refusal error={error} />
    </section>
  )
}
