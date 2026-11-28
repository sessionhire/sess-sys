import { describe, expect, it } from 'vitest'
import { lineMark, linesByGroup, looksLikePanel, needsPrice, panelPitch, panelWords, quoteLine, setCents, stockCommandSchemas, type PanelFacts, type QuoteLine } from '../src/index.ts'
import { gridFor, lengthsFor, liftFromName, panelChoices, screenFacts, screenIncludes, screenPlan, screenWhat, standsOn, trussFamilies, waysFromName, type PlanLookups, type ScreenPicks, type ScreenProduct } from '../src/led-screen.ts'

/**
 * The LED screen builder's sums (ADR 0207), against a stock list named the way a hire company's really is: lengths in
 * the names, a maker and a series for a panel, a typing slip in a motor control. Its data lines, the cables for them and
 * fibre to the screen are ADR 0208.
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
  it('reads how many ways a distro has, or how many motors a control runs, from its name', () => {
    expect(['SES 18 way video distro', '12way  veem 5pin dmx truss box', 'LV12 ch motor control', '8-way motor controller', '4 channel control', 'Power distro'].map(waysFromName)).toEqual([18, 12, 12, 8, 4, null])
  })
  it('reads a name the same however its spaces are typed, and is never slow on a long one', () => {
    expect(liftFromName('1 / 2   tonne motor')).toBe(500)
    expect(liftFromName('2\t-  tonne hoist')).toBe(2000)
    expect(liftFromName('0,5 t hoist')).toBe(500)
    expect(waysFromName('18   -   way distro')).toBe(18)
    // A pattern that takes any run of digits or spaces goes over the run again from each place in it: these took from a
    // third of a second to three seconds each at a third of this length.
    const long = ['9'.repeat(100_000), `9/9${' '.repeat(100_000)}`, `9${' '.repeat(100_000)}x`]
    const start = performance.now()
    for (const name of long) {
      expect(liftFromName(name)).toBeNull()
      expect(waysFromName(name)).toBeNull()
    }
    expect(performance.now() - start).toBeLessThan(1000)
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
    expect(plan.rows.map((r) => r.part)).toEqual(['panels', 'bars', 'truss', 'motors', 'control', 'processor', 'data', 'distro'])
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
    expect(row(plan, 'processor').why).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    expect(items(plan, 'distro')).toEqual([[id('SES 18 way video distro'), 1]])
    expect(row(plan, 'distro').why).toBe('18 ways; this screen takes 4 circuits of 16 A')
    // 24 by 12 panels is 3,072 by 1,536: 4.7 million pixels, more than one of these drives.
    expect(items(screenPlan(ask(24, 12, 'hung'), stock, {}, look), 'processor')).toEqual([[id('Novastar vx4s Processor'), 3]])
  })
  it('holds a screen to every limit of its processor, and names the one that decides', () => {
    const driven = (cols: number, rows: number, count = 1, name = 'Novastar vx4s Processor') => {
      const r = row(screenPlan(ask(cols, rows, 'hung', count), [...stock, product(name, video)], { processor: id(name) }, look), 'processor')
      return [r.items[0]!.qty, r.why]
    }
    // 32 panels across is 4,096 pixels: fewer than it loads, and wider than the picture it sends.
    expect(driven(32, 4)).toEqual([2, 'One drives a picture 3,840 pixels wide at most and this screen is 4,096: 2 side by side, each driving part of it'])
    expect(driven(6, 17)).toEqual([2, 'One drives a picture 1,920 pixels tall at most and this screen is 2,176: 2, one above the other, each driving part of it'])
    expect(driven(24, 12)).toEqual([3, 'One drives 2.3 million pixels and this screen has 4,718,592: 3 side by side, each driving part of it'])
    // Too wide, too tall and too many at once: halves each way are still 3.3 million, so it's thirds across.
    expect(driven(40, 20)).toEqual([6, 'One drives a picture 3,840 pixels wide at most and this screen is 5,120: 6, 3 across and 2 down, each driving part of it'])
    expect(driven(32, 4, 2)).toEqual([4, 'One drives a picture 3,840 pixels wide at most and each of these screens is 4,096: 2 side by side for every screen, each driving part of it'])
    // Several screens share one while its pixels, its ports and the room in its picture last.
    expect(driven(10, 6, 2)).toEqual([1, 'Drives 2.3 million pixels from 4 ports; these screens have 1,966,080 in 4 data lines'])
    expect(driven(10, 6, 3)).toEqual([2, 'One drives 2.3 million pixels, which is 2 of these screens at 983,040 each'])
    expect(driven(12, 8, 2)).toEqual([2, 'One drives 2.3 million pixels, which is one of these screens at 1,572,864 each'])
    // An MCTRL300's picture is 2,048 by 1,200 at most. Two screens of 1,152 by 512 go in it one above the other. Two of
    // 1,040 by 624 are within its pixels and its ports, and fit neither beside nor above each other.
    const small = 'Novastar MCTRL300 sending box'
    expect(driven(9, 4, 2, small)).toEqual([1, 'Drives 1.3 million pixels from 2 ports; these screens have 1,179,648 in 2 data lines'])
    const coarse = { ...absen, panel: { ...HALF, pixelsW: 104, pixelsH: 104 } }
    const tight = row(screenPlan(ask(10, 6, 'hung', 2, coarse), [...stock, product(small, video)], { processor: id(small) }, look), 'processor')
    expect([tight.items[0]!.qty, tight.why]).toEqual([2, 'One drives a picture up to 2,048 × 1,200 pixels, which has room for one of these screens at 1,040 × 624'])
    // A bigger one that drives it whole is taken before two of ours.
    const hired = product('Novastar VX1000 processor', video)
    expect(items(screenPlan(ask(32, 4, 'hung'), [...stock, hired], {}, look), 'processor')).toEqual([[hired.id, 1]])
  })
  it('reads a processor by its whole name, with what its own sheet says it drives', () => {
    const why = (name: string) => row(screenPlan(ask(10, 6, 'hung'), [...stock, product(name, video)], { processor: id(name) }, look), 'processor').why
    // A VX400s is the older unit, not a VX400; an MCTRL660 PRO has six ports, not the MCTRL660's four.
    expect(why('Novastar VX400s')).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    expect(why('Novastar VX400')).toBe('Drives 2.6 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    expect(why('Novastar VX400 Pro')).toBe('Drives 2.6 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    expect(why('Novastar MCTRL660 PRO')).toBe('Drives 2.3 million pixels from 6 ports; this screen has 983,040 in 2 data lines')
    expect(why('Novastar MCTRL660')).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    expect(why('Novastar MCTRL600')).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    // 3840 by 2160, as its sheet has it.
    expect(why('Novastar MCTRL4K')).toBe('Drives 8.3 million pixels from 16 ports; this screen has 983,040 in 2 data lines')
    expect(why('Novastar VX4S-N')).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
  })
  it('holds the MX range to what its maker says today: the screen it sends, and what one of its ports carries', () => {
    const driven = (cols: number, rows: number, count: number, name: string) => {
      const r = row(screenPlan(ask(cols, rows, 'hung', count), [...stock, product(name, video)], { processor: id(name) }, look), 'processor')
      return [r.items[0]!.qty, r.why]
    }
    // No MX30 or MX40 sends a screen past 16,384 pixels either way, nor an MX20 or KU20 one past 4,096.
    expect(driven(130, 2, 1, 'Novastar MX40')).toEqual([2, 'One drives a picture 16,384 pixels wide at most and this screen is 16,640: 2 side by side, each driving part of it'])
    expect(driven(130, 2, 1, 'Novastar MX30')).toEqual([2, 'One drives a picture 16,384 pixels wide at most and this screen is 16,640: 2 side by side, each driving part of it'])
    expect(driven(33, 4, 1, 'Novastar MX20')).toEqual([2, 'One drives a picture 4,096 pixels wide at most and this screen is 4,224: 2 side by side, each driving part of it'])
    expect(driven(4, 33, 1, 'Novastar KU20')).toEqual([2, 'One drives a picture 4,096 pixels tall at most and this screen is 4,224: 2, one above the other, each driving part of it'])
    // 549 panels are just inside the MX40's 9 million pixels, which its first sheet gave as 8.8 million.
    expect(driven(61, 9, 1, 'Novastar MX40')).toEqual([1, 'Drives 9 million pixels from 20 ports; this screen has 8,994,816 in 16 data lines'])
    // A 5 by 2 metre screen is 655,360 pixels: one data line from an MX, whose port carries 659,722, and two from an older
    // unit, sized at 650,000 a port. So nine of them share one MX30, and five a VX1000 with the same ten ports.
    expect(driven(10, 4, 9, 'Novastar MX30')).toEqual([1, 'Drives 6.5 million pixels from 10 ports; these screens have 5,898,240 in 9 data lines'])
    expect(driven(10, 4, 9, 'Novastar VX1000 processor')).toEqual([2, 'One has 10 ports, which is 5 of these screens at 2 data lines each'])
  })
  it('knows the bigger processors we hold by whatever they are called, and sends the smallest of ours that drives the screen whole', () => {
    const with_ = (name: string, more: Partial<ScreenProduct> = video) => row(screenPlan(ask(10, 6, 'hung'), [...stock, product(name, more)], { processor: id(name) }, look), 'processor')
    expect(with_('Novastar MX30').why).toBe('Drives 6.5 million pixels from 10 ports; this screen has 983,040 in 2 data lines')
    for (const name of ['MX40', 'Novastar MX40 Pro', 'mx 40pro']) expect(with_(name).why).toBe('Drives 9 million pixels from 20 ports; this screen has 983,040 in 2 data lines')
    expect(with_('MX20').why).toBe('Drives 3.9 million pixels from 6 ports; this screen has 983,040 in 2 data lines')
    expect(with_('Novastar KU20').why).toBe('Drives 3.9 million pixels from 6 ports; this screen has 983,040 in 2 data lines')
    for (const name of ['UHD Junior', 'NovaPro UHD Jr', 'Nova star pro UHD jr']) expect(with_(name).why).toBe('Drives 10.4 million pixels from 16 ports; this screen has 983,040 in 2 data lines')
    expect(with_('NovaPro UHD').why).toBe('Drives 8.8 million pixels from 16 ports; this screen has 983,040 in 2 data lines')
    expect(with_('NovaPro HD').why).toBe('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
    // An MX2000 Pro is built from cards, so what it drives is no one figure: it is offered, to be checked.
    expect(with_('Novastar MX2000 Pro').check).toBe("Check it drives 983,040 pixels: what it loads isn't known here.")
    // "MX30" says neither NovaStar nor processor: among the video kit it's known by its model, and elsewhere it's something else.
    const offered = (extra: ScreenProduct[]) => row(screenPlan(ask(10, 6, 'hung'), [...stock, ...extra], {}, look), 'processor').choices.map((c) => c.name)
    expect(offered([product('MX30', video)])).toEqual(['Novastar vx4s Processor', 'Nova star pro HD video processor', 'MX30'])
    expect(offered([product('MX30', { department: 'audio', category: 'Audio' })])).toEqual(['Novastar vx4s Processor', 'Nova star pro HD video processor'])
    // The fibre converter that carries its lines to the screen, and the card in a panel, drive nothing.
    expect(offered([product('Novastar CVT10 Pro', video), product('Novastar fibre converter', video), product('Novastar A8s receiving card', video)])).toEqual(['Novastar vx4s Processor', 'Nova star pro HD video processor'])

    const ours = [...stock, product('MX30', video), product('MX40 Pro', video), product('UHD Junior', video)]
    const sent = (cols: number, rows: number, list = ours) => items(screenPlan(ask(cols, rows, 'hung'), list, {}, look), 'processor')
    // A small screen keeps a small one. One 16 m wide is past a VX4S's picture: one MX30, not two VX4S.
    expect(sent(10, 6)).toEqual([[id('Novastar vx4s Processor'), 1]])
    expect(sent(32, 4)).toEqual([[id('MX30'), 1]])
    expect(row(screenPlan(ask(32, 4, 'hung'), ours, {}, look), 'processor').why).toBe('Drives 6.5 million pixels from 10 ports; this screen has 2,097,152 in 4 data lines')
    // 450 panels are 7.4 million pixels, past the MX30: the MX40 Pro. 576 are 9.4 million, past that too: the UHD Jr.
    expect(sent(30, 15)).toEqual([[id('MX40 Pro'), 1]])
    expect(sent(36, 16)).toEqual([[id('UHD Junior'), 1]])
    // One of ours is taken before a smaller one hired in that would also do it.
    const hired = product('Novastar VX1000 processor', { ...video, dryHire: true })
    expect(sent(32, 4, [...stock, hired, product('MX40 Pro', video)])).toEqual([[id('MX40 Pro'), 1]])
    expect(sent(32, 4, [...stock, hired])).toEqual([[hired.id, 1]])
  })
  it('reads the processors and the fibre converter as the stock list names them', () => {
    // Their names and their category as they stand in the stock list on 28 November 2026.
    const filed = { department: 'video', category: 'LED Processor' } as const
    const names = ['Novastar VX4S', 'Novastar pro HD', 'Novastar MX30', 'Novastar MX40', 'Novastar UHD Jnr']
    const list = [
      ...stock.filter((m) => !/processor/i.test(m.name)),
      product('Novastar VX4S', filed),
      product('Novastar pro HD', filed),
      product('Novastar MX30', { ...filed, aliases: ['MX30'] }),
      product('Novastar MX40', { ...filed, aliases: ['MX40'] }),
      product('Novastar UHD Jnr', filed),
      product('Novastar CVT Pro', { department: 'video', category: '' }),
    ]
    const why = (name: string) => row(screenPlan(ask(10, 6, 'hung'), list, { processor: id(name) }, look), 'processor').why
    expect(names.map(why)).toEqual([
      'Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines',
      'Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines',
      'Drives 6.5 million pixels from 10 ports; this screen has 983,040 in 2 data lines',
      'Drives 9 million pixels from 20 ports; this screen has 983,040 in 2 data lines',
      'Drives 10.4 million pixels from 16 ports; this screen has 983,040 in 2 data lines',
    ])
    // The fibre converter drives nothing, with its number in its name or without.
    expect(row(screenPlan(ask(10, 6, 'hung'), list, {}, look), 'processor').choices.map((c) => c.name).sort()).toEqual([...names].sort())
    // Each screen goes to the smallest that drives it whole.
    const sent = (cols: number, rows: number) => items(screenPlan(ask(cols, rows, 'hung'), list, {}, look), 'processor')
    expect(sent(32, 4)).toEqual([[id('Novastar MX30'), 1]])
    expect(sent(30, 15)).toEqual([[id('Novastar MX40'), 1]])
    expect(sent(36, 16)).toEqual([[id('Novastar UHD Jnr'), 1]])
    // Filed as an LED processor, one whose name says nothing of it is still offered, to be checked.
    const odd = product('Kystar U4', filed)
    expect(row(screenPlan(ask(10, 6, 'hung'), [...list, odd], { processor: odd.id }, look), 'processor').check).toBe("Check it drives 983,040 pixels: what it loads isn't known here.")
    expect(row(screenPlan(ask(10, 6, 'hung'), [...list, product('Kystar U4', video)], {}, look), 'processor').choices.map((c) => c.name)).not.toContain('Kystar U4')
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
      ['data', 'No data cable found in the stock list.', 0],
      ['distro', 'No video power distro found in the stock list.', 0],
    ])
  })
})

describe('a ground-stacked screen', () => {
  const plan = screenPlan(ask(10, 6, 'ground'), stock, {}, look)
  it('stands against truss uprights on base plates, counted by the tipping point solver', () => {
    expect(plan.rows.map((r) => r.part)).toEqual(['panels', 'bars', 'truss', 'plates', 'processor', 'data', 'distro'])
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

describe("a screen's data lines, and what takes them to it", () => {
  // The processors, the data cables, the fibre and its converter by their names in the stock list on 28 November 2026, with
  // the kit beside them that is none of these.
  const filed = { department: 'video', category: 'LED Processor' } as const
  const cables = { department: 'other', category: 'Cables' } as const
  const [vx4s, proHd, mx30, mx40, uhd] = ['Novastar VX4S', 'Novastar pro HD', 'Novastar MX30', 'Novastar MX40', 'Novastar UHD Jnr'].map((name) => product(name, filed)) as [ScreenProduct, ScreenProduct, ScreenProduct, ScreenProduct, ScreenProduct]
  const reel = product('Cat 5 reel', { ...cables, lengthM: 100 })
  const cat6 = product('Cat6 Cable', { department: 'other', category: '', lengthM: 50 })
  // Two products of one name, told apart by their lengths.
  const cat30 = product('cat5 cable', { id: 'cat5-30', department: 'audio', category: 'Audio', lengthM: 30 })
  const cat20 = product('cat5 cable', { id: 'cat5-20', ...cables, lengthM: 20 })
  const cvt = product('Novastar CVT Pro', { department: 'video', category: '' })
  const fibre = product('Single Mode Fibre', { ...video, lengthM: 100 })
  const beside = [
    product('FOH Multicore CAT 6', cables),
    product('Absen Data Link', { ...video, category: 'Cables' }),
    product('Luminex ethernet - dmx node 8', { department: 'lighting' }),
    product('Lx Data Rack Main', { department: 'audio' }),
    product('data rack', { department: 'lighting' }),
    product('SDI Reel', { ...video, lengthM: 100 }),
    product('SM Fiber Patch LC/LC', { ...video, category: 'Cables', lengthM: 0.5 }),
    product('Neutrik Opticon Duo Panel Socket', { ...video, category: 'Cables' }),
  ]
  const rest = stock.filter((m) => !/processor/i.test(m.name))
  /** The stock list without the converter, and with it and the fibre it runs on. */
  const held = [...rest, vx4s, proHd, mx30, mx40, uhd, reel, cat6, cat30, cat20, ...beside]
  const wired = [...held, cvt, fibre]
  const planOf = (cols: number, rows: number, more: { count?: number; fibre?: boolean; list?: ScreenProduct[]; picks?: ScreenPicks; look?: PlanLookups; panel?: ScreenProduct } = {}) =>
    screenPlan({ ...ask(cols, rows, 'hung', more.count ?? 1, more.panel ?? absen), ...(more.fibre ? { fibre: true } : {}) }, more.list ?? held, more.picks ?? {}, more.look ?? {})
  const data = (plan: ReturnType<typeof screenPlan>) => [plan.lines, items(plan, 'data'), row(plan, 'data').why]

  it('counts them as a screen is cabled: whole columns, as many to a line as it carries', () => {
    // A 4 by 2.5 metre screen is 655,360 pixels, over the 650,000 a line carries: two lines of four columns.
    expect(data(planOf(8, 5))).toEqual([2, [[reel.id, 2]], 'One for each of the 2 data lines, from the processor to the screen. A line takes 4 columns of panels.'])
    expect(data(planOf(16, 7))).toEqual([4, [[reel.id, 4]], 'One for each of the 4 data lines, from the processor to the screen. A line takes 4 columns of panels.'])
    expect(data(planOf(2, 2))).toEqual([1, [[reel.id, 1]], 'One data line, from the processor to the screen. It takes the whole screen.'])
    // 32 columns at three to a line: ten lines of three and one of two.
    expect(data(planOf(32, 12))).toEqual([11, [[reel.id, 11]], 'One for each of the 11 data lines, from the processor to the screen. A line takes up to 3 columns of panels.'])
    expect(data(planOf(24, 20))).toEqual([12, [[reel.id, 12]], 'One for each of the 12 data lines, from the processor to the screen. A line takes 2 columns of panels.'])
    expect(planOf(8, 5).working).toContain('A data line is counted at 650,000 pixels, for 60 Hz in 8-bit colour, as a tidy block of whole panels: whole columns, cut shorter only where a column is more than one line carries or that saves a processor.')
    expect(planOf(8, 5).working).toContain('The links between panels, mains cables, slings and shackles are not counted: add what the job takes as kit.')
  })
  it('cuts the columns shorter only where whole columns are more than its ports', () => {
    // A column 21 panels tall is 344,064 pixels, so a line carries one: 25 lines, and an MX40 has 20 ports. In halves a
    // line carries three half columns: 18 lines.
    const tall = planOf(25, 21)
    expect(items(tall, 'processor')).toEqual([[mx40.id, 1]])
    expect(row(tall, 'processor').why).toBe('Drives 9 million pixels from 20 ports; this screen has 8,601,600 in 18 data lines')
    expect(row(tall, 'processor').check).toBeUndefined()
    expect(data(tall)).toEqual([18, [[reel.id, 18]], 'One for each of the 18 data lines, from the processor to the screen. A line takes a block of up to 3 panels across by 11 down.'])
    // A UHD Jr has 16 ports: the columns in thirds, five to a line.
    expect(data(planOf(25, 21, { picks: { processor: uhd.id } }))).toEqual([15, [[reel.id, 15]], 'One for each of the 15 data lines, from the processor to the screen. A line takes a block of up to 5 panels across by 7 down.'])
    // Nine columns eight tall are three lines in whole columns. A sending box with two ports takes them as two lines of whole rows.
    const box = product('Novastar MCTRL300 sending box', video)
    const rows = planOf(9, 8, { list: [...held, box], picks: { processor: box.id } })
    expect(row(rows, 'processor').why).toBe('Drives 1.3 million pixels from 2 ports; this screen has 1,179,648 in 2 data lines')
    expect(row(rows, 'data').why).toBe('One for each of the 2 data lines, from the processor to the screen. A line takes 4 rows of panels.')
  })
  it('lets an MX line carry on from one column into the next only where that is what fits, and sends the processor that needs no such thing', () => {
    // A 16 by 6 metre screen is 11 lines in whole columns. An MX40 has the ports; an MX30 has ten, which is what its
    // 384 panels come to at 40 to a line.
    expect(items(planOf(32, 12), 'processor')).toEqual([[mx40.id, 1]])
    const on = planOf(32, 12, { picks: { processor: mx30.id } })
    expect(row(on, 'processor').why).toBe('Drives 6.5 million pixels from 10 ports; this screen has 6,291,456 in 10 data lines')
    expect(row(on, 'processor').check).toBe('Fits the 10 ports it has only if a data line carries on from one column into part of the next: in whole columns this screen takes 11 lines.')
    expect(data(on)).toEqual([10, [[reel.id, 10]], 'One for each of the 10 data lines, from the processor to the screen. A line takes up to 40 panels, carrying on from one column into part of the next.'])
    expect(on.working).toContain("A data line is counted at 659,722 pixels, for 60 Hz in 8-bit colour, by its panels' own pixels: this processor doesn't ask for a line to be a tidy block of panels.")
    expect(planOf(32, 12).working).toContain('A data line is counted at 659,722 pixels, for 60 Hz in 8-bit colour, as a tidy block of whole panels: whole columns, cut shorter only where a column is more than one line carries or that saves a processor.')
    // An older unit with the same ten ports counts each port's panels as a rectangle, so its lines never carry on: two of it.
    const older = product('Novastar VX1000 processor', video)
    const two = planOf(32, 12, { list: [...held, older], picks: { processor: older.id } })
    expect([row(two, 'processor').items[0]!.qty, row(two, 'processor').why]).toEqual([2, 'One has 10 ports and this screen takes 11 data lines: 2 side by side, each driving part of it'])
    expect(data(two)).toEqual([12, [[reel.id, 12]], 'One for each of the 12 data lines, from the processor to the screen. A line takes up to 3 columns of panels.'])
  })
  it('counts a panel narrower than 128 pixels as that wide on an MX line, and by its own pixels on an older one', () => {
    const narrow = { ...stock[1]!, panel: { widthMm: 500, heightMm: 1000, pixelsW: 104, pixelsH: 208 } }
    // A column six tall is 129,792 pixels, five to a line. An MX30 counts each panel 128 wide: 159,744, four to a line.
    const mx = planOf(24, 6, { panel: narrow })
    expect(items(mx, 'processor')).toEqual([[mx30.id, 1]])
    expect(data(mx)).toEqual([6, [[reel.id, 6]], 'One for each of the 6 data lines, from the processor to the screen. A line takes 4 columns of panels.'])
    expect(mx.working).toContain('This processor counts a panel narrower than 128 pixels as 128 wide, so each of these takes more of a line than its own 104.')
    const older = planOf(24, 6, { panel: narrow, picks: { processor: uhd.id } })
    expect(data(older)).toEqual([5, [[reel.id, 5]], 'One for each of the 5 data lines, from the processor to the screen. A line takes up to 5 columns of panels.'])
    expect(older.working.join(' ')).not.toMatch(/narrower/)
  })
  it('finds a data cable by what it is called, the longest first, and none longer than a line runs', () => {
    const more = [
      product('network lead 10m', cables),
      product('Ethercon cable', cables),
      product('Cat6 drum 150m', cables),
      product('RJ45 coupler', cables),
      product('Ethercon barrel', cables),
      product('Cat5 tester', cables),
      product('Cat6 patch panel', cables),
    ]
    // One whose length isn't known comes last. The multicore, the link between panels, the node and the racks are no data cable.
    expect(row(planOf(8, 5, { list: [...held, ...more] }), 'data').choices.map((c) => c.name)).toEqual(['Cat 5 reel 100 m', 'Cat6 Cable 50 m', 'cat5 cable 30 m', 'cat5 cable 20 m', 'network lead 10m', 'Ethercon cable'])
    const only = planOf(8, 5, { list: [...rest, vx4s, product('Ethercon cable', cables)] })
    expect(items(only, 'data')).toEqual([[id('Ethercon cable'), 2]])
    expect(row(only, 'data').check).toBe("Check it reaches: its length isn't on its product.")
    expect(row(planOf(8, 5), 'data').check).toBeUndefined()
  })
  it('takes the longest there are enough of, the one used last time, or the one picked', () => {
    // Three reels free and none of the 50 metre cables: four lines go to the 30 metre ones, two lines stay on the reel.
    const free = (m: string) => ({ [reel.id]: 3, [cat6.id]: 0 })[m]
    expect(items(planOf(16, 7, { look: { free } }), 'data')).toEqual([[cat30.id, 4]])
    expect(row(planOf(16, 7, { look: { free } }), 'data').choices.map((c) => c.id)).toEqual([cat30.id, cat20.id, reel.id, cat6.id])
    expect(items(planOf(8, 5, { look: { free } }), 'data')).toEqual([[reel.id, 2]])
    expect(items(planOf(16, 7, { look: { usual: { data: cat20.id } } }), 'data')).toEqual([[cat20.id, 4]])
    expect(items(planOf(16, 7, { look: { usual: { data: cat20.id } }, picks: { data: cat6.id } }), 'data')).toEqual([[cat6.id, 4]])
    // A cable is picked for how far it goes: a price only parts two of one length.
    expect(items(planOf(16, 7, { look: { price: (m) => (m === cat20.id ? 500 : 0) } }), 'data')).toEqual([[reel.id, 4]])
    const twin = product('Cat5e drum', { ...cables, lengthM: 100 })
    expect(items(planOf(16, 7, { list: [...held, twin], look: { price: (m) => (m === twin.id ? 500 : 0) } }), 'data')).toEqual([[twin.id, 4]])
  })
  it('counts the lines of every screen, and one a screen where the pixels are not given', () => {
    // Three 4 by 2.5 metre screens are a line each from an MX30, whose line carries 659,722 pixels.
    const three = planOf(8, 5, { count: 3 })
    expect(items(three, 'processor')).toEqual([[mx30.id, 1]])
    expect(data(three)).toEqual([1, [[reel.id, 3]], 'One for each of the 3 data lines, from the processor to the screen, for 3 screens. Each takes a whole screen.'])
    const blank = screenPlan({ ...ask(8, 5, 'hung', 2), facts: { ...HALF, pixelsW: null, pixelsH: null } }, wired)
    expect(data(blank)).toEqual([null, [[reel.id, 2]], 'One for each screen, from the processor.'])
    expect(row(blank, 'data').check).toBe("The panel's pixels aren't given, so its data lines aren't counted: check how many it takes.")
    expect(items(blank, 'fibre')).toEqual([[cvt.id, 2], [fibre.id, 1]])
    expect(blank.working.join(' ')).not.toMatch(/A data line is counted/)
    // With no processor in the stock list the lines are counted by the planning figure.
    expect(data(planOf(16, 7, { list: held.filter((m) => m.category !== 'LED Processor') }))).toEqual([4, [[reel.id, 4]], 'One for each of the 4 data lines, from the processor to the screen. A line takes 4 columns of panels.'])
  })
  it('offers fibre to the screen only where the stock list holds a converter, as a part that says what it would add', () => {
    // No converter: no such part, and asking for it changes nothing.
    expect(planOf(16, 7, { fibre: true }).rows.map((r) => r.part)).toEqual(['panels', 'bars', 'truss', 'motors', 'control', 'processor', 'data', 'distro'])
    expect(data(planOf(16, 7, { fibre: true }))).toEqual(data(planOf(16, 7)))
    const plain = planOf(16, 7, { list: wired })
    expect(plain.rows.map((r) => r.part)).toEqual(['panels', 'bars', 'truss', 'motors', 'control', 'processor', 'data', 'fibre', 'distro'])
    // Not asked for, it carries what it would add, and the cables are still the long ones.
    expect(items(plain, 'fibre')).toEqual([[cvt.id, 2], [fibre.id, 1]])
    expect(row(plain, 'fibre').why).toBe('In place of a long data cable for every line: a converter at each end for every 10 data lines, and a fibre between each pair.')
    expect(row(plain, 'fibre').choices.map((c) => c.name)).toEqual(['Novastar CVT Pro'])
    expect(data(plain)).toEqual(data(planOf(16, 7)))
    expect(plain.working.join(' ')).not.toMatch(/converter/)
  })
  it('by fibre takes a converter at each end from a processor with no fibre output, and two short cables a line', () => {
    const by = planOf(16, 7, { list: wired, fibre: true })
    expect(items(by, 'processor')).toEqual([[vx4s.id, 1]])
    // An 8 by 3.5 metre screen: the shortest cable that goes 11.5 metres.
    expect(data(by)).toEqual([4, [[cat20.id, 8]], 'Two for each of the 4 data lines: from the processor to its converter, and from the converter at the screen to the first panel. A line takes 4 columns of panels.'])
    expect(items(by, 'fibre')).toEqual([[cvt.id, 2], [fibre.id, 1]])
    expect(by.working).toContain("A fibre converter is taken to carry 10 data lines, as NovaStar's CVT10 Pro does. The converters and the fibre between them have to be of one kind: single-mode with single-mode.")
    expect(by.working).toContain('The data cable offered is the shortest that reaches the far corner of the screen from a converter at one end: 11.5 m or more.')
    // The long cable used last time isn't taken for the short run; one picked is.
    expect(items(planOf(16, 7, { list: wired, fibre: true, look: { usual: { data: reel.id } } }), 'data')).toEqual([[cat20.id, 8]])
    expect(items(planOf(16, 7, { list: wired, fibre: true, picks: { data: cat6.id } }), 'data')).toEqual([[cat6.id, 8]])
    // A processor we don't know is taken the same way, its lines by the planning figure.
    const other = product('Linsn TS802 sending box', video)
    const unknown = planOf(16, 7, { list: [...wired.filter((m) => m.category !== 'LED Processor'), other], fibre: true })
    expect([items(unknown, 'data'), items(unknown, 'fibre')]).toEqual([[[cat20.id, 8]], [[cvt.id, 2], [fibre.id, 1]]])
  })
  it('by fibre takes one converter at the screen for each fibre a bigger processor sends', () => {
    // An MX30 sends its ten lines down one fibre. A line carries ten columns four tall: 32 are four lines, shared out as eight each.
    const one = planOf(32, 4, { list: wired, fibre: true })
    expect(items(one, 'processor')).toEqual([[mx30.id, 1]])
    expect(data(one)).toEqual([4, [[cat20.id, 4]], 'One for each of the 4 data lines, from the converter at the screen to its first panel. A line takes 8 columns of panels.'])
    expect(items(one, 'fibre')).toEqual([[cvt.id, 1], [fibre.id, 1]])
    expect(row(one, 'fibre').why).toBe('In place of a long data cable for every line: a converter at the screen for every 10 data lines, each on a fibre from the processor.')
    // An MX40's 11 lines go down two. The screen is 16 by 6 metres: the 30 metre cable is the shortest that crosses it.
    const two = planOf(32, 12, { list: wired, fibre: true })
    expect(items(two, 'processor')).toEqual([[mx40.id, 1]])
    expect(row(two, 'processor').why).toBe('Drives 9 million pixels from 20 ports; this screen has 6,291,456 in 11 data lines')
    expect(data(two)).toEqual([11, [[cat30.id, 11]], 'One for each of the 11 data lines, from the converter at the screen to its first panel. A line takes up to 3 columns of panels.'])
    expect(items(two, 'fibre')).toEqual([[cvt.id, 2], [fibre.id, 2]])
    // A UHD Jr sends eight down each of its fibres: 15 lines are two.
    const jr = planOf(25, 21, { list: wired, fibre: true, picks: { processor: uhd.id } })
    expect(items(jr, 'fibre')).toEqual([[cvt.id, 2], [fibre.id, 2]])
    expect(row(jr, 'fibre').why).toBe('In place of a long data cable for every line: a converter at the screen for every 8 data lines, each on a fibre from the processor.')
    // No cable long enough to cross the screen: the longest, to be checked.
    const short = planOf(60, 20, { list: wired.filter((m) => ![reel.id, cat6.id, cat30.id].includes(m.id)), fibre: true })
    expect(row(short, 'data').chosen).toBe(cat20.id)
    expect(row(short, 'data').check).toBe('Check it reaches every line from the converter: the screen is 30 m wide and 10 m tall.')
  })
  it("counts an MX40's other 20 ports where the lines go by fibre, and says so where they would help", () => {
    // 25 lines in whole columns: past its 20 ports by data cable, within its 40 by fibre, three fibres of ten.
    const off = planOf(25, 21, { list: wired })
    expect(row(off, 'processor').check).toBe('It has 20 more ports that only leave by fibre: with Fibre to the screen ticked, every line keeps to whole columns.')
    expect(items(off, 'fibre')).toEqual([[cvt.id, 3], [fibre.id, 3]])
    const by = planOf(25, 21, { list: wired, fibre: true })
    expect(items(by, 'processor')).toEqual([[mx40.id, 1]])
    expect(row(by, 'processor').why).toBe('Drives 9 million pixels from 40 ports by fibre; this screen has 8,601,600 in 25 data lines')
    expect(row(by, 'processor').check).toBe('More than 20 lines takes its 40-port mode, which wants VMP and its firmware at 1.4.0 or later.')
    expect(data(by)).toEqual([25, [[cat30.id, 25]], 'One for each of the 25 data lines, from the converter at the screen to its first panel. A line takes one column of panels.'])
    expect(items(by, 'fibre')).toEqual([[cvt.id, 3], [fibre.id, 3]])
    // 21 small screens are a line each: two MX40s by data cable, one by fibre.
    const many = planOf(2, 2, { count: 21, list: wired, picks: { processor: mx40.id } })
    expect([row(many, 'processor').items[0]!.qty, row(many, 'processor').why]).toEqual([2, 'One has 20 ports, which is 20 of these screens at 1 data line each'])
    expect(row(many, 'processor').check).toBe('It has 20 more ports that only leave by fibre: with Fibre to the screen ticked, one drives these screens.')
    const manyBy = planOf(2, 2, { count: 21, list: wired, picks: { processor: mx40.id }, fibre: true })
    expect([row(manyBy, 'processor').items[0]!.qty, row(manyBy, 'processor').why]).toEqual([1, 'Drives 9 million pixels from 40 ports by fibre; these screens have 1,376,256 in 21 data lines'])
    // Within its 20 ports nothing is said of the mode.
    expect(row(planOf(32, 12, { list: wired, fibre: true }), 'processor').check).toBeUndefined()
  })
  it('counts the converters by what each processor carries, and says several screens may share one', () => {
    // Six 8 by 3.5 metre screens are four lines each: four screens on one MX40 and two on the other, 16 lines and 8.
    const six = planOf(16, 7, { count: 6, list: wired, fibre: true })
    expect([items(six, 'processor'), row(six, 'processor').why]).toEqual([[[mx40.id, 2]], 'One drives 9 million pixels, which is 4 of these screens at 1,835,008 each'])
    expect(data(six)).toEqual([4, [[cat20.id, 24]], 'One for each of the 24 data lines, from the converter at the screens to its first panel, for 6 screens. A line takes 4 columns of panels.'])
    expect(items(six, 'fibre')).toEqual([[cvt.id, 3], [fibre.id, 3]])
    expect(row(six, 'fibre').why).toBe('In place of a long data cable for every line: a converter at the screens for every 10 data lines, each on a fibre from the processor, for 6 screens.')
    expect(row(six, 'fibre').check).toBe('One converter may feed more than one screen: where they stand apart, check its data cables reach each, or add a converter.')
    expect(row(planOf(16, 7, { list: wired, fibre: true }), 'fibre').check).toBeUndefined()
  })
  it('runs the converters on the longest fibre in the stock list, and says so where there is none', () => {
    // A patch lead, a panel socket and the converter itself are not the run. A drum is, by fibre's name or its connector's.
    const drum = product('Opticalcon Duo drum 150m', video)
    expect(items(planOf(16, 7, { list: [...wired, drum] }), 'fibre')).toEqual([[cvt.id, 2], [drum.id, 1]])
    const none = planOf(16, 7, { list: [...held, cvt], fibre: true })
    expect(items(none, 'fibre')).toEqual([[cvt.id, 2]])
    expect(row(none, 'fibre').check).toBe('No fibre found in the stock list to run between them: add what carries it.')
    // The converter is known by its number as well: one called a CVT10 Pro, or a fibre converter.
    for (const name of ['Novastar CVT10 Pro', 'NovaStar CVT10 Pro-S', 'Fibre converter 10 port']) expect(row(planOf(16, 7, { list: [...held, product(name, video), fibre] }), 'fibre').choices.map((c) => c.name)).toEqual([name])
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
