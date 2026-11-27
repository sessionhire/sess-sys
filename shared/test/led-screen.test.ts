import { describe, expect, it } from 'vitest'
import { lineMark, linesByGroup, looksLikePanel, needsPrice, panelPitch, panelWords, quoteLine, setCents, stockCommandSchemas, type PanelFacts, type QuoteLine } from '../src/index.ts'
import { gridFor, lengthsFor, liftFromName, panelChoices, screenFacts, screenIncludes, screenPlan, screenWhat, standsOn, trussFamilies, type ScreenProduct } from '../src/led-screen.ts'

/**
 * The LED screen builder's sums (ADR 0207), against a stock list named the way a hire company's really is: lengths in
 * the names, a maker and a series for a panel, a typing slip in a motor control.
 */

const product = (name: string, more: Partial<ScreenProduct> = {}): ScreenProduct => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  department: 'rigging',
  category: 'Rigging',
  weightKg: null,
  powerW: null,
  lengthM: null,
  dryHire: false,
  ...more,
})

const HALF: PanelFacts = { widthMm: 500, heightMm: 500, pixelsW: 128, pixelsH: 128 }
const video = { department: 'video', category: 'Video equipment' } as const

const stock: ScreenProduct[] = [
  product('Absen NT 3.9', { ...video, weightKg: 7.5, powerW: 160, panel: HALF }),
  product('Gloshine LS 4.8 led 1m x 0.5m led panel', video),
  product('absen Fly Bar', { ...video, weightKg: 10 }),
  product('Novastar vx4s Processor', video),
  product('Nova star pro HD video processor', video),
  product('55 inch HD smart Tv', video),
  product('Roland V1 vision mixer', video),
  product('SES 18 way video distro', { department: 'power', category: 'Power' }),
  product('125 amp audio distro', { department: 'power', category: 'Power' }),
  product('1/2 tonne stage maker motor', { weightKg: 30 }),
  product('1 tonne stage maker motor', { weightKg: 50 }),
  product('1/2 tonne Cm motor', { department: 'audio', category: 'Audio' }),
  product('LV12 ch motor control'),
  product('motor contol'),
  product('1M H30V truss'),
  product('2M H30V truss'),
  product('3M H30V Truss'),
  product('3M H30 truss circle'),
  product('1m black a type truss', { weightKg: 10 }),
  product('1.5m black a type truss', { weightKg: 15 }),
  product('3m Black a type', { weightKg: 20 }),
  product('H30V 1m base plate', { weightKg: 40 }),
  product('H30V corner block'),
  product('Pipe & Drape Base plate Large', { department: 'staging' }),
  product('12way  veem 5pin dmx truss box', { department: 'lighting' }),
  product('Tank trap', { weightKg: 12 }),
  product('LED Par Can', { department: 'audio', category: 'Audio' }),
]
const absen = stock[0]!
const id = (name: string) => product(name).id
const prices = new Map([
  [id('1/2 tonne stage maker motor'), 8_000],
  [id('1 tonne stage maker motor'), 8_000],
  [id('LV12 ch motor control'), 10_000],
  [id('Novastar vx4s Processor'), 10_000],
  [id('Nova star pro HD video processor'), 10_000],
])
const look = { price: (m: string) => prices.get(m) }
const ask = (cols: number, rows: number, stands: 'hung' | 'ground', count = 1, panel = absen) => ({ panel, facts: panel.panel ?? HALF, cols, rows, count, stands })
const row = (plan: ReturnType<typeof screenPlan>, part: string) => plan.rows.find((r) => r.part === part)!
const items = (plan: ReturnType<typeof screenPlan>, part: string) => row(plan, part).items.map((i) => [i.modelId, i.qty])

describe('which products are panels', () => {
  it('tells a panel by its name until it has a size', () => {
    expect(stock.filter(looksLikePanel).map((m) => m.name)).toEqual(['Absen NT 3.9', 'Gloshine LS 4.8 led 1m x 0.5m led panel'])
  })
  it('offers ours first, the ones with a size before the ones without, then hired in', () => {
    const hired = product('ROE CB5 LED panel', { ...video, dryHire: true, panel: HALF })
    expect(panelChoices([hired, ...stock]).map((c) => [c.model.name, c.sized, c.ours])).toEqual([
      ['Absen NT 3.9', true, true],
      ['Gloshine LS 4.8 led 1m x 0.5m led panel', false, true],
      ['ROE CB5 LED panel', true, false],
    ])
  })
  it('leaves out a product added by mistake', () => {
    expect(panelChoices([{ ...absen, mistake: true }])).toEqual([])
  })
  it('says a panel as its size and pixels, and its pitch', () => {
    expect(panelWords(HALF)).toBe('500 × 500 mm, 128 × 128 pixels')
    expect(panelWords({ widthMm: 500, heightMm: 1000, pixelsW: null, pixelsH: null })).toBe('500 × 1,000 mm')
    expect(panelPitch(HALF)).toBe(3.9)
    expect(panelPitch({ ...HALF, pixelsW: null, pixelsH: null })).toBeNull()
  })
})

describe('a screen in whole panels', () => {
  it('takes the nearest whole panels to the size asked for', () => {
    expect(gridFor(HALF, 5, 3)).toEqual({ cols: 10, rows: 6 })
    expect(gridFor(HALF, 4.8, 2.7)).toEqual({ cols: 10, rows: 5 })
    expect(gridFor({ widthMm: 500, heightMm: 1000 }, 6, 3.4)).toEqual({ cols: 12, rows: 3 })
    expect(gridFor(HALF, 0.1, 0)).toEqual({ cols: 1, rows: 1 })
  })
  it('adds up what it is', () => {
    expect(screenFacts(HALF, 7.5, 160, 10, 6)).toEqual({ cols: 10, rows: 6, panels: 60, widthM: 5, heightM: 3, ratio: '5:3', pixelsW: 1280, pixelsH: 768, weightKg: 450, powerW: 9600, circuits: 4 })
    expect(screenFacts(HALF, 7.5, 160, 16, 9).ratio).toBe('16:9')
    expect(screenFacts(HALF, 7.5, 160, 83, 47).ratio).toBe('1.77:1')
  })
  it('never reads a weight, power or pixels left blank as nothing', () => {
    const f = screenFacts({ ...HALF, pixelsW: null, pixelsH: null }, null, null, 10, 6)
    expect([f.weightKg, f.powerW, f.circuits, f.pixelsW, f.pixelsH]).toEqual([null, null, null, null, null])
    expect(screenFacts(HALF, 0, 0, 10, 6).weightKg).toBeNull()
  })
  it('names it for the quote', () => {
    const f = screenFacts(HALF, 7.5, 160, 10, 6)
    expect(screenWhat(f, 'hung')).toBe('LED screen 5 × 3 m, hung')
    expect(screenWhat(screenFacts(HALF, null, null, 9, 5), 'ground')).toBe('LED screen 4.5 × 2.5 m, ground stacked')
    expect(screenIncludes(f, 1)).toBe('10 panels wide by 6 high · 1,280 × 768 pixels')
    expect(screenIncludes(screenFacts({ ...HALF, pixelsW: null, pixelsH: null }, null, null, 6, 4), 2)).toBe('Each 6 panels wide by 4 high')
  })
})

describe('kit found by what it is called', () => {
  it('reads what a motor lifts from its name', () => {
    expect(['1/2 tonne stage maker motor', '1 Tonne CM motor', 'CM 1000 kg motor', 'Lodestar 250kg', 'half tonne hoist', '2t hoist', 'A motor'].map(liftFromName)).toEqual([500, 1000, 1000, 250, 500, 2000, null])
  })
  it('gathers straight truss into families by its lengths', () => {
    expect(trussFamilies(stock).map((f) => [f.name, f.pieces.map((p) => p.lengthM), f.kgPerM])).toEqual([
      ['black a type truss', [1, 1.5, 3], 8.9],
      ['H30V truss', [1, 2, 3], null],
    ])
  })
  it('reads a length from the product where the name has been tidied', () => {
    const tidy = [product('H30V truss', { id: 'a', lengthM: 2 }), product('H30V truss', { id: 'b', lengthM: 3 })]
    expect(trussFamilies(tidy).map((f) => f.pieces.map((p) => [p.model.id, p.lengthM]))).toEqual([[['a', 2], ['b', 3]]])
  })
  it('makes a run from the fewest lengths, with the least over', () => {
    expect(lengthsFor([1, 2, 3], 5)).toEqual([3, 2])
    expect(lengthsFor([1, 2, 3], 4.5)).toEqual([3, 2])
    expect(lengthsFor([1, 2, 3], 12)).toEqual([3, 3, 3, 3])
    expect(lengthsFor([1, 1.5, 2.5], 5)).toEqual([2.5, 2.5])
    expect(lengthsFor([3], 2)).toEqual([3])
    expect(lengthsFor([], 2)).toEqual([])
  })
})

describe('a hung screen', () => {
  const plan = screenPlan(ask(10, 6, 'hung'), stock, {}, look)
  it('lists what it takes, each with why', () => {
    expect(plan.rows.map((r) => r.part)).toEqual(['panels', 'bars', 'truss', 'motors', 'control', 'processor', 'distro'])
    expect(items(plan, 'panels')).toEqual([[absen.id, 60]])
    expect(items(plan, 'bars')).toEqual([[id('absen Fly Bar'), 10]])
    expect(row(plan, 'bars').why).toBe('One for each column of panels, to hang them from')
  })
  it('puts truss across the top from the fewest lengths', () => {
    // H30V makes 5 m from two lengths, the black A type from three, so H30V is offered first.
    expect(items(plan, 'truss')).toEqual([
      [id('3M H30V Truss'), 1],
      [id('2M H30V truss'), 1],
    ])
    expect(row(plan, 'truss').why).toBe('5 m across the top of a 5 m screen')
    expect(row(plan, 'truss').choices.map((c) => c.id)).toEqual(['h30v', 'black a type'])
    expect(items(screenPlan(ask(10, 6, 'hung'), stock, { truss: 'black a type' }, look), 'truss')).toEqual([
      [id('3m Black a type'), 1],
      [id('1m black a type truss'), 2],
    ])
    expect(row(screenPlan(ask(11, 6, 'hung'), stock, {}, look), 'truss').why).toBe('6 m across the top of a 5.5 m screen')
  })
  it('hangs it from a motor every 3 m or less, the smallest priced motor that carries its share', () => {
    expect(items(plan, 'motors')).toEqual([[id('1/2 tonne stage maker motor'), 3]])
    expect(row(plan, 'motors').why).toMatch(/^One every 3 m or less across 5 m, about \d+ kg each$/)
    expect(items(plan, 'control')).toEqual([[id('LV12 ch motor control'), 1]])
    expect(row(plan, 'control').why).toBe('Runs 12 motors; there are 3')
    expect(plan.stands[0]).toMatch(/^Hangs from 3 points: about \d+ kg in all, \d+ kg a point if it's shared evenly\.$/)
  })
  it('takes bigger motors rather than more of them when the weight decides', () => {
    const big = screenPlan(ask(24, 12, 'hung'), stock, {}, look)
    // 288 panels at 7.5 kg is 2,160 kg before the bars and the truss: too much for five half-tonne motors at three quarters.
    expect(items(big, 'motors')).toEqual([[id('1 tonne stage maker motor'), 5]])
    const small = screenPlan(ask(24, 12, 'hung'), stock, { motors: id('1/2 tonne stage maker motor') }, look)
    expect(row(small, 'motors').items[0]!.qty).toBeGreaterThan(5)
    expect(row(small, 'motors').why).toMatch(/^Weight decides: [\d,]+ kg hangs, and each is kept to three quarters of its 500 kg$/)
  })
  it('sizes the processor by its pixels and the distro by its circuits', () => {
    expect(items(plan, 'processor')).toEqual([[id('Novastar vx4s Processor'), 1]])
    expect(row(plan, 'processor').why).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040')
    expect(items(plan, 'distro')).toEqual([[id('SES 18 way video distro'), 1]])
    expect(row(plan, 'distro').why).toBe('18 ways; this screen takes 4 circuits of 16 A')
    // 24 by 12 panels is 3,072 by 1,536: 4.7 million pixels, more than one of these drives.
    expect(items(screenPlan(ask(24, 12, 'hung'), stock, {}, look), 'processor')).toEqual([[id('Novastar vx4s Processor'), 3]])
  })
  it('counts every screen, and shares what can be shared', () => {
    const pair = screenPlan(ask(6, 4, 'hung', 2), stock, {}, look)
    expect(items(pair, 'panels')).toEqual([[absen.id, 48]])
    expect(items(pair, 'bars')).toEqual([[id('absen Fly Bar'), 12]])
    expect(items(pair, 'motors')).toEqual([[id('1/2 tonne stage maker motor'), 4]])
    expect(items(pair, 'control')).toEqual([[id('LV12 ch motor control'), 1]])
    expect(items(pair, 'processor')).toEqual([[id('Novastar vx4s Processor'), 1]])
    expect(row(pair, 'panels').why).toBe('6 across by 4 down, for 2 screens')
    expect(pair.stands[0]).toMatch(/^Each hangs from 2 points: /)
  })
  it('takes the usual choice again where it does the job with no more', () => {
    const usual = { truss: 'h30v', motors: id('1/2 tonne stage maker motor'), processor: id('Nova star pro HD video processor') }
    const again = screenPlan(ask(10, 6, 'hung'), stock, {}, { ...look, usual })
    expect([row(again, 'truss').chosen, row(again, 'motors').chosen, row(again, 'processor').chosen]).toEqual(['h30v', usual.motors, usual.processor])
    // A wall that wants tonne motors gets them, whatever was used last time; a choice made on the form always stands.
    const big = screenPlan(ask(24, 12, 'hung'), stock, {}, { ...look, usual })
    expect(row(big, 'motors').chosen).toBe(id('1 tonne stage maker motor'))
    expect(row(screenPlan(ask(24, 12, 'hung'), stock, { motors: usual.motors }, { ...look, usual }), 'motors').chosen).toBe(usual.motors)
  })
  it('offers what is charged for before what has no price', () => {
    const free = screenPlan(ask(10, 6, 'hung'), stock, {}, { price: (m) => (m === id('1/2 tonne Cm motor') ? 0 : prices.get(m)) })
    expect(row(free, 'motors').choices.map((c) => c.name)).toEqual(['1/2 tonne stage maker motor', '1 tonne stage maker motor', '1/2 tonne Cm motor'])
  })
  it('says what it could not work out rather than guess', () => {
    const blank = { ...absen, weightKg: null, powerW: null }
    const p = screenPlan({ ...ask(10, 6, 'hung', 1, blank), facts: { ...HALF, pixelsW: null, pixelsH: null } }, stock, {}, look)
    expect(items(p, 'motors')).toEqual([[id('1/2 tonne stage maker motor'), 3]])
    expect(row(p, 'motors').check).toBe("The panel's weight isn't on its product, so these are by spacing alone: check what they carry.")
    expect(row(p, 'processor').check).toBe("The panel's pixels aren't given, so check it drives this screen.")
    expect(row(p, 'distro').check).toBe("The panel's power isn't on its product, so check one is enough.")
    expect(p.stands[0]).toBe("Hangs from 3 points, one every 3 m or less. What they carry isn't worked out: the panel's weight isn't on its product.")
  })
  it('says so where the stock list has nothing for a part', () => {
    const bare = screenPlan(ask(10, 6, 'hung'), [absen])
    expect(bare.rows.filter((r) => r.none).map((r) => [r.part, r.none, r.items.length])).toEqual([
      ['bars', 'No fly bar found in the stock list.', 0],
      ['truss', 'No straight truss found in the stock list.', 0],
      ['motors', 'No motor found in the stock list.', 0],
      ['control', 'No motor control found in the stock list.', 0],
      ['processor', 'No LED processor found in the stock list.', 0],
      ['distro', 'No video power distro found in the stock list.', 0],
    ])
  })
})

describe('a ground-stacked screen', () => {
  const plan = screenPlan(ask(10, 6, 'ground'), stock, {}, look)
  it('stands against truss uprights on base plates, counted by the tipping point solver', () => {
    expect(plan.rows.map((r) => r.part)).toEqual(['panels', 'bars', 'truss', 'plates', 'processor', 'distro'])
    // H30V comes first here: it's the truss the base plate is made for.
    expect(row(plan, 'truss').chosen).toBe('h30v')
    expect(items(plan, 'truss')).toEqual([[id('3M H30V Truss'), 3]])
    expect(row(plan, 'truss').why).toBe('3 uprights of 3 m behind a 3 m screen. One every 3 m or less across 5 m')
    expect(items(plan, 'plates')).toEqual([[id('H30V 1m base plate'), 3]])
    expect(row(plan, 'bars').why).toBe('One for each column, to stand the bottom row on')
  })
  it('says how it stands, and the wind it holds to', () => {
    expect(plan.stands[0]).toBe('Stands against 3 truss uprights, 2.36 m apart, each on a base plate.')
    expect(plan.stands[1]).toMatch(/^Stands without ballast indoors\. Outdoors it holds to a wind of about \d+ m\/s \(\d+ km\/h, [a-z ]+\) before it wants ballast\.$/)
  })
  it('adds uprights when the weight of the wall decides', () => {
    const big = screenPlan(ask(24, 12, 'ground'), stock, {}, look)
    expect(row(big, 'truss').why).toMatch(/Weight decides: no upright carries more than 500 kg of wall$/)
    expect(row(big, 'truss').items.reduce((n, i) => n + i.qty, 0)).toBe(row(big, 'plates').items[0]!.qty * 2)
  })
  it('stands a narrow screen on as many base plates as fit, and says to have it looked at', () => {
    const narrow = screenPlan(ask(2, 4, 'ground'), stock, {}, look)
    expect(items(narrow, 'plates')).toEqual([[id('H30V 1m base plate'), 1]])
    expect(row(narrow, 'truss').why).toBe('1 upright of 2 m behind a 2 m screen. Only 1 base plate fits across 1 m')
    expect(row(narrow, 'truss').check).toBe('Fewer uprights than the spacing asks for: have it looked at before it is built.')
    expect(narrow.stands[0]).toBe('Stands against one truss upright on a base plate.')
  })
  it('gives the spacing alone when the wall has no weight to work with', () => {
    expect(standsOn({ widthM: 5, heightM: 3, kgPerM2: null }, { heightM: 3, kgPerM: null }, { sizeM: 1, kg: 40 })).toEqual({
      uprights: 3,
      decides: 'spacing',
      spacingM: (5 - 0.29) / 2,
      safe: null,
      ballastKg: null,
      windMs: null,
      squeezed: false,
      overloaded: false,
    })
    const blank = screenPlan(ask(10, 6, 'ground', 1, { ...absen, weightKg: null }), stock, {}, look)
    expect(blank.stands[1]).toBe("Whether it stands safely isn't worked out: the panel's weight isn't on its product.")
  })
  it('says in a warning when a stack wants ballast to stand at all, and not that more base plates would fit', () => {
    // A plate too small and light to hold the wall on the front of its uprights: no number of them does it.
    const small = stock.map((m) => (m.name === 'H30V 1m base plate' ? { ...m, name: 'H30V 0.2m base plate', weightKg: 10 } : m))
    const p = screenPlan(ask(10, 6, 'ground'), small, {}, look)
    expect(p.warns).toEqual(['Wants about 185 kg of ballast on each base plate to stand safely, even indoors.'])
    expect(p.stands).toEqual(['Stands against 3 truss uprights, 2.36 m apart, each on a base plate.'])
    expect(row(p, 'truss').why).toBe('3 uprights of 3 m behind a 3 m screen. One every 3 m or less across 5 m')
    expect(row(p, 'truss').check).toBeUndefined()
    expect(plan.warns).toEqual([])
  })
  it('keeps the wind to itself when the base plate has no weight', () => {
    const light = stock.map((m) => (m.name === 'H30V 1m base plate' ? { ...m, weightKg: null } : m))
    expect(screenPlan(ask(10, 6, 'ground'), light, {}, look).stands[1]).toBe("Stands without ballast indoors. The wind it holds to isn't worked out: the base plate's weight isn't on its product.")
  })
})

describe('an LED screen on a quote', () => {
  const line = (l: Partial<QuoteLine> & { id: string }): QuoteLine => ({ kind: 'kit', what: l.id, ref: null, group: 'LED screen', qty: 1, days: 1, unitCents: 0, vat: '23', per: 'day', modelId: null, ...l }) as QuoteLine
  const screen = { panel: 'absen', cols: 10, rows: 6, stands: 'hung' } as const
  const lines = [line({ id: 'screen', what: 'LED screen 5 × 3 m, hung', screen }), line({ id: 'panels', modelId: 'absen', qty: 60, unitCents: 4_000, under: 'screen' }), line({ id: 'bars', modelId: 'bar', qty: 10, under: 'screen' })]
  it('is one line with its kit under it, charged by that kit', () => {
    expect(linesByGroup(lines).map((g) => [g.group, g.lines.map((l) => l.id)])).toEqual([['LED screen', ['screen']]])
    expect(setCents(lines[0]!, lines)).toBe(240_000)
    // The screen's own line never asks for a price; a part with none still does.
    expect(lines.filter((l) => needsPrice(l, lines)).map((l) => l.id)).toEqual(['bars'])
  })
  it('keeps its answers when it is saved, and is a changed line when they change', () => {
    expect(quoteLine.parse(lines[0]).screen).toEqual(screen)
    expect(lineMark(lines[0]!)).not.toBe(lineMark({ ...lines[0]!, screen: { ...screen, rows: 5 } }))
    // A line that isn't a screen reads as it did before screens, so a draft open on another device isn't taken for changed.
    expect(lineMark(line({ id: 'a', what: 'Desk' }))).toBe(lineMark({ ...line({ id: 'b', what: 'Desk' }), screen: undefined }))
    expect(quoteLine.safeParse({ ...lines[0], screen: { ...screen, cols: 0 } }).success).toBe(false)
  })
})

describe("a panel's size on its product", () => {
  const update = stockCommandSchemas['model.update']
  it('is saved with a change to the product, and taken off with null', () => {
    expect(update.parse({ id: 'absen', panel: { widthMm: 500, heightMm: 500 } }).panel).toEqual({ widthMm: 500, heightMm: 500, pixelsW: null, pixelsH: null })
    expect(update.parse({ id: 'absen', panel: null }).panel).toBeNull()
  })
  it('wants a size that could be a panel, and pixels both ways or neither', () => {
    expect(update.safeParse({ id: 'absen', panel: { widthMm: 5, heightMm: 500 } }).success).toBe(false)
    const half = update.safeParse({ id: 'absen', panel: { widthMm: 500, heightMm: 500, pixelsW: 128 } })
    expect(half.success ? '' : half.error.issues[0]!.message).toBe('Give the pixels both across and down, or neither.')
  })
})
