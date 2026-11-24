import type { CommandArgs, Mutation } from '../commands.ts'
import type { QuoteHold } from '../jobs.ts'
import { DEFAULT_VALID_DAYS, deleteTyped, type Quote } from '../quotes.ts'
import { addDays } from './plan.ts'

type Held = Pick<Quote, 'id' | 'projectId' | 'version' | 'status' | 'sentOn' | 'validDays' | 'number'>

/**
 * A job's quote hold while a change to its quote waits to go (ADR 0194): worked out from the quotes this device holds with
 * the waiting changes on them, as the server works it out from its own (projects/store.ts), so a quote marked sent, answered
 * or deleted moves the job's kit and its follow-up at once, not when the server has it. Only the jobs such a change touches;
 * every other keeps the server's. A role sent no money holds no quotes and makes no such change, so it has none here.
 */
export function waitingQuoteHolds(
  quoteTable: Record<string, Quote> | undefined,
  outbox: readonly (Mutation & { appliedSeq?: number })[],
  cursor: number,
  had: (projectId: string) => QuoteHold | undefined
): Map<string, QuoteHold | undefined> {
  const out = new Map<string, QuoteHold | undefined>()
  const touching = outbox.filter(
    (m) => !(m.appliedSeq !== undefined && m.appliedSeq <= cursor) && (m.name === 'quote.sent' || m.name === 'quote.answer' || m.name === 'quote.delete' || m.name === 'quote.save')
  )
  // Only a change to how a quote stands moves a hold: saving a draft alone doesn't, so a job being written is never read.
  if (!touching.some((m) => m.name !== 'quote.save')) return out
  const quotes = new Map<string, Held>(Object.values(quoteTable ?? {}).map((q) => [q.id, q]))
  const jobs = new Set<string>()
  for (const m of touching) {
    switch (m.name) {
      case 'quote.save': {
        const a = m.args as CommandArgs<'quote.save'>
        const was = quotes.get(a.id)
        if (was && was.status !== 'draft') break
        const versions = [...quotes.values()].filter((q) => q.projectId === a.projectId)
        const before = was ?? versions.sort((x, y) => y.version - x.version)[0]
        quotes.set(a.id, {
          id: a.id,
          projectId: was?.projectId ?? a.projectId,
          version: was?.version ?? Math.max(0, ...versions.map((q) => q.version)) + 1,
          status: 'draft',
          sentOn: null,
          validDays: a.validDays ?? before?.validDays ?? DEFAULT_VALID_DAYS,
          number: was?.number ?? null,
        })
        break
      }
      case 'quote.sent': {
        const a = m.args as CommandArgs<'quote.sent'>
        const was = quotes.get(a.id)
        if (was?.status !== 'draft') break
        quotes.set(a.id, { ...was, status: 'sent', sentOn: a.on })
        jobs.add(was.projectId)
        break
      }
      case 'quote.answer': {
        const a = m.args as CommandArgs<'quote.answer'>
        const was = quotes.get(a.id)
        if (!was) break
        if (a.answer === 'none') quotes.set(a.id, { ...was, status: was.status === 'draft' ? 'draft' : 'sent' })
        else quotes.set(a.id, { ...was, status: a.answer, sentOn: was.sentOn ?? a.on })
        jobs.add(was.projectId)
        break
      }
      case 'quote.delete': {
        const a = m.args as CommandArgs<'quote.delete'>
        const was = quotes.get(a.id)
        if (!was || !deleteTyped(was, a.typed)) break
        quotes.delete(a.id)
        jobs.add(was.projectId)
        break
      }
    }
  }
  for (const job of jobs) {
    const newest = [...quotes.values()].filter((q) => q.projectId === job && q.status !== 'draft').sort((x, y) => y.version - x.version)[0]
    if (!newest) {
      // None left that went: one taken back holds nothing; a job that never had one sent has no hold, as the server says.
      out.set(job, had(job) ? {} : undefined)
      continue
    }
    if (newest.status === 'accepted') out.set(job, undefined)
    else if (newest.status === 'declined' || !newest.sentOn) out.set(job, {})
    else {
      const days = newest.validDays ?? DEFAULT_VALID_DAYS
      out.set(job, { validUntil: addDays(newest.sentOn, days), heldUntil: addDays(newest.sentOn, 2 * days) })
    }
  }
  return out
}
