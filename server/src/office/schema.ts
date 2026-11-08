import type { Module } from '../migrations.ts'

/**
 * Settings, starting with the office's own details (audit finding 10).
 * Versioned on their own (office_schema_version), so they never fight the
 * crew migrations. One row per setting, by id; "office" is the only one
 * for now, and
 * "reading" (ADR 0046) for whether heads of department see crew rates.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS settings (
    id          text PRIMARY KEY,
    name        text NOT NULL DEFAULT '',
    phone       text,
    email       text,
    updated_at  timestamptz NOT NULL DEFAULT now()
  );
  `,
  // What heads of department read (ADR 0046): on the "reading" row, whether a director lets them see crew rates.
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS heads_see_rates boolean;`,
  // Whether the app prompts messages to crew (ADR 0048): on the "messages" row, off until the office says.
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS prompt_messages boolean;`,
  // The company's VAT number and address, on the "office" row, for the printed quote (ADR 0042's open item).
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS vat_number text, ADD COLUMN IF NOT EXISTS address text;`,
  // Whether the company uses timesheets (ADR 0090): on the "timesheets" row, off until the office says.
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS use_timesheets boolean;`,
  // Whether Claude is offered inside the app (ADR 0096): on the "assistant" row, off until the office says.
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS use_assistant boolean;`,
  // The colour each cable length takes (ADR 0106), on the "cables" row; and the company's logo on the "logo" row, kept as a photo is.
  `
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS cable_colours jsonb;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS photo_key text UNIQUE, ADD COLUMN IF NOT EXISTS photo_type text CHECK (photo_type IN ('jpeg', 'png', 'webp')),
    ADD COLUMN IF NOT EXISTS photo_bytes integer, ADD COLUMN IF NOT EXISTS photo_at timestamptz;
  `,
  // The first day whose bookings are asked for a timesheet (ADR 0110), on the "timesheets" row. A company already using them starts
  // from the day it last changed the switch, its best record of when they went on, and devices hear of it as the server's own bookkeeping.
  `
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS timesheets_from text;
  WITH dated AS (
    UPDATE settings SET timesheets_from = to_char(updated_at AT TIME ZONE 'Europe/Dublin', 'YYYY-MM-DD')
    WHERE id = 'timesheets' AND use_timesheets AND timesheets_from IS NULL
    RETURNING id, name, phone, email, timesheets_from
  )
  INSERT INTO changes (entity, entity_id, op, data)
  SELECT 'setting', id, 'put',
    jsonb_build_object('id', id, 'name', name, 'phone', phone, 'email', email, 'useTimesheets', true, 'timesheetsFrom', timesheets_from)
  FROM dated;
  `,
  // Whether freelancers' links check a new phone with a code, and can be emailed when lost (ADR 0114): on the "links" row, off until the office says.
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS check_links boolean;`,
]

export const OFFICE: Module = { versionTable: 'office_schema_version', migrations: MIGRATIONS }
