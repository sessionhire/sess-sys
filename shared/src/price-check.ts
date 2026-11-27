import { z } from "zod";
import { csvText } from "./quotes.ts";

/**
 * Claude checks replacement values on the web (ADR 0206), on Admin › Data,
 * so the price sweep done by hand on 27 November 2026 can be run again from
 * the app. One product at a time: Claude searches European shops that ship
 * to Ireland for what one costs new today, in euro with Irish VAT, and says
 * how sure it is. Nothing is set here: the results go through the same
 * preview as a list (ADR 0204), and a person picks what is set.
 */

/** How sure Claude is of a price. Any Thomann price for the exact model is high (Colly, 27 November 2026). */
export const PRICE_CONFIDENCE = ["high", "medium", "low"] as const;
export type PriceConfidence = (typeof PRICE_CONFIDENCE)[number];
export const CONFIDENCE_LABELS: Record<PriceConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** At most this many web searches for one product's price. */
export const PRICE_SEARCHES = 3;
/** About what one product's check costs, in US cents: the words, and up to three searches. For the estimate before it starts. */
export const PRICE_CHECK_ABOUT_CENTS = 10;
/** How many products are checked at once from the page. */
export const PRICE_CHECKS_AT_ONCE = 3;

export const priceCheckAsk = z.object({
  modelId: z.string().trim().min(1, "Which product?").max(100),
});
export type PriceCheckAsk = z.input<typeof priceCheckAsk>;

// Read leniently, as Claude's other answers are (ADR 0096): anything out of range is dropped, never refused.
const words = (n: number) =>
  z.preprocess(
    (v) =>
      typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "",
    z.string(),
  );

export const priceCheckReading = z.object({
  /** Whether a shop's price for it, or for something close enough to go by, was found. */
  found: z.preprocess((v) => v === true, z.boolean()),
  /** What one costs new, in whole euro with Irish VAT (23%). */
  euro: z.preprocess(
    (v) =>
      typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 1_000_000
        ? Math.round(v)
        : null,
    z.number().nullable(),
  ),
  confidence: z.preprocess(
    (v) => (PRICE_CONFIDENCE.includes(v as PriceConfidence) ? v : "low"),
    z.enum(PRICE_CONFIDENCE),
  ),
  /** The shop the price is from, such as "Thomann". */
  shop: words(100),
  /** What was priced, as the shop names it, when it isn't plainly the product. */
  priced: words(200),
  /** A sentence: where the price came from and why it's this sure. */
  said: words(400),
  // Only https links are kept, so the page never links anywhere else.
  sources: z
    .preprocess(
      (v) => (Array.isArray(v) ? v.slice(0, 3) : []),
      z.array(
        z.object({
          title: words(200),
          url: z.preprocess(
            (v) =>
              typeof v === "string" &&
              /^https:\/\/[^\s]+$/.test(v) &&
              v.length <= 500
                ? v
                : "",
            z.string(),
          ),
        }),
      ),
    )
    .transform((l) => l.filter((s) => s.url)),
});
export type PriceCheckReading = z.infer<typeof priceCheckReading>;

/** Whether prices can be checked now (why not, when not), and what's left of this month's limit, in US cents. */
export interface PriceCheckStatus {
  ok: boolean;
  why?: string;
  leftCents: number;
}

/** What the server sends back for one product: the reading, and what it cost. */
export interface PriceCheck {
  modelId: string;
  reading: PriceCheckReading;
  cents: number;
}

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = { type: "string" };

export const PRICE_CHECK_SCHEMA = obj({
  found: { type: "boolean" },
  euro: { anyOf: [{ type: "number" }, { type: "null" }] },
  confidence: { type: "string", enum: [...PRICE_CONFIDENCE] },
  shop: str,
  priced: str,
  said: str,
  sources: { type: "array", items: obj({ title: str, url: str }) },
});

/** One product as checked, for the list the page keeps and downloads. */
export interface PriceCheckRow {
  modelId: string;
  name: string;
  /** Its value before the check, in cents. */
  was: number | null;
  reading: PriceCheckReading | null;
  /** Why it couldn't be checked, when it couldn't. */
  failed?: string;
}

/** The results as a sheet, in the shape "Replacement values from a list" reads (ADR 0204), so it can be looked over in a spreadsheet and chosen again. */
export function priceCheckCsv(rows: readonly PriceCheckRow[]): string {
  const head = [
    "No.",
    "Product",
    "Now (EUR)",
    "New value of one (EUR, with VAT)",
    "Confidence",
    "Shop",
    "What was priced",
    "Said",
    "Source",
  ];
  const lines = rows.map((r, i) => {
    const x = r.reading;
    const euro = x?.found && x.euro !== null ? String(x.euro) : "";
    return [
      String(i + 1),
      r.name,
      r.was === null ? "" : String(r.was / 100),
      euro,
      x?.found
        ? CONFIDENCE_LABELS[x.confidence]
        : r.failed
          ? "Not checked"
          : "Not found",
      x?.shop ?? "",
      x?.priced ?? "",
      r.failed ?? x?.said ?? "",
      x?.sources[0]?.url ?? "",
    ];
  });
  return csvText(head, lines);
}
