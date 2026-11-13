import { useSyncExternalStore } from 'react'

/**
 * The draft quote's Send, by job, so the job's Next button can be it (ADR 0166): with the quote finished, Next says Send quote
 * and a press of it does what the draft's own Send does, the email to the client with the PDF on it, or, while quotes don't go
 * by email, the numbered PDF to send. The draft says what its Send would do while it's open on the Quote tab; from another tab,
 * Next opens the Quote tab and asks the draft to send as it opens.
 */
export interface DraftSend {
  /** What the press says: "Send quote", "Generate PDF", or what stops it ("Send: 2 lines to finish"). */
  label: string
  /** Nothing stops it: the quote is whole and saved, or saving. */
  ready: boolean
  /** The email to the client is open under the quote, so its own Send is the press. */
  composing: boolean
  /** Its press is under way: marking it sent, before the PDF opens. */
  busy?: boolean
  press: () => void
}

const sends = new Map<string, DraftSend>()
const heard = new Set<() => void>()
const tell = () => {
  for (const f of heard) f()
}

/** Said by a draft while it's open; `undefined` once it closes. */
export function setDraftSend(jobId: string, send: DraftSend | undefined) {
  const was = sends.get(jobId)
  if (!send) {
    if (!was) return
    sends.delete(jobId)
    return tell()
  }
  if (was && was.label === send.label && was.ready === send.ready && was.composing === send.composing && !!was.busy === !!send.busy) {
    // The same words: keep the newest press without redrawing Next.
    sends.set(jobId, send)
    return
  }
  sends.set(jobId, send)
  tell()
}

/** The draft's Send for a job, while its draft is open on the Quote tab. */
export function useDraftSend(jobId: string): DraftSend | undefined {
  return useSyncExternalStore(
    (f) => (heard.add(f), () => void heard.delete(f)),
    () => sends.get(jobId)
  )
}

/** Next pressed away from the Quote tab: the draft sends once it opens there. */
const asked = new Set<string>()
export const askToSend = (jobId: string) => void asked.add(jobId)

/** Whether Next asked the draft to send as it opened; asked once. */
export function takeAskToSend(jobId: string): boolean {
  return asked.delete(jobId)
}

/**
 * Where the email to the client is while it goes (ADR 0171), by job, so Next says the same as the email's own Send: saving
 * the changes, sending, checking whether it went. Nothing while the box is only open.
 */
const going = new Map<string, string>()
export function setSendingWords(jobId: string, words: string | undefined) {
  if (going.get(jobId) === words) return
  if (words) going.set(jobId, words)
  else going.delete(jobId)
  tell()
}
export function useSendingWords(jobId: string): string | undefined {
  return useSyncExternalStore(
    (f) => (heard.add(f), () => void heard.delete(f)),
    () => going.get(jobId)
  )
}
