import type { Module } from '../migrations.ts'

/**
 * Applications to join the crew (ADR 0190): what someone sent from the public Apply page, kept until the office takes
 * them on (into people) or turns them down, when the row goes. Versioned on its own (applications_schema_version), and
 * backed up and exported like every module's tables. Whether the page takes them is on the settings table's
 * "applications" row, put here so this module's changes stay together.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS applications (
    id               text PRIMARY KEY,
    first_name       text NOT NULL,
    last_name        text NOT NULL,
    email            text NOT NULL,
    phone            text NOT NULL,
    department       text,
    skills           jsonb NOT NULL DEFAULT '[]',
    day_rate_cents   integer,
    trades_as        text CHECK (trades_as IN ('sole-trader', 'company')),
    based_in         text NOT NULL DEFAULT '',
    about            text NOT NULL DEFAULT '',
    applied_at       timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS applications_email ON applications (lower(email));
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS take_applications boolean;
  `,
]

export const APPLICATIONS: Module = { versionTable: 'applications_schema_version', migrations: MIGRATIONS }
