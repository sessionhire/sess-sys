import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

/**
 * Claude checks replacement values (ADR 0206), at phone size: Claude turned
 * on, the audio products looked up one by one, each with how sure Claude is;
 * the High ones go into "Replacement values from a list", which shows each
 * from what to what before Set. Anthropic is a stand-in on the port the
 * server was told, as in the Claude test. Uses the made-up data (ADR 0019).
 */

const phoneSize = { width: 390, height: 844 };
const fresh = { data: { confirm: "delete everything" } };
const standInPort = Number(process.env.E2E_PORT ?? "3099") + 1001;
const shots = process.env.E2E_SHOTS;

const price = (euro: number | null, confidence: string, shop: string) => ({
  found: euro !== null,
  euro,
  confidence,
  shop,
  priced: "",
  said:
    euro === null
      ? "The maker sells only through dealers and shows no price."
      : `${shop} sells it to Ireland.`,
  sources:
    euro === null ? [] : [{ title: shop, url: "https://www.thomann.de/ie/" }],
});
const answers: [string, ReturnType<typeof price>][] = [
  ["d&b Y10P", price(4100, "high", "Thomann")],
  ["d&b D20", price(9800, "medium", "Stage Shop")],
  ["Amp rack", price(null, "low", "")],
  ["Shure SM58", price(109, "high", "Thomann")],
  ["XLR 10 m", price(22, "low", "Cable Shop")],
];

let standIn: Server;
test.beforeAll(async () => {
  standIn = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method !== "POST" || !req.url?.startsWith("/v1/messages"))
        return res.writeHead(404).end();
      const sent = JSON.parse(body) as {
        model: string;
        messages: { content: string }[];
      };
      const said = String(sent.messages[0]?.content ?? "");
      const answer =
        answers.find(([name]) => said.includes(`Name: ${name}\n`))?.[1] ??
        price(null, "low", "");
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: "msg_stand_in",
          type: "message",
          role: "assistant",
          model: sent.model,
          content: [{ type: "text", text: JSON.stringify(answer) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: {
            input_tokens: 4_000,
            output_tokens: 300,
            server_tool_use: { web_search_requests: 2 },
          },
        }),
      );
    });
  });
  await new Promise<void>((resolve) =>
    standIn.listen(standInPort, "127.0.0.1", resolve),
  );
});
test.afterAll(async ({ request }) => {
  await new Promise((resolve) => standIn.close(resolve));
  await request.post("/api/data/start-fresh", fresh);
});

test("Claude looks up the prices, and the High ones are set through the list", async ({
  browser,
  request,
}) => {
  expect((await request.post("/api/data/start-fresh", fresh)).ok()).toBe(true);
  expect((await request.post("/api/data/made-up")).ok()).toBe(true);
  const page = await (
    await browser.newContext({
      viewport: phoneSize,
      deviceScaleFactor: shots ? 2 : 1,
    })
  ).newPage();

  await page.goto("/#admin/claude");
  const toggle = page
    .getByRole("region", { name: "Claude", exact: true })
    .getByRole("switch", { name: /Turn Claude on/ });
  await toggle.click();
  await expect(toggle).toBeChecked();

  await page.goto("/#admin/data");
  const check = page.getByRole("region", {
    name: "Check replacement values with Claude",
  });
  // Every made-up product has a value already, so there's nothing without one.
  await expect(
    check.getByRole("button", { name: "Nothing to look up" }),
  ).toBeDisabled();
  await check.getByRole("button", { name: "Every product" }).click();
  await check.getByLabel("Department").selectOption("audio");
  await expect(check.getByText(/^5 products, about \$0\.50/)).toBeVisible();
  await check.getByRole("button", { name: "Look up 5 prices" }).click();

  await expect(check.getByRole("button", { name: "High (2)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    check.getByRole("button", { name: "Medium (1)" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(check.getByText("1 no price found")).toBeVisible();
  await check.getByText(/^2 High$/).click();
  await expect(
    check.getByText(/d&b Y10P: €3,500 → €4,100 at Thomann/),
  ).toBeVisible();
  if (shots) await check.screenshot({ path: `${shots}/price-check.png` });

  await check.getByRole("button", { name: "Use 2 prices" }).click();
  const list = page.getByRole("region", {
    name: "Replacement values from a list",
  });
  await expect(
    list.getByText("Read from Claude's price check (High)."),
  ).toBeVisible();
  await expect(list.getByText("2 values to set")).toBeVisible();
  await expect(list.getByText("Shure SM58: €110 → €109")).toBeVisible();
  await list.getByRole("button", { name: "Set 2 values" }).click();
  await expect(list.getByRole("status")).toHaveText(
    "Set 2 replacement values. Each is in the history.",
  );
});
