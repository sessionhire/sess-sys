/**
 * The label printer over the internet (ADR 0191): the Zebra ZT411 connects
 * out to the app itself with Zebra's WebLink, and the server sends it the
 * labels, so any device signed in can print, a phone too. What the server
 * says of it, and how the printer's own status reads in words.
 */

/** Where the printer connects, under the app's address. Ends in a slash, as Zebra asks. */
export const WEBLINK_PATH = '/api/printer/weblink/'

/** The user name the printer gives with its password: only the password is secret. */
export const WEBLINK_USER = 'zt411'

/** Something stopping the printer: it won't print until it's put right. */
export type PrinterProblem = 'mediaOut' | 'ribbonOut' | 'headOpen' | 'cutter' | 'headTooHot' | 'motorTooHot' | 'headFault' | 'paused' | 'other'
/** Something to see to soon: it still prints. */
export type PrinterWarning = 'mediaLow' | 'calibrate' | 'cleanHead' | 'replaceHead'

export interface PrinterStatus {
  /** Nothing stopping it: labels sent now print now. */
  ready: boolean
  problems: PrinterProblem[]
  warnings: PrinterWarning[]
  /** When the printer last said, as an ISO time. */
  at: string
}

/** What Admin and the Print buttons are told: never the password. */
export interface PrinterState {
  /** Admin › Connections › Label printer: whether the printer may connect at all. */
  on: boolean
  /** A password has been made for a printer, so one can connect. */
  paired: boolean
  /** Where the printer is set to connect, from the app's own address (PUBLIC_URL). */
  address: string
  /** The app's address when the setup file was made; a different one now means the printer needs a new file. */
  pairedAddress?: string
  /** The printer's serial number, once it has connected; no other printer is let in after. */
  serial?: string
  /** The name it calls itself (device.friendly_name). */
  name?: string
  /** Connected now. */
  connected: boolean
  /** When it was last heard from, as an ISO time. */
  lastSeen?: string
  /** How it said it was, last it was asked; only while connected. */
  status?: PrinterStatus
}

/** The setup file, made once with a new password: the password isn't kept anywhere it can be read back. */
export interface PrinterSetup {
  /** Settings and the certificate in one file, sent to the printer as it is. */
  file: string
  /** The certificate on its own, for the printer's web page or Zebra's tools if the file's own copy doesn't take. */
  certificate?: string
  /** Why there's no certificate, when there isn't. */
  noCertificate?: string
  state: PrinterState
}

const hex = (s: string | undefined) => {
  const n = Number.parseInt((s ?? '').replace(/[^0-9a-f]/gi, '') || '0', 16)
  return Number.isFinite(n) ? n : 0
}

/**
 * The printer's own account of itself, `zpl.system_status` (as ~HQES): seven
 * fields, "flag, error flag, errors group 2, errors group 1, warning flag,
 * warnings group 2, warnings group 1", each perhaps in quotes. The first flag
 * is set while it's paused. Group 1's bits are the ones a ZT411 uses.
 */
export function readSystemStatus(value: string, at: Date = new Date()): PrinterStatus {
  const f = value.split(',').map((s) => s.replace(/["\s]/g, ''))
  const problems: PrinterProblem[] = []
  const errors = hex(f[3])
  const add = (bit: number, p: PrinterProblem) => errors & bit && problems.push(p)
  add(0x1, 'mediaOut')
  add(0x2, 'ribbonOut')
  add(0x4, 'headOpen')
  add(0x8, 'cutter')
  add(0x10, 'headTooHot')
  add(0x20, 'motorTooHot')
  // A bad dot, a head not found, its firmware's set-up wrong, or its thermistor open: all a look at the head.
  if (errors & 0x3c0) problems.push('headFault')
  // The error flag with none of those: something the printer's own screen will name.
  if (f[1] === '1' && problems.length === 0) problems.push('other')
  if (f[0] === '1') problems.push('paused')
  const warnings: PrinterWarning[] = []
  const w = hex(f[6])
  if (w & 0x8) warnings.push('mediaLow')
  if (w & 0x1) warnings.push('calibrate')
  if (w & 0x2) warnings.push('cleanHead')
  if (w & 0x4) warnings.push('replaceHead')
  return { ready: problems.length === 0, problems, warnings, at: at.toISOString() }
}

const PROBLEM_WORDS: Record<PrinterProblem, string> = {
  mediaOut: 'Out of labels',
  ribbonOut: 'Out of ribbon',
  headOpen: 'Head open',
  cutter: 'Cutter jammed',
  headTooHot: 'Head too hot',
  motorTooHot: 'Motor too hot',
  headFault: 'Print head fault',
  paused: 'Paused',
  other: 'Needs a look',
}

const WARNING_WORDS: Record<PrinterWarning, string> = {
  mediaLow: 'labels running low',
  calibrate: 'wants calibrating',
  cleanHead: 'clean the print head',
  replaceHead: 'print head worn out',
}

/** What to do about each, in a line. */
const PROBLEM_HELP: Record<PrinterProblem, string> = {
  mediaOut: 'Load a new roll of labels.',
  ribbonOut: 'Load a new ribbon.',
  headOpen: 'Close the print head.',
  cutter: 'Clear the cutter.',
  headTooHot: 'Let it cool down; it carries on by itself.',
  motorTooHot: 'Let it cool down; it carries on by itself.',
  headFault: 'Check the print head; its screen says more.',
  paused: 'Press Pause on the printer to carry on.',
  other: 'Its screen says what.',
}

/** The pill beside Print, and the line under it. Healthy is quiet: "Ready" and nothing more. */
export function printerWords(state: Pick<PrinterState, 'on' | 'paired' | 'connected' | 'status'>): { tone: 'confirmed' | 'pending' | 'bad' | 'cancelled'; pill: string; help?: string } {
  if (!state.on || !state.paired) return { tone: 'cancelled', pill: 'Not set up' }
  if (!state.connected) return { tone: 'cancelled', pill: 'Not connected', help: 'Check the ZT411 is on and online: it connects again by itself within a minute.' }
  const s = state.status
  if (!s) return { tone: 'pending', pill: 'Connected', help: 'Asking how it is…' }
  if (s.problems.length > 0) {
    const first = s.problems[0]!
    return {
      tone: 'bad',
      pill: s.problems.map((p) => PROBLEM_WORDS[p]).join(', '),
      help: `${PROBLEM_HELP[first]} Labels sent now wait in the printer and print once it's put right.`,
    }
  }
  if (s.warnings.length > 0) {
    const words = s.warnings.map((w) => WARNING_WORDS[w]).join(', ')
    return { tone: 'pending', pill: 'Ready', help: `${words.charAt(0).toUpperCase()}${words.slice(1)}.` }
  }
  return { tone: 'confirmed', pill: 'Ready' }
}
