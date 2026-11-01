import { describe, expect, it } from 'vitest'
import { decodeEntities, joinLines, textOfHtml } from '../src/html-text.ts'
import { readAaPage } from '../src/finance/fuel.ts'
import { plainText, tidy } from '../src/calendar/import-titles.ts'

/**
 * Reading HTML as text, tag by tag (html-text.ts), for emails, job sheets
 * and the AA's survey page: never patched with patterns, so nothing that
 * looks like a tag comes back out, and entities are decoded once.
 */

const spaces = () => ' '

describe('HTML read as text', () => {
  it('leaves nothing of a tag that came apart or hid inside another', () => {
    expect(textOfHtml('a<scr<script>ipt>alert(1)</script>b', spaces)).toBe('a ipt>alert(1) b')
    expect(textOfHtml('<script>if (a < b) { x() }</script>after', spaces)).toBe('after')
    expect(textOfHtml('<style>p { color: red }</STYLE >after', spaces)).toBe('after')
    expect(textOfHtml('<p>kept</p><script>never closed', spaces)).toBe(' kept ')
  })

  it('skips a comment whole, even one with ">" in it, and keeps a "<" that starts no tag', () => {
    expect(textOfHtml('a<!-- b > c -->d', spaces)).toBe('ad')
    expect(textOfHtml('3 < 4 and 5 > 2', spaces)).toBe('3 < 4 and 5 > 2')
  })

  it('decodes entities once, in one pass, and leaves what it does not know', () => {
    expect(decodeEntities('Fish &amp;amp; chips, 3 &lt; 4 &#8211; &#x2013; &copy;')).toBe('Fish &amp; chips, 3 < 4 – – &copy;')
    // Past the last character there is: left as it was, rather than throwing.
    expect(decodeEntities('&#99999999; &#x110000;')).toBe('&#99999999; &#x110000;')
  })

  it('tidies lines: no space at their ends, one blank line at most', () => {
    expect(joinLines(['', 'a  ', '', '', '  ', 'b', '', ''])).toBe('a\n\nb')
  })

  it('reads a job sheet and the AA page as before', () => {
    expect(plainText('<p>Gate 3</p><script>x()</script><ul><li>Desk</li></ul>&#99999999;')).toBe('Gate 3\n\n- Desk\n\n&#99999999;')
    expect(readAaPage('<h2>Irish Fuel Prices: October 2026</h2><script>var t = "<td>1c</td>"</script><table><tr><td>Petrol</td><td>Diesel</td></tr><tr><td>Pump price</td><td>198.16c</td><td>214.76&#99;</td></tr></table>')?.centsPerLitre).toBe(214.8)
  })

  it('tidies a job’s name in a straight line, however many marks it has (code scanning)', () => {
    expect(tidy(' - Nissan Build - ')).toBe('Nissan Build')
    expect(tidy('Gala & ')).toBe('Gala')
    const started = performance.now()
    expect(tidy('a' + '-'.repeat(100_000) + 'b')).toBe('a' + '-'.repeat(100_000) + 'b')
    expect(performance.now() - started).toBeLessThan(500)
  })
})
