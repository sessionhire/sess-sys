import { useEffect } from 'react'
import { useAccess } from '../role.ts'
import { useView } from '../view.ts'
import { newQuoteAsked, useHash } from './common.tsx'
import { NewQuoteScreen } from './Money.tsx'

/**
 * What's left of Quotes (#quotes, ADR 0088) now it isn't a page of its own (Colly, 12 November 2026: "quotes are generated within
 * the context of a Job, and the quote is just a status of it"). Each job's quote is its Quote tab (ADR 0140); Jobs finds them by
 * Filter › Quote; the ones waiting on the office are Money › To follow up. New quote keeps its own page at #quotes/new (ADR 0140,
 * part 7), so the planner's quick quote and the N then Q keys still land there. Any other Quotes address, from a bookmark or an
 * old link, goes on to where its quotes are now: To follow up for whoever reads the money, the jobs for anyone else.
 */
export function QuotesScreen() {
  const view = useView()
  const hash = useHash()
  const money = useAccess().can('money')
  const asked = newQuoteAsked(hash)
  const newQuote = asked !== undefined && money
  const to = newQuote ? undefined : money ? '#jobs/money/follow-up' : '#jobs'
  useEffect(() => {
    // Replaced rather than added, so Back doesn't land on the old address and come straight forward again.
    if (to) location.replace(to)
  }, [to])
  if (newQuote) return <NewQuoteScreen key={asked} view={view} on={asked || undefined} />
  return null
}

