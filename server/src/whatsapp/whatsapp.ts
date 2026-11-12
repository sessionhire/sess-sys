import { whatsappReach, type Person, type WhatsAppStatus } from '@sh/shared'
import type { Queryable } from '../db.ts'
import { whatsappSetting } from '../office/store.ts'
import { WhatsAppApi, type WhatsAppConfig, type WhatsAppNumber } from './api.ts'

/** How long what Meta says of the number is kept before asking again: Admin and Status read it often. */
const KEEP_MS = 5 * 60_000

/**
 * Offers on WhatsApp (ADR 0125), as the rest of the server asks about it: whether it's set up, what Meta says of the
 * number, and whether a person is to get offers there.
 */
export class WhatsApp {
  readonly api: WhatsAppApi | undefined
  private kept: { at: number; number?: WhatsAppNumber; problem?: string } | undefined

  constructor(readonly config: WhatsAppConfig | undefined) {
    this.api = config && new WhatsAppApi(config)
  }

  get configured() {
    return !!this.api
  }

  /** The number as Meta has it, read at most every five minutes, or why it couldn't be. */
  async number(again = false): Promise<{ number?: WhatsAppNumber; problem?: string }> {
    if (!this.api) return {}
    if (!again && this.kept && Date.now() - this.kept.at < KEEP_MS) return this.kept
    try {
      this.kept = { at: Date.now(), number: await this.api.number() }
    } catch (err) {
      this.kept = { at: Date.now(), problem: err instanceof Error ? err.message : String(err) }
    }
    return this.kept
  }

  async status(origin: string): Promise<WhatsAppStatus> {
    const missing = this.config ? [...(this.config.appSecret ? [] : ['WHATSAPP_APP_SECRET']), ...(this.config.verifyToken ? [] : ['WHATSAPP_VERIFY_TOKEN'])] : []
    const base: WhatsAppStatus = { configured: this.configured, missing, hook: `${origin}/whatsapp/hook` }
    if (!this.configured) return base
    const { number, problem } = await this.number()
    return { ...base, ...(number ? { number: number.number, name: number.name, quality: number.quality, nameStatus: number.nameStatus } : {}), ...(problem ? { problem } : {}) }
  }

  /**
   * The number a person's offers go to on WhatsApp, or undefined when they don't: it isn't set up, it's off, they turned
   * it off, they have no mobile WhatsApp can take, or, in test mode, theirs isn't one of the numbers to try it on.
   */
  async reach(q: Queryable, person: Pick<Person, 'phone' | 'whatsappOff' | 'archived'>): Promise<string | undefined> {
    if (!this.configured || person.whatsappOff || person.archived) return undefined
    return reachOf(await whatsappSetting(q), person)
  }
}

/**
 * The rule itself, without the database: the mode and the test numbers, and the person. It's the one a device reads
 * too (shared/src/reach.ts), so what the Offer form says will go on WhatsApp is what goes.
 */
export const reachOf = whatsappReach
