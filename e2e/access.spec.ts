import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillName } from './names.ts'

/**
 * Getting about the app and reading it, with a screen reader or in daylight
 * (audit finding 22): every field's border can be seen against its card, in
 * light and dark; each move lands on the screen's heading and names the tab
 * after it; there's one main landmark; the back link is tall enough to tap;
 * the current tab and the grey pill read at 4.5:1, as do a row's quiet button
 * and the bad-filled yes of a question whose answer is a loss; the "not done"
 * list is a live region; and every field has a name. Uses the made-up data (ADR 0019),
 * so it starts fresh before and after: the other tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

/** WCAG's contrast between two colours as the browser gives them ("rgb(r, g, b)"). */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map((v) => Number(v) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

/** Each field on screen with its border colour and the colour behind it: the first ancestor painted a colour, which is the card. */
async function fieldBorders(page: Page): Promise<{ field: string; border: string; behind: string }[]> {
  return page.evaluate(() => {
    const opaque = (c: string) => {
      const m = c.match(/[\d.]+/g)
      return !!m && (m.length < 4 || Number(m[3]) > 0)
    }
    const behind = (el: Element) => {
      for (let e = el.parentElement; e; e = e.parentElement) {
        const bg = getComputedStyle(e).backgroundColor
        if (opaque(bg)) return bg
      }
      return getComputedStyle(document.body).backgroundColor
    }
    const out: { field: string; border: string; behind: string }[] = []
    for (const el of document.querySelectorAll<HTMLInputElement>('input, select, textarea')) {
      const cs = getComputedStyle(el)
      if (el.getClientRects().length === 0 || ['checkbox', 'radio', 'file'].includes(el.type) || parseFloat(cs.borderTopWidth) === 0) continue
      out.push({ field: `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') ?? el.name ?? el.id}`.trim(), border: cs.borderTopColor, behind: behind(el) })
    }
    return out
  })
}

/** Fields on screen with nothing to call them: no label, aria-label, aria-labelledby or title. */
async function unnamedFields(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const name = (el: HTMLInputElement) => {
      const aria = el.getAttribute('aria-label')?.trim()
      if (aria) return aria
      const by = el.getAttribute('aria-labelledby')
      if (by) return by.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ').trim()
      for (const label of el.labels ?? []) if (text(label)) return text(label)
      return el.getAttribute('title')?.trim() ?? ''
    }
    return [...document.querySelectorAll<HTMLInputElement>('input, select, textarea')].filter((el) => el.getClientRects().length > 0 && !name(el)).map((el) => el.outerHTML.slice(0, 120))
  })
}

/**
 * Fields and buttons smaller than a phone needs (UX sweep, 6 November 2026, move 5): typed text under 16px, which a
 * phone zooms the page into, or a control under 44px tall. Every fold is opened to measure the forms folded away in
 * them, and closed again after. A field drawn in a box with its unit is the box; the button drawn out of sight for
 * Enter in the rate field (.on-enter) is never tapped.
 */
async function smallControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const shut = [...document.querySelectorAll('details')].filter((d) => !d.open)
    for (const d of shut) d.open = true
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('input, select, textarea, button, a.button')) {
      if (el.getClientRects().length === 0 || el.matches('.on-enter') || ['checkbox', 'radio', 'hidden'].includes(el.getAttribute('type') ?? '')) continue
      const box = (el.closest('.unit-box') ?? el).getBoundingClientRect()
      const typed = el.matches('input, select, textarea') ? parseFloat(getComputedStyle(el).fontSize) : 16
      if (typed < 16 || box.height < 44) out.push(`${el.outerHTML.slice(0, 100)}: ${typed}px text, ${box.height}px tall`)
    }
    for (const d of shut) d.open = false
    return out
  })
}

/** A colour role of the app's (a CSS variable) as the browser gives it, read on a probe in the app. */
const roleColour = (page: Page, role: string) =>
  page.evaluate((role) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${role})`
    document.querySelector('.app')!.append(probe)
    const colour = getComputedStyle(probe).color
    probe.remove()
    return colour
  }, role)

/** The text colour against the background of the first element matching, as drawn. */
async function textContrast(page: Page, selector: string): Promise<number> {
  const [color, background] = await page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return [cs.color, cs.backgroundColor]
  })
  return contrast(color!, background!)
}

/**
 * The element's text colour on what is behind it, in the light theme and then the dark: its own fill, or, where it has none (a quiet
 * button), the colours painted behind it laid over each other, as the eye sees them. The themes are switched at once, with nothing easing.
 * Its edge is read against what is round it, from its parent out; a mark drawn after it (::after) against the element and what is behind.
 */
async function drawnInBothThemes(el: Locator, of: 'text' | 'edge' | 'after' = 'text'): Promise<(readonly [string, string, string])[]> {
  return el.evaluate((node, of) => {
    const still = document.createElement('style')
    still.textContent = '* { transition: none !important; }'
    document.head.append(still)
    const rgba = (c: string) => c.match(/[\d.]+/g)!.map(Number)
    const root = document.documentElement
    const was = root.dataset.theme
    const out: (readonly [string, string, string])[] = []
    for (const theme of ['light', 'dark']) {
      root.dataset.theme = theme
      // Its own fill and each see-through one behind it, out to the first that is solid.
      const layers: number[][] = []
      for (let e: Element | null = of === 'edge' ? node.parentElement : node; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor)
        if ((c[3] ?? 1) === 0) continue
        layers.unshift(c)
        if ((c[3] ?? 1) >= 1) break
      }
      let [r, g, b] = (layers[0]?.[3] ?? 1) >= 1 && layers.length ? layers.shift()! : [255, 255, 255]
      for (const [lr, lg, lb, la = 1] of layers) [r, g, b] = [lr! * la + r! * (1 - la), lg! * la + g! * (1 - la), lb! * la + b! * (1 - la)]
      const drawn = of === 'edge' ? getComputedStyle(node).borderTopColor : of === 'after' ? getComputedStyle(node, '::after').backgroundColor : getComputedStyle(node).color
      out.push([theme, drawn, `rgb(${r}, ${g}, ${b})`] as const)
    }
    if (was === undefined) delete root.dataset.theme
    else root.dataset.theme = was
    still.remove()
    return out
  }, of)
}

/** The text colour against its own background, which may be see-through or none, laid over the first colour painted behind it, as the eye sees it. */
async function seenContrast(target: Locator): Promise<number> {
  const [color, background] = await target.evaluate((el) => {
    const rgba = (c: string) => c.match(/[\d.]+/g)!.map(Number)
    let under = getComputedStyle(document.body).backgroundColor
    for (let e = el.parentElement; e; e = e.parentElement) {
      const bg = getComputedStyle(e).backgroundColor
      if ((rgba(bg)[3] ?? 1) > 0) {
        under = bg
        break
      }
    }
    const [r, g, b, a = 1] = rgba(getComputedStyle(el).backgroundColor)
    const [ur, ug, ub] = rgba(under)
    return [getComputedStyle(el).color, `rgb(${[r! * a + ur! * (1 - a), g! * a + ug! * (1 - a), b! * a + ub! * (1 - a)].join(', ')})`]
  })
  return contrast(color!, background!)
}

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
})

test.afterAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`in ${colorScheme} mode, every field's border is 3:1 against its card and the current tab and grey pill read at 4.5:1`, async ({ browser, request }) => {
    // Proves: fields can be seen and the two known gaps are closed, in the app and on the freelancer's pages, as the browser draws them.
    const page = await (await browser.newContext({ viewport: phoneSize, colorScheme })).newPage()
    await page.goto('/#crew/people')
    await expect(page.getByRole('status')).toHaveText('Up to date')
    // Dara's page holds the days-off form and the level picker, which the list alone doesn't show. Her name heads her row in People.
    await page.getByRole('region', { name: 'People' }).getByRole('link', { name: /^Dara Quinn/ }).click()
    await page.getByRole('button', { name: 'Mark days off' }).click()
    await expect(page.getByLabel('Off from')).toBeVisible()

    for (const hash of ['#crew/person', '#crew/people', '#jobs', '#stock', '#admin']) {
      if (hash !== '#crew/person') await page.goto(`/${hash}`)
      const fields = await fieldBorders(page)
      expect(fields.length, `${hash} has fields`).toBeGreaterThan(0)
      for (const f of fields) expect(contrast(f.border, f.behind), `${hash}: ${f.field} border ${f.border} on ${f.behind}`).toBeGreaterThanOrEqual(3)
    }
    // A job's page, with Ask for crew and its reply-by day, behind its button (audit finding 16).
    await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Jobs' }).click()
    await page.getByRole('link', { name: /Harbour Lights Festival/ }).first().click()
    await page.getByRole('tab', { name: /^Crew/ }).click()
    await page.getByRole('button', { name: 'Ask for crew' }).click()
    await expect(page.getByRole('form', { name: 'Ask for crew' }).getByLabel('Reply by')).toBeVisible()
    for (const f of await fieldBorders(page)) expect(contrast(f.border, f.behind), `a job: ${f.field} border ${f.border} on ${f.behind}`).toBeGreaterThanOrEqual(3)
    expect(await textContrast(page, '.tabs a[aria-current="page"]')).toBeGreaterThanOrEqual(4.5)
    // A call shows its answers once its line is opened (audit finding 16): the load-in stagehands, which Laoise declined.
    await page.goto('/#crew')
    await expect(page.getByRole('status')).toHaveText('Up to date')
    // The calls are a windowed list (ADR 0050), drawn only near the screen, and a new screen holds its place for a moment against
    // anything but a hand (places.ts): so the page is wheeled down to Short of crew, as a person would, before its calls are reached.
    await page.mouse.move(195, 400)
    await page.mouse.wheel(0, 1200)
    await page.locator('.call-group', { hasText: 'Harbour Lights Festival' }).getByRole('button', { name: /× Stagehand · Load in/ }).click()
    await expect(page.locator('.pill.cancelled').first()).toBeVisible()
    expect(await textContrast(page, '.pill.cancelled')).toBeGreaterThanOrEqual(4.5)
    // A link on an amber warning line, such as the quote's "price list" one, reads at 4.5:1 on the wash in both themes (audit finding 79).
    const onAmber = await page.evaluate(() => {
      const line = document.createElement('p')
      line.className = 'warn-line'
      line.innerHTML = '<a href="#jobs/money/prices">price list</a> <button type="button" class="link">Hire them in</button>'
      document.querySelector('.app')!.append(line)
      // A colour easing over would be read part way: the themes are switched at once here.
      const still = document.createElement('style')
      still.textContent = '* { transition: none !important; }'
      document.head.append(still)
      const rgba = (c: string) => c.match(/[\d.]+/g)!.map(Number)
      const root = document.documentElement
      const was = root.dataset.theme
      const out: (readonly [string, string, string])[] = []
      for (const theme of ['light', 'dark']) {
        root.dataset.theme = theme
        // The wash is see-through: laid over the first colour painted behind it, as the eye sees it.
        let under = getComputedStyle(document.body).backgroundColor
        for (let e = line.parentElement; e; e = e.parentElement) {
          const bg = getComputedStyle(e).backgroundColor
          if ((rgba(bg)[3] ?? 1) > 0) {
            under = bg
            break
          }
        }
        const [r, g, b, a = 1] = rgba(getComputedStyle(line).backgroundColor)
        const [ur, ug, ub] = rgba(under)
        const behind = `rgb(${[r! * a + ur! * (1 - a), g! * a + ug! * (1 - a), b! * a + ub! * (1 - a)].join(', ')})`
        for (const el of line.children) out.push([theme, getComputedStyle(el).color, behind] as const)
      }
      if (was === undefined) delete root.dataset.theme
      else root.dataset.theme = was
      line.remove()
      still.remove()
      return out
    })
    for (const [theme, color, behind] of onAmber) expect(contrast(color, behind), `${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(4.5)

    // The freelancer's pages, which crew use most, in the same light: each says what it is in the tab, has one main landmark, and its fields can be seen and are named.
    const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; data: { name: string; linkToken: string } }[] }
    const dara = changes.find((c) => c.entity === 'person' && c.data.name === 'Dara Quinn')!
    await page.goto(`/f/${dara.data.linkToken}`)
    await expect(page).toHaveTitle('Session Hire: your work')
    await expect(page.getByRole('main')).toHaveCount(1)
    await page.getByText('Your details').click()
    const fields = await fieldBorders(page)
    expect(fields.length).toBeGreaterThan(3)
    for (const f of fields) expect(contrast(f.border, f.behind), `link page: ${f.field} border ${f.border} on ${f.behind}`).toBeGreaterThanOrEqual(3)
    expect(await unnamedFields(page)).toEqual([])
    // Its fields and buttons are the app's on a phone: what's typed at 16px, and every one 44px tall (UX sweep, 6 November 2026, move 5).
    expect(await smallControls(page)).toEqual([])
    // Giving a job up is the bad tone with no fill of its own, read at 4.5:1 on its card at rest and while it's pressed.
    const giveUp = page.locator('button.no').first()
    await giveUp.evaluate((el) => {
      el.closest('details')!.open = true
    })
    expect(await seenContrast(giveUp), `${await giveUp.textContent()}, at rest`).toBeGreaterThanOrEqual(4.5)
    await giveUp.hover()
    await page.mouse.down()
    expect(await seenContrast(giveUp), `${await giveUp.textContent()}, pressed`).toBeGreaterThanOrEqual(4.5)
    // Let go away from it, so nothing is sent.
    await page.mouse.move(0, 0)
    await page.mouse.up()
    // A field the server refuses is said under it in the bad wash, read at 4.5:1, with its edge in the bad tone at 3:1, and the title starts "Error: ".
    await page.getByLabel('Mobile').fill('ring me')
    await page.getByRole('button', { name: 'Save my number' }).click()
    await expect(page).toHaveTitle('Error: Session Hire: your work')
    await expect(page.locator('.field-error')).toHaveText('Phone numbers need digits only, ideally starting with +353.')
    expect(await textContrast(page, '.field-error')).toBeGreaterThanOrEqual(4.5)
    const refused = await fieldBorders(page)
    expect(refused.map((f) => f.field)).toContain('input phone')
    for (const f of refused) expect(contrast(f.border, f.behind), `refused link page: ${f.field} border ${f.border} on ${f.behind}`).toBeGreaterThanOrEqual(3)

    await page.getByRole('link', { name: /^Call sheet/ }).first().click()
    await expect(page).toHaveTitle('Call sheet: Harbour Lights Festival, Show')
    await expect(page.getByRole('main')).toHaveCount(1)
    expect((await page.getByRole('link', { name: '‹ Your work' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)

    await page.goto(`/f/${dara.data.linkToken}`)
    // Sent and approved timesheets are folded under one line (audit, 5 November 2026, finding 32).
    await page.locator('#timesheets summary', { hasText: 'Sent and approved' }).click()
    await page.locator('.ts-list a').filter({ hasText: 'Autumn Gala' }).click()
    await expect(page).toHaveTitle('Timesheet: Autumn Gala, Show')
    await expect(page.getByRole('main')).toHaveCount(1)
    const sheetFields = await fieldBorders(page)
    expect(sheetFields.length).toBeGreaterThan(3)
    for (const f of sheetFields) expect(contrast(f.border, f.behind), `timesheet: ${f.field} border ${f.border} on ${f.behind}`).toBeGreaterThanOrEqual(3)
    expect(await unnamedFields(page)).toEqual([])
    expect(await smallControls(page)).toEqual([])
  })
}

test("a row's quiet button, and the yes of a question whose answer is a loss, read at 4.5:1 in light and dark", async ({ browser }) => {
  // Proves: one rule for the red fill (UX sweep, 6 November 2026, move 1) leaves nothing hard to read. A timesheet's Check is quiet, in
  // the secondary ink with no fill; a quiet button is drawn the same; and Write it off, a loss, takes the bad fill, never the red, with
  // Keep it focused; while a yes that loses nothing is plain. Each as the browser draws it, in both themes.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/timesheets')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const check = page.getByRole('region', { name: 'Timesheets' }).getByRole('group', { name: 'To approve' }).getByRole('link', { name: 'Check' }).first()
  await expect(check).toHaveClass(/\bquiet\b/)
  await expect(check).not.toHaveClass(/\bprimary\b/)
  for (const [theme, color, behind] of await drawnInBothThemes(check)) expect(contrast(color, behind), `quiet Check, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(4.5)
  // A quiet <button> follows the same rule; none is drawn on the made-up data, so one is put in a card for the measure.
  await page.evaluate(() => {
    const card = document.createElement('section')
    card.className = 'card'
    card.innerHTML = '<button type="button" class="quiet" id="quiet-probe">Check</button>'
    document.querySelector('.app')!.append(card)
  })
  for (const [theme, color, behind] of await drawnInBothThemes(page.locator('#quiet-probe'))) expect(contrast(color, behind), `button.quiet, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(4.5)

  await page.goto('/#stock/repairs')
  const fault = page.getByRole('region', { name: 'Repairs open' }).locator('li.fault').first()
  await fault.getByRole('button', { name: 'Sort it out' }).click()
  // Marking it fixed loses nothing: a plain yes.
  await fault.getByRole('button', { name: 'Mark fixed' }).click()
  await expect(fault.getByRole('button', { name: 'Mark it fixed' })).not.toHaveClass(/\b(primary|danger)\b/)
  await expect(fault.getByRole('button', { name: 'Keep it' })).toBeFocused()
  await fault.getByRole('button', { name: 'Keep it' }).click()
  // Writing it off is a loss: the bad fill, and the safe answer still the one focused.
  await fault.getByRole('button', { name: 'Write off' }).click()
  const yes = fault.getByRole('button', { name: 'Write it off' })
  await expect(yes).toHaveClass(/\bdanger\b/)
  await expect(yes).not.toHaveClass(/\bprimary\b/)
  await expect(fault.getByRole('button', { name: 'Keep it' })).toBeFocused()
  for (const [theme, color, behind] of await drawnInBothThemes(yes)) expect(contrast(color, behind), `Write it off, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(4.5)
  await fault.getByRole('button', { name: 'Keep it' }).click()
  await expect(yes).toHaveCount(0)
})

test('a group head, a fault in a quote line, a number waiting to sync and the chart column being read can be seen in light and dark', async ({ browser }) => {
  // Proves (UX sweep, 6 November 2026, move 2): a group head's muted label capitals read at 4.5:1 on its card; the column of a Home
  // chart being read is marked by a bar in the ink at 3:1 or more against the card, not a wash; in a quote's open line a fault is the
  // bad ink at 4.5:1 and the field that's wrong takes the bad edge at 3:1, while a question about the line stays amber at 4.5:1; and a
  // number waiting to sync is grey at 4.5:1, its dashed edge 3:1. Each as the browser draws it, in both themes, and in its role.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#home')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company', exact: true }).click()
  const head = page.locator('.card h3.group').first()
  await expect(head).toBeVisible()
  for (const [theme, color, behind] of await drawnInBothThemes(head)) expect(contrast(color, behind), `group head, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(4.5)
  const picked = page.locator('.chart-col[aria-pressed="true"]').first()
  await expect(picked).toBeVisible()
  for (const [theme, color, behind] of await drawnInBothThemes(picked, 'after')) expect(contrast(color, behind), `chart column read, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(3)

  // Stock's sheet comes with its screens; none of these is drawn on the made-up data as it stands, so each is put in a card to measure.
  await page.goto('/#stock')
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible()
  await page.evaluate(() => {
    const card = document.createElement('section')
    card.className = 'card'
    card.innerHTML = `<div class="quote-screen"><div class="quote-line">
        <input id="wrong-probe" aria-label="Line 4: what" aria-invalid="true">
        <p class="line-problem" id="fault-probe">Line 4: say what it's for.</p>
        <p class="line-problem asks" id="asks-probe">Was €40 a day, now €40 a week: change the price?</p>
      </div></div>
      <div class="warehouse"><ul class="numbers"><li><a href="#stock" class="is-pending" id="waiting-probe">SH-000001</a></li></ul></div>`
    document.querySelector('.app')!.append(card)
  })
  for (const id of ['fault-probe', 'asks-probe', 'waiting-probe'])
    for (const [theme, color, behind] of await drawnInBothThemes(page.locator(`#${id}`))) expect(contrast(color, behind), `${id}, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(4.5)
  for (const id of ['wrong-probe', 'waiting-probe'])
    for (const [theme, color, behind] of await drawnInBothThemes(page.locator(`#${id}`), 'edge')) expect(contrast(color, behind), `${id} edge, ${theme}: ${color} on ${behind}`).toBeGreaterThanOrEqual(3)
  // And each in its role, not only a colour that reads: the fault and the wrong field's edge in the bad tone, the question amber, and
  // a number waiting to sync in the muted ink on a field's edge, as every other waiting thing is.
  await expect(page.locator('#fault-probe')).toHaveCSS('color', await roleColour(page, '--bad'))
  await expect(page.locator('#wrong-probe')).toHaveCSS('border-top-color', await roleColour(page, '--bad'))
  await expect(page.locator('#asks-probe')).toHaveCSS('color', await roleColour(page, '--warn'))
  await expect(page.locator('#waiting-probe')).toHaveCSS('color', await roleColour(page, '--muted'))
  await expect(page.locator('#waiting-probe')).toHaveCSS('border-top-color', await roleColour(page, '--field-line'))
})

test('each move lands on the heading and names the tab, inside one main landmark, with a back link a thumb can hit', async ({ browser }) => {
  // Proves: the Shell moves focus to the new screen's heading and renames the tab on every move, for a tab, a record, the leave screen and the planner's next week, but not for a toggle, however the browser presses it.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#jobs')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page).toHaveTitle('Jobs · Session Hire')
  await expect(page.getByRole('main')).toHaveCount(1)

  // A tab: the screen's name in the top bar takes focus and names the tab.
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Crew' }).click()
  await expect(page).toHaveTitle('Calls · Session Hire')
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toMatch(/^Calls/)
  await expect(page.getByRole('main')).toHaveCount(1)

  // A record: its heading takes focus and names the tab after the job.
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Jobs' }).click()
  await page.getByRole('link', { name: /Harbour Lights Festival/ }).first().click()
  await expect(page).toHaveTitle('Harbour Lights Festival · Session Hire')
  expect(await page.evaluate(() => [document.activeElement?.tagName, document.activeElement?.textContent?.trim()])).toEqual(['H1', 'Harbour Lights Festival'])
  const back = await page.getByRole('link', { name: '‹ All jobs' }).boundingBox()
  expect(back!.height).toBeGreaterThanOrEqual(44)

  // The leave screen, before anyone has said who they are, is named for what it is, not for the Crew tab it's under.
  await page.goto('/#crew')
  await page.getByRole('navigation', { name: 'Crew pages' }).getByRole('link', { name: /^Leave/ }).click()
  await expect(page).toHaveTitle('Leave · Session Hire')
  expect(await page.evaluate(() => [document.activeElement?.tagName, document.activeElement?.textContent?.trim()])).toEqual(['H1', 'Leave'])

  // The planner's jobs or people is a toggle that keeps focus, though it changes the address; another week is a move.
  await page.goto('/#jobs/plan')
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeFocused()
  const people = page.getByRole('group', { name: 'Rows' }).getByRole('button', { name: 'People' })
  await people.focus()
  await page.keyboard.press('Enter')
  await expect(people).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn))))
  await expect(people).toBeFocused()
  // Safari, and Firefox on a Mac, press a button without focusing it, as a click from script does here: still a toggle.
  const jobs = page.getByRole('group', { name: 'Rows' }).getByRole('button', { name: 'Jobs' })
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await jobs.evaluate((b: HTMLElement) => b.click())
  await expect(jobs).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn))))
  await expect(jobs).toBeFocused()
  await page.getByRole('link', { name: 'Next week' }).click()
  await expect(heading).toBeFocused()
})

test('someone already typing on the new screen keeps the focus', async ({ browser }) => {
  // Proves: the move to the new screen's heading, which waits a frame after the address changes, never takes the focus from a field the person is already typing in, so a search typed straight away still answers Enter.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#jobs')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  // Hold the frame the Shell waits for, to be in the search before it, as a quick hand or a slow phone can be.
  type Held = { held: FrameRequestCallback[]; raf: typeof requestAnimationFrame }
  await page.evaluate(() => {
    const w = window as unknown as Held
    w.held = []
    w.raf = window.requestAnimationFrame
    window.requestAnimationFrame = (cb) => w.held.push(cb)
  })
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Stock' }).click()
  // Stock's own search: for a moment the Jobs screen, with a search of its own, is still there.
  // A short number, which waits for Enter: a whole one opens its item as soon as it's typed (UX sweep, 6 November 2026, move 8).
  const find = page.getByRole('region', { name: 'Catalogue' }).getByLabel('Find')
  await find.fill('SH-1')
  await page.evaluate(() => {
    const w = window as unknown as Held
    window.requestAnimationFrame = w.raf
    for (const cb of w.held.splice(0)) cb(performance.now())
  })
  await expect(page).toHaveTitle('Catalogue · Session Hire')
  await expect(find).toBeFocused()
  await find.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'SH-000001' })).toBeVisible()
})

test('every field on every screen has a name, and the not-done list is a live region', async ({ browser }) => {
  // Proves: no field is named by its placeholder alone, and a refusal from the server is read out where it's counted and listed, from a live region that takes no room in the top bar while it's empty, even at 320px.
  const id = Math.random().toString(36).slice(2, 8)
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/people')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('region', { name: 'People' }).getByRole('link', { name: /^Dara Quinn/ }).click()
  await page.getByRole('button', { name: 'Mark days off' }).click()
  await expect(page.getByLabel('Off from')).toBeVisible()
  expect(await unnamedFields(page), '#crew/person').toEqual([])
  for (const hash of ['#crew', '#crew/people', '#crew/timesheets', '#jobs', '#stock', '#menu', '#admin', '#me', '#history', '#crew/leave']) {
    await page.goto(`/${hash}`)
    await expect(page.locator('.app')).toBeVisible()
    expect(await unnamedFields(page), hash).toEqual([])
  }
  await page.goto('/#jobs')
  await page.getByRole('link', { name: /Harbour Lights Festival/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Harbour Lights Festival' })).toBeVisible()
  expect(await unnamedFields(page), 'a job').toEqual([])

  // On a 320px phone the empty live region leaves the sync pill on the top bar's one line, beside dark or light (ADR 0036).
  const narrow = await (await browser.newContext({ viewport: { width: 320, height: 640 } })).newPage()
  await narrow.goto('/#crew')
  await expect(narrow.getByRole('status')).toHaveText('Up to date')
  const [row, pill, theme] = await narrow
    .locator('.top .state')
    .evaluate((el) => [el, el.querySelector('.conn')!, el.querySelector('.theme-button')!].map((e) => e.getBoundingClientRect().height))
  expect(row).toBe(Math.max(pill!, theme!))

  // A refusal from the server is counted and listed where a screen reader is told of it.
  await page.goto('/#crew/people')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.route(/\/api\/sync\/push/, async (route) => {
    const { mutations } = route.request().postDataJSON() as { mutations: { id: string }[] }
    await route.fulfill({ json: { results: mutations.map((m) => ({ id: m.id, status: 'rejected', reason: { code: 'conflict', message: 'Pretend the server said no.' } })) } })
  })
  await page.getByRole('button', { name: 'Add person' }).click()
  const person = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add person' }) })
  await fillName(person, `Nora Walsh ${id}`)
  await person.getByRole('button', { name: 'Add person' }).click()
  const count = page.getByRole('button', { name: /not done$/ })
  await expect(count).toHaveText('1 not done')
  expect(await count.evaluate((el) => el.parentElement?.getAttribute('aria-live'))).toBe('polite')
  await count.click()
  await expect(page.getByRole('region', { name: 'Not done' })).toHaveAttribute('aria-live', 'polite')
  await page.unroute(/\/api\/sync\/push/)
})
