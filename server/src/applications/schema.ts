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
  // Payment details (ADR 0193): given on the Apply page, kept locked with the application until it's taken on, then
  // with the person; never in the change feed. Here with the applications, as the Apply page is where most come from.
  `
  ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_sealed text;
  CREATE TABLE IF NOT EXISTS payment_details (
    person_id   text PRIMARY KEY REFERENCES people(id),
    sealed      text NOT NULL,
    changed_at  timestamptz NOT NULL DEFAULT now(),
    changed_by  text NOT NULL DEFAULT ''
  );
  `,
  // Emails to people who applied (ADR 0193), queued in the same change as taking them on or turning them down, so one
  // goes only if that happened, and sent just after from the operations mailbox. Who it's to and their first name are
  // cleared once it's gone or given up on, so a turned-down applicant's address isn't kept.
  `
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_applicants boolean;
  CREATE TABLE IF NOT EXISTS applicant_emails (
    id          text PRIMARY KEY,
    kind        text NOT NULL CHECK (kind IN ('taken', 'declined')),
    person_id   text,
    to_email    text,
    first_name  text,
    state       text NOT NULL CHECK (state IN ('queued', 'sent', 'failed')),
    problem     text,
    tries       integer NOT NULL DEFAULT 0,
    made_at     timestamptz NOT NULL DEFAULT now(),
    sent_at     timestamptz
  );
  CREATE INDEX IF NOT EXISTS applicant_emails_queued ON applicant_emails (made_at) WHERE state = 'queued';
  `,
  // PPS numbers not asked for (ADR 0193, 24 November 2026), where the company won't use them with Revenue: a business may
  // keep one only for that. Asked unless the office says.
  `
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS no_ppsn boolean;
  `,
]

export const APPLICATIONS: Module = { versionTable: 'applications_schema_version', migrations: MIGRATIONS }
