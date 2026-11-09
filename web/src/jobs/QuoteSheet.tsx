import {
  irishToday,
  lineCents,
  linesByGroup,
  linesUnder,
  setCents,
  money,
  pctWord,
  spanLabel,
  VAT_LABELS,
  venueLabel,
  type JobView,
  type LineKind,
  type QuoteLine,
  type QuoteTotals,
  type QuoteView,
  type View,
  RATE_UNIT,
  lineSaving,
  depositCents,
  paymentTermsLine,
  letterDay,
  quoteNumberLabel,
  validUntil,
  type QuoteSettings,
  quoteContact,
} from '@sh/shared'
import { logoOf } from '../Picture.tsx'
import { Fragment, useState } from 'react'
import { Empty } from '../Empty.tsx'
import { Sideways } from '../more.tsx'
import { chargeWords } from './QuoteLine.tsx'

/**
 * The quote as the client is sent it (ADR 0042): the A4 page, its lines and
 * its totals.
 */

const KIND_WORDS: Record<LineKind, string> = { kit: 'Kit', crew: 'Crew', other: 'Other' }

export function Lines({ lines }: { lines: readonly QuoteLine[] }) {
  // A package's kit (ADR 0116) is folded under its line on screen, a press away, and printed under it on paper.
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set())
  if (!lines.length) return <Empty>No lines.</Empty>
  const toggle = (id: string) =>
    setShown((now) => {
      const next = new Set(now)
      if (!next.delete(id)) next.add(id)
      return next
    })
  return (
    <Sideways className="quote-table-wrap">
      <table className="quote-table quote-lines">
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col" className="n">How many</th>
            <th scope="col" className="n">Days</th>
            <th scope="col" className="n">Price</th>
            <th scope="col" className="n">VAT</th>
            <th scope="col" className="n">Amount</th>
          </tr>
        </thead>
        {linesByGroup(lines).map((g) => (
          <tbody key={g.group}>
            <tr className="group">
              <th scope="rowgroup" colSpan={6}>
                {g.group || KIND_WORDS[g.lines[0]!.kind]}
              </th>
            </tr>
            {g.lines.map((l) => {
              // Words only (ADR 0128): a heading or a note as written, across the row, with no numbers.
              if (l.words)
                return (
                  <tr key={l.id} className="words">
                    <td colSpan={6}>{l.what}</td>
                  </tr>
                )
              const under = linesUnder(lines, l.id)
              const byKit = under.length > 0 && !l.unitCents && !!l.packageId
              const open = shown.has(l.id)
              return (
                <Fragment key={l.id}>
                  <tr className={under.length ? 'set-head' : undefined}>
                    <td>
                      {l.what}
                      {l.includes && <small className="includes">{l.includes}</small>}
                      {lineSaving(l) > 0 && (
                        <small className="package-saving">
                          {money(lineSaving(l))} off its items’ {money(lineCents({ ...l, discountPct: undefined, unitCents: l.fullCents! }))}
                        </small>
                      )}
                      {/* On a phone the four middle columns fold into this line under the name, so the amount stays in sight (audit, 5 November 2026, finding 59). */}
                      <small className="line-sum">
                        {byKit ? 'Its kit, priced below' : chargeWords(l)} · VAT{"\u00a0"}{VAT_LABELS[l.vat]}
                      </small>
                      {under.length > 0 && (
                        <button type="button" className="link quiet set-toggle" aria-expanded={open} onClick={() => toggle(l.id)}>
                          {open ? 'Hide what’s in it' : `What’s in it (${under.length})`}
                        </button>
                      )}
                    </td>
                    <td className="n">{l.qty}</td>
                    <td className="n">{byKit ? '' : l.per === 'once' ? '' : l.rate === 'weekly' ? `${l.days} wk` : l.days.toLocaleString('en-IE')}</td>
                    <td className="n">{byKit || l.included ? '' : `${money(l.unitCents)} ${l.per === 'once' ? 'once' : `a ${RATE_UNIT[l.rate ?? 'daily']}`}`}</td>
                    <td className="n">{VAT_LABELS[l.vat]}</td>
                    <td className="n">
                      {l.included && !under.length ? 'Included' : money(under.length ? setCents(l, lines) : lineCents(l))}
                      {l.discountPct ? <small className="less"> less {pctWord(l.discountPct)}</small> : null}
                    </td>
                  </tr>
                  {under.map((u) => {
                    const priced = u.unitCents > 0 && !u.included
                    return (
                      <tr key={u.id} className={open ? 'set-line' : 'set-line folded'}>
                        <td>
                          {u.what}
                          <small className="line-sum">{priced ? chargeWords(u) : 'Included'}</small>
                        </td>
                        <td className="n">{u.qty}</td>
                        <td className="n">{priced && u.per !== 'once' ? (u.rate === 'weekly' ? `${u.days} wk` : u.days.toLocaleString('en-IE')) : ''}</td>
                        <td className="n">{priced ? `${money(u.unitCents)} a ${RATE_UNIT[u.rate ?? 'daily']}` : ''}</td>
                        <td className="n" />
                        <td className="n">{priced ? money(lineCents(u)) : 'Included'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        ))}
      </table>
    </Sideways>
  )
}

export function Totals({ totals, agreed }: { totals: QuoteTotals; agreed: boolean }) {
  return (
    <dl className="quote-totals">
      {totals.discount > 0 && (
        <>
          <div>
            <dt>Subtotal</dt>
            <dd>{money(totals.subtotal)}</dd>
          </div>
          <div>
            <dt>{agreed ? `Agreed discount, ${pctWord(totals.discountPct)}` : `Discount, ${pctWord(totals.discountPct)}`}</dt>
            <dd>−{money(totals.discount)}</dd>
          </div>
        </>
      )}
      <div>
        <dt>Before VAT</dt>
        <dd>{money(totals.net)}</dd>
      </div>
      {totals.rates.map((r) => (
        <div key={r.rate}>
          <dt>
            VAT at {VAT_LABELS[r.rate]}
            {totals.rates.length > 1 && ` on ${money(r.net)}`}
          </dt>
          <dd>{money(r.vat)}</dd>
        </div>
      ))}
      <div className="total">
        <dt>Total</dt>
        <dd>{money(totals.gross)}</dd>
      </div>
    </dl>
  )
}

/**
 * The A4 page: what the client is sent, printed from the browser or saved as a PDF there. Drawn as the PDF the server
 * makes is (server/src/finance/quote-pdf.ts, ADR 0139): the brand's band, the logo and "Quote" with its number, who it's
 * for, the job and the dates in three columns, the lines, the total in the brand's red, the terms and bank details side by
 * side, and the company's letterhead at the foot. The page's own margins carry the page count and leave the browser no
 * room for its address, title and date (QuoteSheetPage).
 */
export function QuoteSheet({ q, job, office, quoting }: { q: QuoteView; job: JobView; office: View['office']; quoting: QuoteSettings }) {
  const today = irishToday()
  const made = q.sentOn ?? irishToday(new Date(q.savedAt))
  const reach = [office.details?.phone, office.details?.email].filter(Boolean).join(' · ')
  // Who it's from, once Admin's office details have them: the company's address on one line, and its VAT number.
  const address = office.details?.address?.trim().split(/\s*\n\s*/).filter(Boolean).join(', ')
  const vat = office.details?.vatNumber?.trim()
  const to = job.client
  const contact = to ? quoteContact(to.contacts, q.forName) : undefined
  const logo = logoOf(office)
  const number = quoteNumberLabel(q)
  // A number guessed with no signal is printed as a draft's until the server gives it (finding 20 of the quote flow audit),
  // so a PDF saved meanwhile can't go out with a number another quote may take.
  const draft = q.status === 'draft' || !!q.numberPending
  const deposit = q.depositPct ? depositCents(q.totals.gross, q.depositPct) : 0
  // When this client pays (ADR 0119), beside the total, as the PDF has it.
  const pays = paymentTermsLine(to?.paymentTerms)
  const terms = quoting.terms.trim()
  const bank = quoting.bank.trim()
  return (
    <>
      <header className="sheet-head">
        {/* The company's logo from Admin › Company › Labels, as the emailed PDF has it (ADR 0128; finding 16). */}
        <div className="brand">{logo ? <img className="logo" src={logo} alt="Session Hire" /> : <p className="company">Session Hire</p>}</div>
        <dl className="sheet-facts">
          <dt>{draft ? 'Draft quote' : 'Quote'}</dt>
          <dd className={draft ? undefined : 'number'}>{q.numberPending ? `${number} (once it's saved)` : number || (draft ? 'Not sent yet' : '')}</dd>
        </dl>
      </header>
      <section className="sheet-to" aria-label="For">
        <div>
          {to && (
            <>
              <p className="sheet-label">Prepared for</p>
              <p className="who">{to.name}</p>
              {contact && <p>{contact.name}</p>}
              {to.address?.trim() && <p className="lines muted">{to.address.trim()}</p>}
            </>
          )}
        </div>
        <div>
          <p className="sheet-label">The job</p>
          <h1>{job.name}</h1>
          {job.span && <p>{spanLabel(job.span)}</p>}
          {job.venue && <p className="muted">{venueLabel(job.venue)}</p>}
        </div>
        <dl className="sheet-dates">
          <div>
            <dt className="sheet-label">Date</dt>
            <dd>{letterDay(made)}</dd>
          </div>
          <div>
            <dt className="sheet-label">Valid until</dt>
            <dd>{letterDay(validUntil(q, today))}</dd>
          </div>
        </dl>
      </section>
      <Lines lines={q.lines} />
      <div className="sheet-sums">
        {(deposit > 0 || pays) && (
          <div className="sheet-aside">
            <p className="sheet-label">{deposit > 0 ? 'Deposit' : 'Paying'}</p>
            {deposit > 0 && (
              <p className="deposit">
                A deposit of {pctWord(q.depositPct!)}, <b>{money(deposit)}</b>, confirms the booking.
              </p>
            )}
            {pays && <p className="deposit pays">{pays}</p>}
          </div>
        )}
        <Totals totals={q.totals} agreed={q.agreedCents != null} />
      </div>
      {q.notes && (
        <section className="sheet-notes">
          <h2 className="sheet-label">Notes</h2>
          <p className="notes">{q.notes}</p>
        </section>
      )}
      {(terms || bank) && (
        <div className="sheet-small">
          {terms && (
            <section className="sheet-terms">
              <h2 className="sheet-label">Terms</h2>
              <p className="lines">{terms}</p>
            </section>
          )}
          {bank && (
            <section className="sheet-terms bank">
              <h2 className="sheet-label">Paying by bank transfer</h2>
              <p className="lines">{bank}</p>
              {q.number && !q.numberPending && <p>Please give quote {q.number} as the reference.</p>}
            </section>
          )}
        </div>
      )}
      <p className="sheet-closing">
        Prices are in euro: each line is how many, at its price, for the days charged or once.
        {reach && ` Questions: ${reach}.`}
      </p>
      <footer className="from">
        <p className="company-line">{['Session Hire', address].filter(Boolean).join(' · ')}</p>
        {(reach || vat) && <p>{[reach, vat && `VAT number ${vat}`].filter(Boolean).join(' · ')}</p>}
      </footer>
    </>
  )
}

/** A string as CSS writes one in `content`, quotes and backslashes escaped. */
const cssString = (s: string) => `"${s.replace(/[\\"]/g, '\\$&').replace(/\n/g, ' ')}"`

/**
 * The page the sheet prints on: A4, with something in the top and bottom margins (the page count, and the brand's band
 * along the top edge), which is what tells Chrome and Edge to leave out their own header and footer, the tab's title,
 * the date and the app's address (ADR 0139). A browser that doesn't draw margins this way prints the sheet as it is.
 */
export function QuoteSheetPage({ q }: { q: QuoteView }) {
  const number = quoteNumberLabel(q)
  const which = q.status !== 'draft' && !q.numberPending && number ? `Quote ${number} · ` : ''
  const band = 'background: linear-gradient(#ee3744 0 2.5mm, transparent 2.5mm);'
  const css = `html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@page { size: A4; margin: 14mm 15mm 16mm;
  @top-left-corner { content: ""; ${band} }
  @top-left { content: ""; ${band} }
  @top-center { content: ""; ${band} }
  @top-right { content: ""; ${band} }
  @top-right-corner { content: ""; ${band} }
  @bottom-right { content: ${cssString(which)} "Page " counter(page) " of " counter(pages); font: 7.5pt 'IBM Plex Sans', system-ui, sans-serif; color: #5c636e; vertical-align: top; padding-top: 3mm; }
}`
  return <style>{css}</style>
}
