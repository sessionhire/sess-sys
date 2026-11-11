import { plural, quoteNumberLabel, spanLabel, type View } from "@sh/shared";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { personHref } from "./crew/PersonScreen.tsx";
import { plain, wordsOf } from "./crew/People.tsx";
import { Empty } from "./Empty.tsx";
import { Heading, type IconName } from "./Icon.tsx";
import { Top } from "./jobs/common.tsx";
import { useAccess } from "./role.ts";
import { MENU } from "./Up.tsx";
import { useView } from "./view.ts";

/**
 * One search for everything (review of 11 November 2026, finding 13): jobs, quotes by number, clients, venues, people,
 * products and numbered kit, from the magnifier in the top bar on every screen, or / at a desk. Each list keeps its own Find
 * for narrowing that list; this is for "where is it", when you don't yet know which area it lives in. It reads what's on
 * the device, so it works with no signal, and a role sees what it's sent (ADR 0042): no quotes without money, say.
 *
 * What's typed is kept while the app is open, so Back from a result comes back to the same results.
 */

let typed = "";
const listeners = new Set<() => void>();
function useTyped(): [string, (next: string) => void] {
  const now = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => typed,
  );
  return [
    now,
    (next) => {
      typed = next;
      for (const fn of listeners) fn();
    },
  ];
}

interface Found {
  key: string;
  href: string;
  title: string;
  /** What else it is, on the line under: "Sat 2 Nov · Aviva Stadium", "Lighting", "SH-000123 · in Bay A3". */
  line: string;
  /** Its name starts with what was typed: these come first. */
  first: boolean;
}

interface Group {
  key: string;
  label: string;
  icon: IconName;
  found: Found[];
}

/** How many of a group show before "Show all": a screen's worth across the groups. */
const SHOWN = 5;

/** Every word typed is somewhere in what's searched, fadas and apostrophes aside, as each list's Find matches. */
const matches = (
  words: readonly string[],
  ...fields: (string | null | undefined)[]
) => {
  const hay = plain(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
};
const startsWith = (words: readonly string[], name: string) =>
  plain(name).startsWith(words[0] ?? "");
const ordered = (found: Found[]) =>
  found.sort((a, b) => Number(b.first) - Number(a.first));

export function search(
  view: View,
  query: string,
  can: { money: boolean },
): Group[] {
  const words = wordsOf(query);
  if (!words.length) return [];
  const groups: Group[] = [];
  const { jobs, clients, venues } = view.jobs;

  // Jobs, newest first after a name match: the one being worked on is usually the latest of its name.
  const quotes = can.money
    ? jobs.flatMap((job) =>
        view.money.quotesOf(job.id).map((quote) => ({ job, quote })),
      )
    : [];
  const quoteNumbers = new Map<string, string[]>();
  for (const { job, quote } of quotes)
    if (quote.number)
      quoteNumbers.set(job.id, [
        ...(quoteNumbers.get(job.id) ?? []),
        quoteNumberLabel(quote),
      ]);
  const byNewest = [...jobs].sort((a, b) =>
    (b.span?.start ?? "9999").localeCompare(a.span?.start ?? "9999"),
  );
  groups.push({
    key: "jobs",
    label: "Jobs",
    icon: "calendar",
    found: ordered(
      byNewest
        .filter((j) =>
          matches(
            words,
            j.name,
            j.client?.name,
            j.venue?.name,
            ...(quoteNumbers.get(j.id) ?? []),
          ),
        )
        .map((j) => ({
          key: j.id,
          href: `#jobs/${encodeURIComponent(j.id)}`,
          title: j.name,
          line: [
            j.span ? spanLabel(j.span) : "No dates yet",
            j.client?.name,
            j.venue?.name,
          ]
            .filter(Boolean)
            .join(" · "),
          first: startsWith(words, j.name),
        })),
    ),
  });

  // A quote by its number ("Q1042", "1042"): straight to the job's Quote tab.
  if (can.money) {
    const numbered = quotes.filter(
      ({ quote }) =>
        quote.number &&
        quote.latest &&
        words.every(
          (w) =>
            plain(quoteNumberLabel(quote)).includes(w) ||
            String(quote.number) === w,
        ),
    );
    groups.push({
      key: "quotes",
      label: "Quotes",
      icon: "document",
      found: numbered.map(({ job, quote }) => ({
        key: quote.id,
        href: `#jobs/${encodeURIComponent(job.id)}/quote`,
        title: `${quoteNumberLabel(quote)} · ${job.name}`,
        line: [job.client?.name, job.span ? spanLabel(job.span) : ""]
          .filter(Boolean)
          .join(" · "),
        first: true,
      })),
    });
  }

  groups.push({
    key: "clients",
    label: "Clients",
    icon: "company",
    found: ordered(
      clients
        .filter((c) => matches(words, c.name, ...c.contacts.map((x) => x.name)))
        .map((c) => {
          const n = jobs.filter((j) => j.clientId === c.id).length;
          return {
            key: c.id,
            href: `#jobs/clients/${encodeURIComponent(c.id)}`,
            title: c.name,
            line: plural(n, "job", "jobs"),
            first: startsWith(words, c.name),
          };
        }),
    ),
  });

  groups.push({
    key: "venues",
    label: "Venues",
    icon: "venue",
    found: ordered(
      venues
        .filter((v) => matches(words, v.name, v.address))
        .map((v) => ({
          key: v.id,
          href: `#jobs/venues/${encodeURIComponent(v.id)}`,
          title: v.name,
          line: v.address ?? "",
          first: startsWith(words, v.name),
        })),
    ),
  });

  groups.push({
    key: "people",
    label: "People",
    icon: "people",
    found: ordered(
      view.crew.people
        .filter((p) => matches(words, p.name, p.email, p.phone, ...p.skills))
        .map((p) => ({
          key: p.id,
          href: personHref(p.id),
          title: p.name,
          line: [
            p.kind === "staff" ? "Staff" : "Freelancer",
            p.skills.slice(0, 3).join(", "),
          ]
            .filter(Boolean)
            .join(" · "),
          first: startsWith(words, p.name),
        })),
    ),
  });

  const w = view.warehouse;
  groups.push({
    key: "products",
    label: "Products",
    icon: "kit",
    found: ordered(
      w.models
        .filter((m) => matches(words, m.name, m.category, m.department))
        .map((m) => ({
          key: m.id,
          href: `#stock/product/${encodeURIComponent(m.id)}`,
          title: m.name,
          line: [m.department, m.category].filter(Boolean).join(" · "),
          first: startsWith(words, m.name),
        })),
    ),
  });

  // Kit by its number, old tag or serial: only when what's typed has a digit in it, so a word doesn't list every item of a product.
  const number = query.trim();
  if (/\d/.test(number) && number.length >= 2) {
    const n = plain(number).replace(/\s+/g, "");
    const items = [...w.assets.values()].filter((a) =>
      [a.number, a.oldNumber, a.serial, ...a.formerNumbers].some(
        (x) => x && plain(x).replace(/\s+/g, "").includes(n),
      ),
    );
    groups.push({
      key: "items",
      label: "Kit by number",
      icon: "label",
      found: items
        .map((a) => ({
          key: a.id,
          href: `#stock/item/${encodeURIComponent(a.id)}`,
          title: `${a.number || "No number yet"} · ${a.model?.name ?? "Unknown product"}`,
          line: [
            a.serial ? `Serial ${a.serial}` : "",
            a.oldNumber ? `Old tag ${a.oldNumber}` : "",
            a.at ? `at ${a.at.name}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          first: plain(a.number).replace(/\s+/g, "") === n,
        }))
        .sort(
          (a, b) =>
            Number(b.first) - Number(a.first) || a.title.localeCompare(b.title),
        ),
    });
  }
  return groups.filter((g) => g.found.length);
}

export function SearchScreen() {
  const view = useView();
  const access = useAccess();
  const [query, setQuery] = useTyped();
  const field = useRef<HTMLInputElement>(null);
  // Opened to type: the field has the cursor, on a phone too, as the magnifier is pressed to search.
  useEffect(() => field.current?.focus(), []);
  const money = access.can("money");
  const groups = useMemo(
    () => search(view, query, { money }),
    [view, query, money],
  );
  const total = groups.reduce((n, g) => n + g.found.length, 0);
  const asked = wordsOf(query).length > 0;
  return (
    <div className="app search-page">
      <Top
        view={view}
        title="Menu"
        up={{ steps: [MENU], here: "Search" }}
        heading="Search"
        lead={
          <input
            ref={field}
            className="search"
            type="search"
            enterKeyHint="search"
            placeholder={
              money
                ? "A job, quote number, client, venue, person, product or kit number"
                : "A job, client, venue, person, product or kit number"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search everything"
          />
        }
      />
      <p className="sr-only" role="status">
        {asked
          ? total
            ? `${plural(total, "result", "results")}`
            : "Nothing found"
          : ""}
      </p>
      {!asked ? (
        <section className="card">
          <p className="hint">
            Search every job, client, venue, person and product on this device
            {money ? ", and quotes by number" : ""}. Type a label's number to
            find that piece of kit. Each list's own Find narrows just that list.
          </p>
        </section>
      ) : total === 0 ? (
        <section className="card">
          <Empty>Nothing called “{query.trim()}” on this device.</Empty>
        </section>
      ) : (
        groups.map((g) => <Results key={g.key} group={g} />)
      )}
    </div>
  );
}

function Results({ group }: { group: Group }) {
  const [all, setAll] = useState(false);
  const shown = all ? group.found : group.found.slice(0, SHOWN);
  return (
    <section className="card" aria-label={group.label}>
      <Heading
        icon={group.icon}
      >{`${group.label} (${group.found.length})`}</Heading>
      <ul className="job-list">
        {shown.map((f) => (
          <li key={f.key}>
            <a className="job-row" href={f.href}>
              <div>
                <b>{f.title}</b>
                {f.line && <p>{f.line}</p>}
              </div>
            </a>
          </li>
        ))}
      </ul>
      {!all && group.found.length > SHOWN && (
        <button type="button" className="link" onClick={() => setAll(true)}>
          Show all {group.found.length}
        </button>
      )}
    </section>
  );
}
