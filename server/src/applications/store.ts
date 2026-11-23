import { APPLICATIONS_SETTING_ID, type Application, type TradesAs } from '@sh/shared'
import type { Queryable } from '../db.ts'

/** Reading applications to join back as devices see them (ADR 0190). */

export const APPLICATION = `id, first_name, last_name, email, phone, department, skills, day_rate_cents, trades_as, based_in, about, applied_at`

type Row = Record<string, any>

export const toApplication = (r: Row): Application => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  department: r.department ?? null,
  skills: r.skills ?? [],
  dayRateCents: r.day_rate_cents ?? null,
  tradesAs: (r.trades_as ?? null) as TradesAs | null,
  basedIn: r.based_in,
  about: r.about,
  appliedAt: new Date(r.applied_at).toISOString(),
})

export async function getApplication(q: Queryable, id: string, lock = false) {
  const { rows } = await q.query(`SELECT ${APPLICATION} FROM applications WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
  return rows[0] ? toApplication(rows[0]) : undefined
}

/** Whether the public Apply page takes applications (ADR 0190); off unless the office said. */
export async function takesApplications(q: Queryable): Promise<boolean> {
  const { rows } = await q.query<{ take_applications: boolean | null }>(`SELECT take_applications FROM settings WHERE id = $1`, [APPLICATIONS_SETTING_ID])
  return rows[0]?.take_applications === true
}
