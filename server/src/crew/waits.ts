import type { Db } from '../db.ts'

/**
 * An offer made by Offer sends nothing for OFFER_WAIT_SECONDS (ADR 0161; audit of 12 November 2026, finding 13), so the
 * office can take a wrong pick back with Undo before an invite or a WhatsApp reaches anyone. The calendar and WhatsApp
 * leave it out until then; this wakes them as the soonest wait ends, since nothing else would until their next look. It
 * looks again after each change and at start-up, so a wait that a restart cut across still ends with what it held going.
 */
export class OfferWaits {
  private timer: NodeJS.Timeout | undefined
  private stopped = false

  constructor(
    private readonly db: Db,
    /** The waits that ended: send what they held. */
    private readonly ended: () => void,
    private readonly report?: (err: unknown) => void
  ) {}

  /** Wakes the senders as the soonest wait still running ends. Measured by the database's clock, which set it. */
  async watch(): Promise<void> {
    if (this.stopped) return
    let left: number | undefined
    try {
      const { rows } = await this.db.query<{ left: number | string | null }>(`SELECT extract(epoch FROM min(goes_at) - now()) * 1000 AS left FROM offers WHERE goes_at > now()`)
      const ms = rows[0]?.left
      left = ms === null || ms === undefined ? undefined : Number(ms)
    } catch (err) {
      // Closing down, or the database hiccuping: the senders' own looks pick up what waited, a little later.
      if (!this.stopped) this.report?.(err)
      return
    }
    clearTimeout(this.timer)
    this.timer = undefined
    if (left === undefined || this.stopped) return
    // A moment past the end, so the senders' own reads find it over.
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.ended()
      void this.watch()
    }, Math.ceil(left) + 250)
    this.timer.unref()
  }

  stop() {
    this.stopped = true
    clearTimeout(this.timer)
  }
}
