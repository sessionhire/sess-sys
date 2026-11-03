import { PURCHASE_OPEN, type PurchaseRequest, type PurchaseStatus, type PurchaseVote } from '@sh/shared'
import type { Queryable } from '../db.ts'

/** Reading the purchase list back as devices see it (ADR 0077). */

const REQUEST = `id, title, details, link, department, asked_by, asked_by_name, asked_on::text, status, notes`

type Row = Record<string, any>

export const toPurchase = (r: Row): PurchaseRequest => ({
  id: r.id,
  title: r.title,
  details: r.details,
  link: r.link,
  department: r.department ?? null,
  askedBy: r.asked_by ?? null,
  askedByName: r.asked_by_name,
  askedOn: r.asked_on,
  status: r.status as PurchaseStatus,
  notes: r.notes,
})

export async function getPurchase(q: Queryable, id: string, lock = false) {
  const { rows } = await q.query(`SELECT ${REQUEST} FROM purchase_requests WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
  return rows[0] ? toPurchase(rows[0]) : undefined
}

export async function getVote(q: Queryable, id: string): Promise<PurchaseVote | undefined> {
  const { rows } = await q.query<{ id: string; request_id: string; person_id: string }>('SELECT id, request_id, person_id FROM purchase_votes WHERE id = $1', [id])
  return rows[0] ? { id: rows[0].id, requestId: rows[0].request_id, personId: rows[0].person_id } : undefined
}

/** A request as a freelancer's link page shows it (ADR 0077, on their link): with who asked by name, how many voted, and whether they did. */
export interface PurchaseOnLink extends PurchaseRequest {
  askerName: string
  votes: number
  mine: boolean
}

/** The whole list for one person's link page, most votes first, then the newest. */
export async function purchasesFor(q: Queryable, personId: string): Promise<PurchaseOnLink[]> {
  const { rows } = await q.query<Row>(
    `SELECT ${REQUEST.split(', ').map((c) => `r.${c}`).join(', ')},
            COALESCE(NULLIF(p.known_as, ''), p.name, '') AS asker,
            (SELECT count(*)::int FROM purchase_votes v WHERE v.request_id = r.id) AS votes,
            EXISTS (SELECT 1 FROM purchase_votes v WHERE v.request_id = r.id AND v.person_id = $1) AS mine
       FROM purchase_requests r LEFT JOIN people p ON p.id = r.asked_by
      ORDER BY votes DESC, r.asked_on DESC, r.id`,
    [personId]
  )
  return rows.map((r) => ({ ...toPurchase(r), askerName: String(r.asker || r.asked_by_name || 'Someone'), votes: Number(r.votes), mine: r.mine === true }))
}

/** How many requests are still to decide or to buy, for the line on a freelancer's page that leads to the list. */
export async function openPurchases(q: Queryable): Promise<number> {
  const { rows } = await q.query<{ n: number }>(`SELECT count(*)::int AS n FROM purchase_requests WHERE status = ANY($1)`, [PURCHASE_OPEN])
  return rows[0]?.n ?? 0
}
