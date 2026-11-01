import type { Module } from '../migrations.ts'

/**
 * Trackers on kit (ADR 0107), versioned on their own (trackers_schema_version)
 * and backed up and exported like every module's tables.
 *
 * - `trackers`: one row a tracker, made the first time it reports, with
 *   the item it's on, where it last said it was, and where that is against
 *   where the item should be (`place`, shared/src/trackers.ts).
 * - `tracker_reports`: every report as it came, for the record and for a
 *   trail later. A report sent twice (the maker's server sends again when
 *   an answer is lost) is kept once, by its tracker, time and number.
 * - `tracker_settings`: the one row, "trackers": whether the company uses
 *   them, and where the warehouse is.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS trackers (
    id            text PRIMARY KEY,
    maker         text NOT NULL CHECK (maker IN ('digital-matter')),
    serial        text NOT NULL,
    name          text NOT NULL DEFAULT '',
    asset_id      text REFERENCES assets(id),
    first_heard   timestamptz NOT NULL DEFAULT now(),
    last_heard    timestamptz NOT NULL DEFAULT now(),
    lat           double precision CHECK (lat BETWEEN -90 AND 90),
    lng           double precision CHECK (lng BETWEEN -180 AND 180),
    accuracy_m    double precision,
    fix_at        timestamptz,
    battery_mv    integer,
    place         jsonb NOT NULL DEFAULT '{"kind":"unknown","why":"noFix"}',
    place_since   timestamptz NOT NULL DEFAULT now(),
    archived      boolean NOT NULL DEFAULT false,
    CHECK ((lat IS NULL) = (lng IS NULL) AND (lat IS NULL) = (fix_at IS NULL)),
    CHECK (NOT archived OR asset_id IS NULL)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS trackers_on_asset ON trackers (asset_id) WHERE asset_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS tracker_reports (
    id           bigserial PRIMARY KEY,
    tracker_id   text NOT NULL REFERENCES trackers(id),
    at           timestamptz NOT NULL,
    seq          bigint NOT NULL DEFAULT 0,
    received_at  timestamptz NOT NULL DEFAULT now(),
    lat          double precision,
    lng          double precision,
    accuracy_m   double precision,
    battery_mv   integer,
    reason       integer,
    UNIQUE (tracker_id, at, seq)
  );
  CREATE TABLE IF NOT EXISTS tracker_settings (
    id         text PRIMARY KEY,
    used       boolean NOT NULL DEFAULT false,
    home_lat   double precision CHECK (home_lat BETWEEN -90 AND 90),
    home_lng   double precision CHECK (home_lng BETWEEN -180 AND 180),
    radius_m   integer NOT NULL DEFAULT 300 CHECK (radius_m BETWEEN 50 AND 5000),
    CHECK ((home_lat IS NULL) = (home_lng IS NULL))
  );
  `,
]

export const TRACKERS: Module = { versionTable: 'trackers_schema_version', migrations: MIGRATIONS }
