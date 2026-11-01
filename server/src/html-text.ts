/**
 * The words of some HTML, for the places the server is handed markup it only
 * wants the text of: an email with no plain part (ADR 0098), a job sheet
 * Google kept as HTML (ADR 0011) and the AA's fuel survey page (ADR 0086).
 *
 * It reads tag by tag rather than patching the markup with patterns, which
 * can't be got right: a pattern that takes out "<script>" leaves
 * "<scr<script>ipt>" behind, and one that takes out tags can still leave a
 * tag that came apart. What's outside a tag is text, what's inside style or
 * script is not, a comment is skipped whole, and the caller says what each
 * tag stands for. Entities are decoded afterwards, once, so "&amp;lt;" stays
 * "&lt;". What comes out is only ever used as text, never as HTML.
 */

/** Tags whose contents are never text. */
const HIDDEN = new Set(['style', 'script', 'head', 'title'])

/** What a tag stands for in the text: a line's end, a space, a bullet, or nothing. */
export type TagAs = (name: string, closing: boolean) => string

/** The text of `html`, each tag swapped for what `tagAs` says, entities still as they were. */
export function textOfHtml(html: string, tagAs: TagAs): string {
  let out = ''
  let at = 0
  while (at < html.length) {
    const open = html.indexOf('<', at)
    if (open < 0) {
      out += html.slice(at)
      break
    }
    out += html.slice(at, open)
    // "<" not followed by a name, "/", "!" or "?" isn't a tag ("3 < 4"): it's a character.
    if (!/[a-z/!?]/i.test(html.charAt(open + 1))) {
      out += '<'
      at = open + 1
      continue
    }
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4)
      if (end < 0) break // a comment never closed: nothing after it is text
      at = end + 3
      continue
    }
    const close = html.indexOf('>', open + 1)
    if (close < 0) break // a tag never finished: nothing after it is text
    const tag = html.slice(open + 1, close)
    const closing = tag.startsWith('/')
    const name = /^\/?\s*([a-z][a-z0-9]*)/i.exec(tag)?.[1]?.toLowerCase() ?? ''
    at = close + 1
    if (!closing && HIDDEN.has(name)) {
      // Inside style or script, "<" is just a character: skip to the tag that closes it.
      const ends = new RegExp(`</${name}\\b[^>]*>`, 'ig')
      ends.lastIndex = at
      const end = ends.exec(html)
      if (!end) break
      at = end.index + end[0].length
      continue
    }
    out += tagAs(name, closing)
  }
  return out
}

const NAMED: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** "&amp;", "&#8211;" and the rest decoded in one pass, so "&amp;lt;" is "&lt;" and never "<". Names it doesn't know stay as they are. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, e: string) => {
    if (e[0] !== '#') return NAMED[e.toLowerCase()] ?? whole
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    // Beyond the last character there is, String.fromCodePoint would throw.
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}

/** Lines as text again: none ending in spaces, never more than one blank line in a row, none at the start or end. */
export function joinLines(lines: readonly string[]): string {
  const kept: string[] = []
  for (const line of lines) {
    const l = line.trimEnd()
    if (l === '' && (kept.length === 0 || kept[kept.length - 1] === '')) continue
    kept.push(l)
  }
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop()
  return kept.join('\n').trim()
}
