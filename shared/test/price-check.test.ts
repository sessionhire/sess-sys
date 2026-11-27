import { describe, expect, it } from "vitest";
import {
  priceCheckCsv,
  priceCheckReading,
  type PriceCheckRow,
} from "../src/price-check.ts";
import { readValueList, valueListPlan } from "../src/value-list.ts";

/**
 * Claude's price check (ADR 0206): its answer is read leniently, and the
 * prices chosen go to "Replacement values from a list" as a sheet it reads.
 */

const thomann = {
  found: true,
  euro: 1999,
  confidence: "high",
  shop: "Thomann",
  priced: "",
  said: "Thomann sells it.",
  sources: [
    { title: "Thomann", url: "https://www.thomann.de/ie/yamaha_dm3.htm" },
  ],
};

describe("reading a price check", () => {
  it("keeps what fits and drops the rest, never refusing", () => {
    expect(priceCheckReading.parse(thomann)).toEqual(thomann);
    const odd = priceCheckReading.parse({
      found: "yes",
      euro: -4,
      confidence: "certain",
      shop: 7,
      sources: [
        { title: "x", url: "javascript:alert(1)" },
        { title: "y", url: "http://shop.ie" },
      ],
    });
    expect(odd).toEqual({
      found: false,
      euro: null,
      confidence: "low",
      shop: "",
      priced: "",
      said: "",
      sources: [],
    });
    expect(priceCheckReading.parse({ ...thomann, euro: 1999.6 }).euro).toBe(
      2000,
    );
  });
});

describe("the sheet it makes", () => {
  it("is read by Replacement values from a list, taking the new value and never today’s", () => {
    const rows: PriceCheckRow[] = [
      {
        modelId: "a",
        name: "Yamaha DM3",
        was: 2300_00,
        reading: priceCheckReading.parse(thomann),
      },
      {
        modelId: "b",
        name: "Avolites Arena, desk",
        was: null,
        reading: priceCheckReading.parse({
          ...thomann,
          euro: 24090,
          confidence: "medium",
          shop: "Stage Shop",
        }),
      },
      {
        modelId: "c",
        name: "Mystery",
        was: 10_00,
        reading: priceCheckReading.parse({ found: false }),
      },
      {
        modelId: "d",
        name: "Later",
        was: null,
        reading: null,
        failed: "Stopped before it was checked.",
      },
    ];
    const sheet = priceCheckCsv(rows);
    expect(sheet).toContain("Not found");
    expect(sheet).toContain("Not checked");
    const read = readValueList(sheet);
    const plan = valueListPlan(read.rows!, [
      { id: "a", name: "Yamaha DM3", valueCents: 2300_00 },
      { id: "b", name: "Avolites Arena, desk", valueCents: null },
      { id: "c", name: "Mystery", valueCents: 10_00 },
      { id: "d", name: "Later", valueCents: null },
    ]);
    expect(plan.changes.map((c) => [c.modelId, c.valueCents])).toEqual([
      ["a", 1999_00],
      ["b", 24090_00],
    ]);
    expect(plan.blank).toBe(2);
  });
});
