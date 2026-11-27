import Anthropic from '@anthropic-ai/sdk'

/**
 * Asking Claude (ADR 0096), through Anthropic's API, for an answer in a
 * JSON schema. Only this file talks to Anthropic; the routes are given an
 * `Ask` so tests stand in for it without the network.
 */

export interface Asked {
  system: string
  /** What's sent as the person's turn: the enquiry or the quote and what was asked. */
  user: string
  schema: Record<string, unknown>
  maxTokens: number
  /** Photos sent before the words, read as Claude reads any picture (ADR 0203). */
  images?: { type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }[]
  /** How many web searches it may make (ADR 0203); none when left out. */
  searches?: number
  /** The system prompt is the same from one ask to the next, so it's kept at Anthropic for the next, at a tenth of the price. */
  cacheSystem?: boolean
}

export interface Answer {
  /** The answer as JSON, read but not yet checked. */
  json: unknown
  model: string
  inputTokens: number
  outputTokens: number
  /** Web searches it made, each paid for on top of the words. */
  searches?: number
}

export type Ask = (a: Asked) => Promise<Answer>

/** Claude couldn't give an answer, with a reason for the office. What it cost is counted all the same. */
export class NoAnswer extends Error {
  override name = 'NoAnswer'
  constructor(
    message: string,
    readonly used?: Omit<Answer, 'json'>
  ) {
    super(message)
  }
}

export interface ClaudeConfig {
  apiKey: string
  model: string
  /** What it may spend in a month, in US cents. */
  limitCents: number
  /** Stands in for Anthropic in tests. */
  ask?: Ask
}

/** Anthropic's API, asked once with a retry or two for a busy moment; a minute and a half at most. */
export function anthropicAsk(apiKey: string, model: string): Ask {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 })
  return async ({ system, user, schema, maxTokens, images, searches, cacheSystem }) => {
    // Words alone go as they always did; photos go first, then the words.
    const content: string | Anthropic.ContentBlockParam[] = images?.length
      ? [...images.map((i): Anthropic.ImageBlockParam => ({ type: 'image', source: { type: 'base64', media_type: i.type, data: i.data } })), { type: 'text', text: user }]
      : user
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content }]
    const tools: Anthropic.ToolUnion[] = searches ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: searches }] : []
    const used = { model, inputTokens: 0, outputTokens: 0, searches: 0 }
    let res: Anthropic.Message
    // A turn with searches can pause part way (pause_turn): it's sent back as it is to carry on, a few times at most.
    for (let turn = 0; ; turn++) {
      res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: cacheSystem ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : system,
        messages,
        ...(tools.length ? { tools } : {}),
        // Low effort: reading an enquiry into lines is quick work, and the office is waiting on the screen.
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      })
      used.model = res.model
      used.inputTokens += res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0)
      used.outputTokens += res.usage.output_tokens
      used.searches += res.usage.server_tool_use?.web_search_requests ?? 0
      if (res.stop_reason !== 'pause_turn' || turn >= 3) break
      messages.push({ role: 'assistant', content: res.content })
    }
    if (res.stop_reason === 'refusal') throw new NoAnswer('Claude wouldn’t answer that one.', used)
    if (res.stop_reason === 'max_tokens') throw new NoAnswer('Claude’s answer was too long to finish. Try a shorter enquiry, or part of it.', used)
    if (res.stop_reason === 'pause_turn') throw new NoAnswer('Claude took too long looking it up. Try again.', used)
    // With searches, the answer is the last text: what comes before it is Claude saying what it's looking for.
    const texts = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : []))
    const text = searches ? (texts.at(-1) ?? '') : texts.join('')
    try {
      return { ...used, json: JSON.parse(text) }
    } catch {
      throw new NoAnswer('Claude’s answer couldn’t be read. Try again.', used)
    }
  }
}
