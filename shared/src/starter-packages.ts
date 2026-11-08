import { kitKey } from './kit-notes.ts'
import type { Package, RateRule } from './quotes.ts'
import type { Department, Model } from './stock.ts'

/**
 * The starter packages (ADR 0117): kit sets drawn from Current RMS's past quotes
 * (docs/research/package-starter-list.md), which Colly chose to load all of on 8 November 2026, generic names only.
 * Each names its products as the stock list does, matched by name or another name when added, so a product renamed
 * since has the package wait until it's found. Ids are fixed, so adding them again changes nothing that's there.
 */
export interface StarterPackage {
  id: string
  name: string
  department: Department
  items: readonly (readonly [product: string, qty: number])[]
  notes?: string
  /** Only where Current RMS charged the set as one line; otherwise its items' total. */
  dayCents?: number
  rate?: RateRule
}

/** Products the mic packages need that weren't on Current RMS's list (Colly, 8 November 2026): added with no count. */
export interface StarterProduct {
  id: string
  name: string
  category: string
  aliases: readonly string[]
}

export const STARTER_PRODUCTS: readonly StarterProduct[] = [
  { id: 'model-starter-sm57', name: 'Shure SM57', category: 'Microphones', aliases: ['57', 'SM 57'] },
  { id: 'model-starter-beta52', name: 'Shure Beta 52A', category: 'Microphones', aliases: ['Beta 52', 'Kick mic'] },
  { id: 'model-starter-beta91', name: 'Shure Beta 91A', category: 'Microphones', aliases: ['Beta 91'] },
  { id: 'model-starter-e904', name: 'Sennheiser e904', category: 'Microphones', aliases: ['904', 'Tom mic'] },
  { id: 'model-starter-e906', name: 'Sennheiser e906', category: 'Microphones', aliases: ['906', 'Guitar mic'] },
  { id: 'model-starter-c451', name: 'AKG C451 B', category: 'Microphones', aliases: ['C451', 'Overhead mic'] },
  { id: 'model-starter-di-passive', name: 'DI box, passive', category: 'DI boxes', aliases: ['DI', 'Passive DI'] },
  { id: 'model-starter-di-active', name: 'DI box, active', category: 'DI boxes', aliases: ['Active DI'] },
]

export const STARTER_PACKAGES: readonly StarterPackage[] = [
  { id: 'pkg-speech-pa-small', name: 'Speech PA, small', department: 'audio', items: [['D&B YP10 & YP Bracket', 2], ['D&B D20 Amplifier', 1], ['K&M Speaker Stand', 2], ['Midas M32R mixing console', 1], ['Shure SLX-Beta 58 Stick-Belt Pack & Headset', 4]] },
  { id: 'pkg-speech-pa-large', name: 'Speech PA, large', department: 'audio', items: [['D&B YP10 & YP Bracket', 4], ['D&B D20 Amplifier', 2], ['K&M Speaker Stand', 4], ['Midas M32R mixing console', 1], ['Shure SLX-Beta 58 Stick-Belt Pack & Headset', 6]] },
  { id: 'pkg-e3-pa', name: 'E3 speech PA', department: 'audio', items: [['D&B E3', 4], ['D&B D20 Amplifier', 1], ['K&M Speaker Stand', 4], ['Midas M32R mixing console', 1], ['Shure SLX-Beta 58 Stick-Belt Pack & Headset', 6]] },
  { id: 'pkg-party-pa', name: 'Party PA (YP10 + V subs)', department: 'audio', items: [['D&B YP10 & YP Bracket', 4], ['D&B V subwoofer', 2], ['D&B D20 Amplifier', 2], ['K&M Sub Pole Stand', 2], ['Midas M32R mixing console', 1]] },
  { id: 'pkg-party-pa-q', name: 'Party PA (YP10 + Q subs)', department: 'audio', items: [['D&B YP10 & YP Bracket', 4], ['D&B Q Sub', 2], ['D&B D20 Amplifier', 2], ['K&M Sub Pole Stand', 2], ['Midas M32R mixing console', 1]] },
  { id: 'pkg-max12-pa', name: 'Max 12 PA', department: 'audio', items: [['D&B Max 12 speaker', 4], ['D&B D20 Amplifier', 2], ['Midas M32R mixing console', 1]] },
  { id: 'pkg-dj-booth', name: 'DJ booth', department: 'audio', items: [['Cdj 3000', 2], ['Djm 900 nxs 2', 1]], notes: 'DJ riser and a vocal mic if asked' },
  { id: 'pkg-dj-booth-3', name: 'DJ booth, three decks', department: 'audio', items: [['Cdj 3000', 3], ['Djm 900 nxs 2', 1]], notes: 'DJ riser and a vocal mic if asked' },
  { id: 'pkg-al90-system', name: 'AL90 system', department: 'audio', items: [['D&B AL90 loudspeaker', 4], ['D&B V subwoofer', 4], ['D&B D40', 3]] },
  { id: 'pkg-y8-system', name: 'Y8 hang', department: 'audio', items: [['D&B Y8', 10], ['D&B Y Base Plate/Stack Adaptor', 2], ['D&B V subwoofer', 6], ['D&B D80 Amplifier', 4], ['socapex cable 20m', 2], ['Socapex to NL4 Fan In', 2], ['Socapex to NL4 Fanout', 2]] },
  { id: 'pkg-v-system', name: 'V-Series hang', department: 'audio', items: [['D&B V Series V8', 8], ['D&B V Series V12', 4], ['D&B V subwoofer', 6], ['D&B D80 Amplifier', 6]] },
  { id: 'pkg-j-system', name: 'J-Series main stage', department: 'audio', items: [['D&B J series J 8', 20], ['D&B J series J12', 4], ['D&B J series Fly Frame', 2], ['D&B J Series J SUB', 16], ['D&B D80 Amplifier', 15], ['LK Fly Loom', 4], ['125 amp audio distro', 2], ['Session Hire Drive Rack', 1], ['Shout system', 2]] },
  { id: 'pkg-wedges-4', name: 'Monitor wedges, 4', department: 'audio', items: [['D&B M4 Stage monitor', 4], ['D&B D40', 1]] },
  { id: 'pkg-wedges-8', name: 'Monitor wedges, 8', department: 'audio', items: [['D&B M4 Stage monitor', 8], ['D&B D40', 2]] },
  { id: 'pkg-iem-6', name: 'In-ears, 6 mixes', department: 'audio', items: [['Sennheiser 2050 dual in ear transmitter', 3], ['Sennheiser 2050 Iem beltpack', 6], ['Sennheiser Helical Antenna', 1]] },
  { id: 'pkg-axient-4', name: 'Axient radio mics, 4', department: 'audio', items: [['Shure Axient Reciver', 1], ['Shure Axient Antenna', 2], ['Shure Axient SM58 H/H', 4]] },
  { id: 'pkg-digico-q225', name: 'DiGiCo Quantum 225 control', department: 'audio', items: [['Digico Quantum 225', 1], ['Digico MQ - Rack', 1], ['Session Hire Drive Rack', 1]] },
  { id: 'pkg-cl5', name: 'Yamaha CL5 control', department: 'audio', items: [['Yamaha CL5', 1], ['Yamaha Rio 64', 1], ['FOH Multicore CAT 6', 1]] },
  { id: 'pkg-pro2-split', name: 'Midas Pro2 with 3-way split', department: 'audio', items: [['Midas pro 2 Mixing console', 1], ['48ch passive 3 way split system', 1], ['Midas Dl 251 stage box', 1]] },
  { id: 'pkg-72-split', name: '72-way split', department: 'audio', items: [['VDC 72 Way 3 WAY Passive Split', 1], ['24 way Veam To male XLR', 6], ['12ch xlr stage box', 12], ['20m 12ch veam cable', 10], ['FOH HMA', 1]] },
  { id: 'pkg-dl32-cat5', name: 'DL32 stage box on Cat5', department: 'audio', items: [['Midas DL 32', 1], ['100m Cat 5 reel', 1]] },
  { id: 'pkg-stage-boxes', name: 'Stage boxes, 2', department: 'audio', items: [['12ch xlr stage box', 2], ['20m 12ch veam cable', 2], ['12 way Veam to male XLR', 2]] },
  { id: 'pkg-mic-di-small', name: 'Mic / DI package, small', department: 'audio', items: [['Shure SM 58', 4], ['DI box, passive', 4]], notes: '4 × mic stand' },
  { id: 'pkg-mic-band', name: 'Mic package, band', department: 'audio', items: [['Shure Beta 52A', 1], ['Shure Beta 91A', 1], ['Shure SM57', 2], ['Sennheiser e904', 3], ['AKG C451 B', 2], ['Shure SM 58', 4], ['DI box, passive', 4], ['DI box, active', 2], ['Mic Stand case 15', 1]] },
  { id: 'pkg-mic-festival', name: 'Festival mic package', department: 'audio', items: [['Shure Beta 52A', 1], ['Shure Beta 91A', 1], ['Shure SM57', 4], ['Sennheiser e904', 4], ['Sennheiser e906', 2], ['AKG C451 B', 2], ['Shure SM 58', 6], ['DI box, passive', 6], ['DI box, active', 4], ['Mic Stand Case 25', 1]] },
  { id: 'pkg-cables-power-s', name: 'Power cables, small', department: 'power', items: [['TRS 3m 16Amp', 2], ['TRS 5m 16amp', 2], ['TRS 10m 16Amp', 2], ['TRS 20m 16Amp', 2], ['16a - 13a Board', 4], ['Adaptor 13a - 16a', 2]] },
  { id: 'pkg-cables-power-l', name: 'Power cables, large', department: 'power', items: [['TRS 3m 16Amp', 6], ['TRS 5m 16amp', 6], ['TRS 10m 16Amp', 8], ['TRS 20m 16Amp', 4], ['16a - 13a Board', 10], ['Adaptor 13a - 16a', 2], ['16amp Y split', 2]] },
  { id: 'pkg-cables-speaker-s', name: 'Speaker cables, small', department: 'audio', items: [['NL4 cable 3M', 2], ['NL4 cable 10M', 2], ['Nl4 cable 20m', 4]] },
  { id: 'pkg-cables-speaker-l', name: 'Speaker cables, large', department: 'audio', items: [['NL4 cable 3M', 4], ['Nl4 cable 5m', 6], ['NL4 cable 10M', 8], ['Nl4 cable 20m', 6], ['NL4 Link  cable 1m', 12]] },
  { id: 'pkg-cables-xlr-s', name: 'XLR cables, small', department: 'audio', items: [['xlr 3m 3 pin', 8], ['xlr 5m 3 pin', 8], ['xlr 10m 3 pin', 10]] },
  { id: 'pkg-cables-xlr-l', name: 'XLR cables, large', department: 'audio', items: [['xlr 3m 3 pin', 30], ['xlr 5m 3 pin', 20], ['xlr 10m 3 pin', 20]] },
  { id: 'pkg-socapex', name: 'Socapex run', department: 'audio', items: [['socapex cable 20m', 2], ['Socapex to NL4 Fan In', 2], ['Socapex to NL4 Fanout', 2]] },
  { id: 'pkg-dmx', name: 'DMX cables', department: 'lighting', items: [['3m 5 pin dmx.', 10], ['5m 5 pin Dmx.', 10], ['dmx 5pin 10m', 6], ['dmx 5pin 20 metre', 6]] },
  { id: 'pkg-decor-lx', name: 'Decor LX', department: 'lighting', items: [['Astera Tube', 24], ['ADJ Battery up lighters', 24], ['Show Tec Helix M1100', 8], ['1M H30V truss', 2], ['H30V 1m base plate', 2]], dayCents: 180000, rate: 'weekly' },
  { id: 'pkg-uplighters', name: 'Uplighters, 16', department: 'lighting', items: [['ADJ Battery up lighters', 16]] },
  { id: 'pkg-front-light', name: 'Front light', department: 'lighting', items: [['arri 1k fresnel', 2]], notes: 'with single-channel dimmers' },
  { id: 'pkg-movers', name: 'Moving heads, Lyra and Spider', department: 'lighting', items: [['Acme Lyra Moving Head', 4], ['Robe spider', 12], ['Unique Haze 2', 1]] },
  { id: 'pkg-stage-6', name: 'Stage, 6 decks', department: 'staging', items: [['Pro Lyte Stage Deck', 6], ['Stage Steps', 1]], notes: 'with legs to the height asked' },
  { id: 'pkg-truss-towers-4', name: 'Truss towers, 4', department: 'rigging', items: [['2M H30V truss', 4], ['H30V 1m base plate', 4]] },
  { id: 'pkg-motors-4', name: 'Motors, 4 with controller', department: 'rigging', items: [['1 Tonne CM motor', 4], ['LV12 ch motor control', 1]] },
  { id: 'pkg-led-wall', name: 'LED wall, Absen 3.9', department: 'video', items: [['Absen NT 3.9', 128], ['Nova star pro HD video processor', 2], ['3M H30V Truss', 8], ['SES 63a Distro', 1]] },
]

type Known = Pick<Model, 'id' | 'name'> & { aliases?: readonly string[] }

const key = (name: string) => kitKey(name).replace(/ /g, '')

export interface StarterPlan {
  /** Products to add to the stock list first, with no count. */
  products: StarterProduct[]
  /** Packages to save, their products found. */
  packages: Pick<Package, 'id' | 'name' | 'department' | 'dayCents' | 'rate' | 'items' | 'notes'>[]
  /** Packages left out because a product they hold isn't on the stock list, with the names not found. */
  waiting: { name: string; missing: string[] }[]
  /** Packages already on the price list, by their fixed id, left as they are. */
  already: number
}

/**
 * What adding the starter packages would do: the stock list's products found by name or another name (capitals,
 * spaces and dashes not counting), the mic and DI products it lacks added, and any package already there left alone.
 */
export function starterPlan(models: readonly Known[], packageIds: Iterable<string>): StarterPlan {
  // Another name it goes by counts too (ADR 0070), so a product renamed since can be found by its old one.
  const byName = new Map(models.flatMap((m) => (m.aliases ?? []).map((a) => [key(a), m.id] as const)))
  for (const m of models) byName.set(key(m.name), m.id)
  const products = STARTER_PRODUCTS.filter((p) => !byName.has(key(p.name)))
  for (const p of products) byName.set(key(p.name), p.id)
  const have = new Set(packageIds)
  const plan: StarterPlan = { products: [], packages: [], waiting: [], already: 0 }
  const used = new Set<string>()
  for (const s of STARTER_PACKAGES) {
    if (have.has(s.id)) {
      plan.already++
      continue
    }
    const missing = s.items.filter(([name]) => !byName.has(key(name))).map(([name]) => name)
    if (missing.length) {
      plan.waiting.push({ name: s.name, missing })
      continue
    }
    const items = s.items.map(([name, qty]) => ({ modelId: byName.get(key(name))!, qty }))
    for (const i of items) used.add(i.modelId)
    plan.packages.push({ id: s.id, name: s.name, department: s.department, dayCents: s.dayCents ?? 0, rate: s.rate ?? 'daily', items, notes: s.notes ?? '' })
  }
  plan.products = products.filter((p) => used.has(p.id))
  return plan
}
