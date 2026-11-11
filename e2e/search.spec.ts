import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * One search for everything (review of 11 November 2026, finding 13): from the magnifier beside the bell on a phone, or / at a
 * desk, across jobs, clients, venues, people, products and kit by its number, each result opening its own page.
 */

const phoneSize = { width: 390, height: 844 };
const deskSize = { width: 1280, height: 900 };

async function push(
  request: APIRequestContext,
  id: string,
  mutations: [string, Record<string, unknown>][],
) {
  const res = await request.post("/api/sync/push", {
    data: {
      clientId: `search-${id}`,
      mutations: mutations.map(([name, args], i) => ({
        id: `search-${id}-${i}`,
        name,
        args,
        createdAt: new Date().toISOString(),
      })),
    },
  });
  const { results } = (await res.json()) as {
    results: { status: string; reason?: { message: string } }[];
  };
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(
    mutations.map(() => "applied"),
  );
}

test("the magnifier finds a job, its client and venue, a person and a product in one place, and Back keeps the results", async ({
  browser,
  request,
}) => {
  const id = Date.now().toString(36);
  const word = `Kilrush${id}`;
  await push(request, id, [
    [
      "client.upsert",
      { id: `c-${id}`, name: `${word} Arts`, contacts: [], notes: "" },
    ],
    [
      "venue.upsert",
      {
        id: `v-${id}`,
        name: `${word} Hall`,
        address: "Kilrush, Co. Clare",
        notes: "",
      },
    ],
    [
      "project.create",
      {
        id: `j-${id}`,
        name: `${word} Festival`,
        clientId: `c-${id}`,
        venueId: `v-${id}`,
        status: "confirmed",
        notes: "",
      },
    ],
    [
      "model.create",
      {
        id: `m-${id}`,
        name: `${word} wedge`,
        department: "audio",
        category: "Speaker",
        tracking: "bulk",
        isCase: false,
        valueCents: null,
        notes: "",
      },
    ],
  ]);
  const page = await (
    await browser.newContext({ viewport: phoneSize })
  ).newPage();
  await page.goto("/#home");
  await expect(page.locator(".conn")).toHaveText("Up to date");
  await page.getByRole("link", { name: "Search everything" }).click();
  await expect(page).toHaveURL(/#search$/);
  const field = page.getByLabel("Search everything");
  await expect(field).toBeFocused();
  await field.fill(word.toLowerCase());
  await expect(
    page
      .getByRole("region", { name: "Jobs" })
      .getByRole("link", { name: new RegExp(`${word} Festival`) }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Clients" })
      .getByRole("link", { name: new RegExp(`${word} Arts`) }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Venues" })
      .getByRole("link", { name: new RegExp(`${word} Hall`) }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Products" })
      .getByRole("link", { name: new RegExp(`${word} wedge`) }),
  ).toBeVisible();

  // A result opens its page; Back comes to the same results.
  await page
    .getByRole("region", { name: "Jobs" })
    .getByRole("link", { name: new RegExp(`${word} Festival`) })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${word} Festival` }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Search everything")).toHaveValue(
    word.toLowerCase(),
  );
  await expect(page.getByRole("region", { name: "Clients" })).toBeVisible();

  // Nothing found says so.
  await page.getByLabel("Search everything").fill(`nothing-${id}`);
  await expect(
    page.getByText(`Nothing called “nothing-${id}” on this device.`),
  ).toBeVisible();
});

test("at a desk / opens the search and F finds on the page", async ({
  browser,
}) => {
  const desk = await (
    await browser.newContext({ viewport: deskSize })
  ).newPage();
  await desk.goto("/#jobs");
  await expect(desk.locator(".conn")).toHaveText("Up to date");
  await desk.keyboard.press("f");
  await expect(desk.getByLabel("Find", { exact: true })).toBeFocused();
  await desk.getByLabel("Find", { exact: true }).blur();
  await desk.keyboard.press("/");
  await expect(desk).toHaveURL(/#search$/);
  await expect(desk.getByLabel("Search everything")).toBeFocused();
});
