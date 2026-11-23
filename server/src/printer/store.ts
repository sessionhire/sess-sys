import type { Queryable } from '../db.ts'

/** The one label printer's row (ADR 0191). */
export const PRINTER_ID = 'zt411'

export interface PrinterRow {
  used: boolean
  secretHash: string | null
  pairedAt: string | null
  pairedOrigin: string | null
  serial: string | null
  name: string | null
  lastSeen: string | null
}

const NONE: PrinterRow = { used: false, secretHash: null, pairedAt: null, pairedOrigin: null, serial: null, name: null, lastSeen: null }

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

export async function getPrinter(q: Queryable): Promise<PrinterRow> {
  const { rows } = await q.query<Record<string, unknown>>(
    'SELECT used, secret_hash, paired_at, paired_origin, serial, name, last_seen FROM label_printers WHERE id = $1',
    [PRINTER_ID]
  )
  const r = rows[0]
  if (!r) return NONE
  return {
    used: r.used === true,
    secretHash: (r.secret_hash as string | null) ?? null,
    pairedAt: iso(r.paired_at),
    pairedOrigin: (r.paired_origin as string | null) ?? null,
    serial: (r.serial as string | null) ?? null,
    name: (r.name as string | null) ?? null,
    lastSeen: iso(r.last_seen),
  }
}

export async function setPrinterUsed(q: Queryable, on: boolean) {
  await q.query(`INSERT INTO label_printers (id, used) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET used = EXCLUDED.used`, [PRINTER_ID, on])
}

/** A new password, for the address the file was made for: whatever printer was paired before is forgotten. */
export async function pairPrinter(q: Queryable, secretHash: string, origin: string) {
  await q.query(
    `INSERT INTO label_printers (id, used, secret_hash, paired_at, paired_origin) VALUES ($1, true, $2, now(), $3)
     ON CONFLICT (id) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, paired_at = EXCLUDED.paired_at, paired_origin = EXCLUDED.paired_origin, serial = NULL, name = NULL, last_seen = NULL`,
    [PRINTER_ID, secretHash, origin]
  )
}

export async function forgetPrinter(q: Queryable) {
  await q.query('UPDATE label_printers SET secret_hash = NULL, paired_at = NULL, paired_origin = NULL, serial = NULL, name = NULL, last_seen = NULL WHERE id = $1', [PRINTER_ID])
}

/** The first serial number to connect after pairing: only if none is kept yet, so two at once can't both win. */
export async function lockSerial(q: Queryable, serial: string): Promise<boolean> {
  const { rows } = await q.query('UPDATE label_printers SET serial = $2 WHERE id = $1 AND serial IS NULL RETURNING serial', [PRINTER_ID, serial])
  return rows.length > 0
}

export async function printerSeen(q: Queryable, serial: string, name: string | undefined) {
  await q.query('UPDATE label_printers SET last_seen = now(), name = coalesce($3, name) WHERE id = $1 AND serial = $2', [PRINTER_ID, serial, name ?? null])
}
