import { dsSpace, dsText, LOGO_SVG, TRADES_AS, TRADES_AS_LABELS, APPLICATION_ABOUT_LENGTH, APPLICATION_BASED_LENGTH, APPLICATION_SKILLS_LENGTH, type ApplyField, type ApplyForm, type OfficeDetails } from '@sh/shared'
import { CONTROL, CSS, dialSelect, fieldError, h, invalid, officeBlock } from '../crew/page.ts'

/**
 * The public Apply page (ADR 0190): someone who'd like work with us says who they are, what they do and how to reach
 * them. Plain HTML with an ordinary form, as a freelancer's page is (ADR 0002), so it works in any phone's browser and
 * inside WhatsApp or Instagram, with no app, no sign-in and no script. One job: send an application. Nothing is sent
 * back to them (ADR 0048): the thank-you page says the office will be in touch.
 */

const head = (title: string, heading: string, small?: string) => `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${h(title)}</title><style>${CSS}${JOIN_CSS}</style></head>
<body><main><header class="top"><span class="mark">${LOGO_SVG}</span><div><b>Session Hire</b><h1>${heading}</h1>${small ? `<small>${small}</small>` : ''}</div></header>`
const foot = '</main></body></html>'

/** The field a bot fills and a person never sees: off the page, out of the tab order, and named so no browser fills it. */
const JOIN_CSS = `.trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}fieldset.choice.agree label{align-items:flex-start}fieldset.choice input{flex:none}
.pills{display:flex;flex-wrap:wrap;align-items:center;gap:${dsSpace[1]}px;min-height:${CONTROL};padding:${dsSpace[1]}px;border-radius:8px;border:1px solid var(--field-line);background:var(--bg);cursor:text}
.pills:focus-within{outline:2px solid var(--accent);outline-offset:2px}.pills input{flex:1 1 8em;min-height:34px;border:0;padding:${dsSpace[1]}px ${dsSpace[2]}px;background:transparent}.pills input:focus-visible{outline:none}
.pills ul{display:contents;list-style:none;margin:0;padding:0}.pill{display:inline-flex;align-items:center;padding-inline-start:${dsSpace[3]}px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--ink);font-size:${dsText.touch.caption.size}px}
.pill button{display:grid;place-items:center;width:34px;height:34px;min-height:0;padding:0;border:0;border-radius:999px;background:transparent;color:var(--muted);font-size:18px;line-height:1}
.pills-anchor{position:relative}.offers{position:absolute;z-index:2;left:0;right:0;top:calc(100% + ${dsSpace[1]}px);margin:0;padding:${dsSpace[1]}px;list-style:none;max-height:${dsSpace[16] * 4}px;overflow-y:auto;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgb(0 0 0 / .18)}
.offers li{padding:${dsSpace[2]}px ${dsSpace[3]}px;min-height:${CONTROL};display:flex;align-items:center;border-radius:6px;cursor:pointer}.offers li[aria-selected=true]{background:var(--wash-hover);outline:2px solid var(--accent);outline-offset:-2px}.offers[hidden]{display:none}
fieldset.pay{display:grid;gap:${dsSpace[4]}px;margin:0;padding:${dsSpace[4]}px;border:1px solid var(--line);border-radius:12px}fieldset.pay legend{font-weight:700;padding:0 ${dsSpace[1]}px}
textarea{min-height:${dsSpace[8] * 4}px;resize:vertical}form.apply{display:grid;gap:${dsSpace[4]}px}form.apply .pair{display:grid;gap:${dsSpace[4]}px;grid-template-columns:repeat(auto-fit,minmax(${dsSpace[16] * 3}px,1fr))}`

/** Where the page stands. */
export type JoinState = 'ask' | 'thanks' | 'off' | 'full'

const LABELS: Record<ApplyField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Mobile',
  country: 'Country code',
  skills: 'What you do',
  rate: 'Your usual day rate (optional)',
  tradesAs: 'How you work (optional)',
  basedIn: 'Where you’re based (optional)',
  about: 'Your experience (optional)',
  ppsn: 'PPS number',
  vatNumber: 'VAT number, if you’re registered',
  accountName: 'Name on the account',
  iban: 'IBAN',
  bic: 'BIC (optional)',
  agree: 'Keeping your details',
}

const ORDER: ApplyField[] = ['firstName', 'lastName', 'email', 'phone', 'skills', 'rate', 'tradesAs', 'basedIn', 'about', 'ppsn', 'vatNumber', 'accountName', 'iban', 'bic', 'agree']

/** Each field's error, under it, and a list of them at the top that links to each (GOV.UK's error summary). */
export function renderJoin(d: {
  state: JoinState
  office?: OfficeDetails | null
  typed?: Partial<ApplyForm>
  errors?: Partial<Record<ApplyField, string>>
  issued?: string
  /** The roles offered as they type (rolesForApplicants): the trade's usual ones, the price list's and those quoted in Current RMS. */
  roles?: readonly string[]
  /** Whether to ask for payment details: only while the server can lock them (ADR 0193). */
  payment?: boolean
  /** Whether they'll be emailed when the office decides (ADR 0193), which the page says before they send it. */
  emails?: boolean
}): string {
  const title = 'Apply to join our crew'
  if (d.state === 'off')
    return `${head(title, title)}
<p>We're not taking applications here just now. Get in touch with the office if you'd like work with us.</p>${officeBlock(d.office)}${foot}`
  if (d.state === 'full')
    return `${head(title, title)}
<p class="flash warn" role="status">We have more applications than we can read just now. Please try again in a few weeks, or get in touch with the office.</p>${officeBlock(d.office)}${foot}`
  if (d.state === 'thanks')
    return `${head('Thanks for applying', 'Thanks for applying')}
<p class="flash ok" role="status">We've got your details.</p>
<p>${
      d.emails
        ? "Someone from the office will read your application, and we'll email you either way once we have: with your own page if we add you to our crew list."
        : 'Someone from the office will read your application and be in touch if we have work that suits you.'
    } You don't need to send it again; if something changes, send it again with the same email and we'll keep the newer one.</p>${officeBlock(d.office)}${foot}`

  const t = d.typed ?? {}
  const e = d.errors ?? {}
  const wrong = ORDER.filter((f) => e[f])
  const err = (f: ApplyField) => (e[f] ? fieldError(`${f}-error`, e[f]!) : '')
  const bad = (f: ApplyField, hint?: string) => (e[f] ? invalid(`${f}-error`, hint) : hint ? ` aria-describedby="${hint}"` : '')
  const first = wrong[0]
  const focus = (f: ApplyField) => (f === first ? ' autofocus' : '')
  const input = (f: ApplyField, attrs: string) =>
    `<div class="field"><label for="${f}">${h(LABELS[f])}</label><input id="${f}" name="${f}" ${attrs} value="${h(t[f] ?? '')}"${bad(f)}${focus(f)}></div>${err(f)}`
  const radios = (f: 'tradesAs', options: readonly (readonly [string, string])[]) =>
    `<fieldset class="choice" id="${f}"${e[f] ? ` aria-describedby="${f}-error"` : ''}><legend>${h(LABELS[f])}</legend>${options
      .map(([value, label]) => `<label><input type="radio" name="${f}" value="${h(value)}"${(t[f] ?? '') === value ? ' checked' : ''}> ${h(label)}</label>`)
      .join('')}</fieldset>${err(f)}`

  const summary = wrong.length
    ? `<div class="flash bad" role="alert"><p><b>${wrong.length === 1 ? 'One thing to fix' : `${wrong.length} things to fix`} before it can go</b></p><ul>${wrong
        .map((f) => `<li><a href="#${f}">${h(e[f])}</a></li>`)
        .join('')}</ul></div>`
    : ''

  return `${head(wrong.length ? `Error: ${title}` : title, title)}
<p>Tell us who you are and what you do, and the office will be in touch when we have work that suits you. It takes about five minutes.</p>
${summary}
<form method="post" action="/join" class="apply" novalidate>
  <input type="hidden" name="t" value="${h(d.issued ?? '')}">
  <div class="trap" aria-hidden="true"><label for="website">Leave this empty</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
  <div class="pair"><div>${input('firstName', 'autocomplete="given-name" maxlength="100" required')}</div><div>${input('lastName', 'autocomplete="family-name" maxlength="100" required')}</div></div>
  ${
    d.emails
      ? `<div class="field"><label for="email">${h(LABELS.email)}</label><p class="hint" id="email-hint">We'll email you here once we've read your application, with a link to your own page if we add you to our crew list.</p>
    <input id="email" name="email" type="email" autocomplete="email" maxlength="200" required value="${h(t.email ?? '')}"${bad('email', 'email-hint')}${focus('email')}></div>${err('email')}`
      : input('email', 'type="email" autocomplete="email" maxlength="200" required')
  }
  <div class="field"><label for="phone">${h(LABELS.phone)}</label><p class="hint" id="phone-hint">Pick your country, then your number as you'd give it at home.</p>
    <div class="dial">${dialSelect(t.country ?? '', LABELS.country, 'phone-hint')}<input id="phone" name="phone" type="tel" autocomplete="tel-national" maxlength="40" required value="${h(t.phone ?? '')}"${bad('phone', 'phone-hint')}${focus('phone')}></div></div>${err('phone')}
  <div class="field" data-pills><label for="skills">${h(LABELS.skills)}</label><p class="hint" id="skills-hint">Start typing and pick from the list, or type your own. Add as many as you do, such as Sound engineer, RF tech, Rigger.</p>
    <input id="skills" name="skills" list="roles" autocomplete="off" required maxlength="${APPLICATION_SKILLS_LENGTH}" value="${h(t.skills ?? '')}"${bad('skills', 'skills-hint')}${focus('skills')}>
    <datalist id="roles">${(d.roles ?? []).map((r) => `<option value="${h(r)}"></option>`).join('')}</datalist></div>${err('skills')}
  <div class="field"><label for="rate">${h(LABELS.rate)}<span class="sr-only">, €</span></label><span class="unit-box"><span class="unit" aria-hidden="true">€</span><input id="rate" name="rate" inputmode="decimal" maxlength="12" value="${h(t.rate ?? '')}"${bad('rate')}${focus('rate')}></span></div>${err('rate')}
  ${radios('tradesAs', [...TRADES_AS.map((x) => [x, TRADES_AS_LABELS[x]] as const), ['', 'Not sure']])}
  ${input('basedIn', `autocomplete="address-level2" maxlength="${APPLICATION_BASED_LENGTH}"`)}
  <div class="field"><label for="about">${h(LABELS.about)}</label><p class="hint" id="about-hint">Recent shows, venues and companies you've worked for, tickets and certificates you hold.</p>
    <textarea id="about" name="about" maxlength="${APPLICATION_ABOUT_LENGTH}"${bad('about', 'about-hint')}>${h(t.about ?? '')}</textarea></div>${err('about')}
  ${
    d.payment
      ? `<fieldset class="pay"><legend>For paying you (optional)</legend>
    <p class="hint">So we can pay you without asking again. Only our directors and office see these, and they're kept locked. Leave them empty if you'd rather give them later.</p>
    ${input('ppsn', 'autocomplete="off" inputmode="text" maxlength="12" spellcheck="false"')}
    ${input('vatNumber', 'autocomplete="off" maxlength="20" spellcheck="false"')}
    ${input('accountName', 'autocomplete="cc-name" maxlength="100"')}
    ${input('iban', 'autocomplete="off" maxlength="42" spellcheck="false" placeholder="IE29 AIBK 9311 5212 3456 78"')}
    ${input('bic', 'autocomplete="off" maxlength="14" spellcheck="false"')}
  </fieldset>`
      : ''
  }
  <fieldset class="choice agree" id="agree"${e.agree ? ' aria-describedby="agree-error"' : ''}><legend>${h(LABELS.agree)}</legend>
    <label><input type="checkbox" name="agree" value="yes"${t.agree ? ' checked' : ''}${focus('agree')}> <span>Session Hire can keep these details to offer me work. I can ask the office to delete them at any time.</span></label></fieldset>${err('agree')}
  ${d.emails ? `<p class="hint">Sending it, you'll get an email from us at the address above once the office has read it.</p>` : ''}
  <button class="yes">Send my application</button>
</form>${officeBlock(d.office)}
<script>${PILLS_SCRIPT}</script>${foot}`
}

/**
 * What you do as pills (Colly, 23 November 2026: "the autocomplete pill input the same as the roles one"), as the app's
 * Skills field works (ADR 0063): typing offers the roles in the page's list, starting with what's typed first; Enter or
 * a comma takes the highlighted one, or what's typed as a new one; Backspace in an empty box takes the last pill off;
 * each pill has a × to take it off; and what's still typed when the form is sent goes with it. Each one added or taken
 * off is said in a status line. Without script the field is the plain one it replaces, with commas between roles and the
 * browser's own list of offers. The one script on the page, let in by its hash (app.ts), so it is kept exactly as here.
 */
export const PILLS_SCRIPT = `
    (function () {
      var field = document.querySelector('[data-pills]')
      if (!field) return
      var kept = field.querySelector('#skills'), roles = field.querySelector('#roles')
      var known = Array.prototype.map.call(roles.options, function (o) { return o.value })
      var picked = kept.value.split(/[,;\\/\\n]+/).map(function (s) { return s.trim() }).filter(Boolean)
      var invalid = kept.getAttribute('aria-invalid'), described = kept.getAttribute('aria-describedby'), focus = kept.autofocus
      kept.id = 'skills-kept'; kept.type = 'hidden'; kept.removeAttribute('list'); kept.removeAttribute('required')
      var anchor = document.createElement('div'); anchor.className = 'pills-anchor'
      var box = document.createElement('div'); box.className = 'pills'
      var chips = document.createElement('ul'); chips.setAttribute('aria-label', 'Chosen')
      var input = document.createElement('input')
      input.id = 'skills'; input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false')
      input.setAttribute('aria-controls', 'skills-offers'); input.autocomplete = 'off'; input.maxLength = 60
      if (described) input.setAttribute('aria-describedby', described)
      if (invalid) input.setAttribute('aria-invalid', invalid)
      var list = document.createElement('ul'); list.id = 'skills-offers'; list.className = 'offers'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Roles'); list.hidden = true
      var said = document.createElement('p'); said.className = 'sr-only'; said.setAttribute('role', 'status')
      box.appendChild(chips); box.appendChild(input); anchor.appendChild(box); anchor.appendChild(list)
      kept.parentNode.insertBefore(anchor, kept); field.appendChild(said)
      var offers = [], at = -1
      var has = function (s) { var k = s.toLowerCase(); return picked.some(function (p) { return p.toLowerCase() === k }) }
      var spelt = function (s) { var k = s.toLowerCase(); for (var i = 0; i < known.length; i++) if (known[i].toLowerCase() === k) return known[i]; return s }
      var sync = function () {
        kept.value = picked.join(', ')
        chips.textContent = ''
        picked.forEach(function (p) {
          var li = document.createElement('li'); li.className = 'pill'
          var name = document.createElement('span'); name.textContent = p
          var x = document.createElement('button'); x.type = 'button'; x.textContent = '\\u00d7'; x.setAttribute('aria-label', 'Remove ' + p)
          x.addEventListener('click', function () { take(p); input.focus() })
          li.appendChild(name); li.appendChild(x); chips.appendChild(li)
        })
        input.placeholder = picked.length ? '' : 'Sound engineer, rigger'
      }
      var add = function (s) {
        s = s.replace(/\\s+/g, ' ').trim().slice(0, 60)
        if (!s) return
        if (has(s)) { said.textContent = spelt(s) + ' is already on.'; return }
        if (picked.length >= 30) return
        picked.push(spelt(s)); sync(); said.textContent = 'Added ' + spelt(s) + '. ' + picked.length + ' chosen.'
      }
      var take = function (s) { picked = picked.filter(function (p) { return p !== s }); sync(); said.textContent = 'Removed ' + s + '. ' + picked.length + ' chosen.' }
      var show = function () {
        var q = input.value.trim().toLowerCase()
        var open = known.filter(function (k) { return !has(k) })
        var starts = open.filter(function (k) { return k.toLowerCase().indexOf(q) === 0 })
        var words = q ? open.filter(function (k) { return k.toLowerCase().indexOf(q) !== 0 && k.toLowerCase().split(/[\\s()/&+-]+/).some(function (w) { return w.indexOf(q) === 0 }) }) : []
        offers = starts.concat(words).slice(0, 8).map(function (k) { return { role: k, label: k } })
        if (q && !known.some(function (k) { return k.toLowerCase() === q }) && !has(q)) offers.push({ role: input.value.trim(), label: 'Add \\u201c' + input.value.trim() + '\\u201d' })
        at = q && offers.length ? 0 : -1
        draw()
      }
      var draw = function () {
        list.textContent = ''
        offers.forEach(function (o, i) {
          var li = document.createElement('li'); li.id = 'skills-offer-' + i; li.setAttribute('role', 'option'); li.textContent = o.label
          li.setAttribute('aria-selected', i === at ? 'true' : 'false')
          li.addEventListener('mousedown', function (e) { e.preventDefault() })
          li.addEventListener('click', function () { add(o.role); input.value = ''; show() })
          list.appendChild(li)
        })
        var open = offers.length > 0 && document.activeElement === input
        list.hidden = !open
        input.setAttribute('aria-expanded', open ? 'true' : 'false')
        if (at >= 0 && open) { input.setAttribute('aria-activedescendant', 'skills-offer-' + at); list.children[at].scrollIntoView({ block: 'nearest' }) }
        else input.removeAttribute('aria-activedescendant')
      }
      input.addEventListener('input', function () {
        var parts = input.value.split(/[,;]/)
        if (parts.length > 1) {
          var last = parts.pop()
          if (parts.length === 1 && last === '' && at >= 0 && offers[at]) add(offers[at].role)
          else parts.forEach(add)
          input.value = last.replace(/^\\s+/, '')
        }
        show()
      })
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (!offers.length) return show()
          at = e.key === 'ArrowDown' ? (at >= offers.length - 1 ? 0 : at + 1) : (at <= 0 ? offers.length - 1 : at - 1)
          draw()
        } else if (e.key === 'Enter') {
          if (!input.value.trim() && at < 0) return
          e.preventDefault()
          add(at >= 0 && offers[at] ? offers[at].role : input.value); input.value = ''; show()
        } else if (e.key === 'Escape' && !list.hidden) {
          e.preventDefault(); offers = []; at = -1; draw()
        } else if (e.key === 'Backspace' && !input.value && picked.length && !e.repeat) {
          e.preventDefault(); take(picked[picked.length - 1])
        }
      })
      input.addEventListener('focus', show)
      input.addEventListener('blur', function () { offers = []; at = -1; draw() })
      box.addEventListener('click', function (e) { if (e.target === box) input.focus() })
      kept.form.addEventListener('submit', function () { if (input.value.trim()) { add(input.value); input.value = '' } })
      sync()
      if (focus) input.focus()
    })()
    `
