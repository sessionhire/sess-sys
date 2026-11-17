/**
 * Meta's WhatsApp Cloud API (ADR 0125), straight to Meta with no provider in between: the number's state, and, from
 * part 2, sending an offer's template. Everything it is given comes from Railway: the token of a system user in Session
 * Hire's Meta business account, the WhatsApp number's id, the app's secret (to check that what Meta posts back is
 * Meta's) and the word Meta echoes when the web address is registered. Part 3 adds the short answers sent back when
 * someone presses a button or writes.
 */

export interface WhatsAppConfig {
  /** A permanent system user's token, with whatsapp_business_messaging (WHATSAPP_TOKEN). */
  token: string
  /** The id Meta gives the WhatsApp number, not the number itself (WHATSAPP_PHONE_NUMBER_ID). */
  phoneNumberId: string
  /** The Meta app's secret, for the signature on what Meta posts back (WHATSAPP_APP_SECRET). */
  appSecret?: string
  /** What Meta echoes when the web address it posts to is registered (WHATSAPP_VERIFY_TOKEN). */
  verifyToken?: string
  /** Meta's Graph API with its version, or a stand-in in tests (WHATSAPP_API_URL). */
  apiUrl: string
  /** The language the templates were approved in (WHATSAPP_LANGUAGE): en_GB unless said. */
  language: string
  /** Stands in for the network in tests. */
  fetch?: typeof fetch
}

/** A template's blanks and buttons as Meta's Cloud API takes them. */
export type TemplateComponent =
  | { type: 'body'; parameters: { type: 'text'; text: string }[] }
  | { type: 'button'; sub_type: 'quick_reply'; index: string; parameters: { type: 'payload'; payload: string }[] }
  | { type: 'button'; sub_type: 'url'; index: string; parameters: { type: 'text'; text: string }[] }

export const GRAPH_API = 'https://graph.facebook.com/v23.0'

/** Meta turned a request down, in Meta's words. */
export class WhatsAppRefused extends Error {
  override name = 'WhatsAppRefused'
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number
  ) {
    super(message)
  }
}

/** The WhatsApp number as Meta has it: what it shows people, the name Meta approved, and how well its messages are taken. */
export interface WhatsAppNumber {
  number: string
  name: string
  /** GREEN, YELLOW or RED; UNKNOWN on a number with nothing sent yet. */
  quality: string
  /** Whether Meta has approved the display name: APPROVED, PENDING_REVIEW, DECLINED and the like. */
  nameStatus: string
}

/**
 * Reads what's set in Railway, or nothing when it isn't (so Admin says it isn't set up). The token and the number's id
 * are enough to read the number; sending and answers need the rest, and say so.
 */
export function whatsappConfig(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig | undefined {
  const token = env.WHATSAPP_TOKEN?.trim()
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!token || !phoneNumberId) return undefined
  return {
    token,
    phoneNumberId,
    appSecret: env.WHATSAPP_APP_SECRET?.trim() || undefined,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN?.trim() || undefined,
    apiUrl: (env.WHATSAPP_API_URL?.trim() || GRAPH_API).replace(/\/+$/, ''),
    language: env.WHATSAPP_LANGUAGE?.trim() || 'en_GB',
  }
}

export class WhatsAppApi {
  private readonly call: typeof fetch

  constructor(readonly config: WhatsAppConfig) {
    this.call = config.fetch ?? fetch
  }

  /** The number's state, read without sending anything. */
  async number(): Promise<WhatsAppNumber> {
    const fields = 'display_phone_number,verified_name,quality_rating,name_status'
    const r = await this.request<{ display_phone_number?: string; verified_name?: string; quality_rating?: string; name_status?: string }>(
      'GET',
      `${encodeURIComponent(this.config.phoneNumberId)}?fields=${fields}`
    )
    return { number: r.display_phone_number ?? '', name: r.verified_name ?? '', quality: r.quality_rating ?? 'UNKNOWN', nameStatus: r.name_status ?? '' }
  }

  /**
   * Sends an approved template to a number, with its blanks and buttons filled in, and answers Meta's id for the
   * message, which its receipts and any answer to it carry.
   */
  async sendTemplate(to: string, name: string, components: TemplateComponent[]): Promise<string> {
    const r = await this.request<{ messages?: { id: string }[] }>('POST', `${encodeURIComponent(this.config.phoneNumberId)}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: { name, language: { code: this.config.language }, components },
    })
    const id = r.messages?.[0]?.id
    if (!id) throw new WhatsAppRefused('Meta took the message but gave no id for it.', 200)
    return id
  }

  /**
   * A plain message, in answer to one of theirs: free and allowed for a day after they last wrote or pressed a button
   * (Meta's service window), which every answer here is.
   */
  async sendText(to: string, body: string): Promise<string> {
    return this.message(to, { type: 'text', text: { body, preview_url: false } })
  }

  /** A question with up to three buttons, each carrying its own id back, also only inside the service window. */
  async sendButtons(to: string, body: string, buttons: { id: string; title: string }[]): Promise<string> {
    return this.message(to, {
      type: 'interactive',
      interactive: { type: 'button', body: { text: body }, action: { buttons: buttons.map((b) => ({ type: 'reply', reply: b })) } },
    })
  }

  private async message(to: string, content: object): Promise<string> {
    const r = await this.request<{ messages?: { id: string }[] }>('POST', `${encodeURIComponent(this.config.phoneNumberId)}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      ...content,
    })
    const id = r.messages?.[0]?.id
    if (!id) throw new WhatsAppRefused('Meta took the message but gave no id for it.', 200)
    return id
  }

  protected async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await this.call(`${this.config.apiUrl}/${path}`, {
      method,
      headers: { authorization: `Bearer ${this.config.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    })
    const text = await res.text()
    let data: any
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) {
      const e = data?.error
      throw new WhatsAppRefused(e?.error_user_msg || e?.message || `Meta answered ${res.status}.`, res.status, typeof e?.code === 'number' ? e.code : undefined)
    }
    return data as T
  }
}
