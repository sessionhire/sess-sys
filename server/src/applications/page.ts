import { dsSpace, CREW_DEPARTMENTS, DIAL_CODES, LOGO_SVG, TRADES_AS, TRADES_AS_LABELS, APPLICATION_ABOUT_LENGTH, APPLICATION_BASED_LENGTH, APPLICATION_SKILLS_LENGTH, type ApplyField, type ApplyForm, type OfficeDetails } from '@sh/shared'
import { CSS, fieldError, h, invalid, officeBlock } from '../crew/page.ts'

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
textarea{min-height:${dsSpace[8] * 4}px;resize:vertical}form.apply{display:grid;gap:${dsSpace[4]}px}form.apply .dial{display:grid;gap:${dsSpace[2]}px;grid-template-columns:minmax(0,max-content) minmax(${dsSpace[16] * 2}px,1fr)}form.apply .dial select{min-width:0;max-width:100%}form.apply .pair{display:grid;gap:${dsSpace[4]}px;grid-template-columns:repeat(auto-fit,minmax(${dsSpace[16] * 3}px,1fr))}`

/** Where the page stands. */
export type JoinState = 'ask' | 'thanks' | 'off' | 'full'

const LABELS: Record<ApplyField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Mobile',
  country: 'Country code',
  department: 'Your department',
  skills: 'What you do',
  rate: 'Your usual day rate (optional)',
  tradesAs: 'How you work (optional)',
  basedIn: 'Where you’re based (optional)',
  about: 'Your experience (optional)',
  agree: 'Keeping your details',
}

const ORDER: ApplyField[] = ['firstName', 'lastName', 'email', 'phone', 'department', 'skills', 'rate', 'tradesAs', 'basedIn', 'about', 'agree']

/** Each field's error, under it, and a list of them at the top that links to each (GOV.UK's error summary). */
export function renderJoin(d: { state: JoinState; office?: OfficeDetails | null; typed?: Partial<ApplyForm>; errors?: Partial<Record<ApplyField, string>>; issued?: string }): string {
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
<p>Someone from the office will read your application and be in touch if we have work that suits you. You don't need to send it again; if something changes, send it again with the same email and we'll keep the newer one.</p>${officeBlock(d.office)}${foot}`

  const t = d.typed ?? {}
  const e = d.errors ?? {}
  const wrong = ORDER.filter((f) => e[f])
  const err = (f: ApplyField) => (e[f] ? fieldError(`${f}-error`, e[f]!) : '')
  const bad = (f: ApplyField, hint?: string) => (e[f] ? invalid(`${f}-error`, hint) : hint ? ` aria-describedby="${hint}"` : '')
  const first = wrong[0]
  const focus = (f: ApplyField) => (f === first ? ' autofocus' : '')
  const input = (f: ApplyField, attrs: string) =>
    `<div class="field"><label for="${f}">${h(LABELS[f])}</label><input id="${f}" name="${f}" ${attrs} value="${h(t[f] ?? '')}"${bad(f)}${focus(f)}></div>${err(f)}`
  const radios = (f: 'department' | 'tradesAs', options: readonly (readonly [string, string])[]) =>
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
  ${input('email', 'type="email" autocomplete="email" maxlength="200" required')}
  <div class="field"><label for="phone">${h(LABELS.phone)}</label><p class="hint" id="phone-hint">Pick your country, then your number as you'd give it at home.</p>
    <div class="dial"><select id="country" name="country" aria-label="${h(LABELS.country)}" aria-describedby="phone-hint" autocomplete="tel-country-code">${DIAL_CODES.map(
      ([code, country]) => `<option value="${code}"${(t.country || '353') === code ? ' selected' : ''}>${h(country)} +${code}</option>`
    ).join('')}</select><input id="phone" name="phone" type="tel" autocomplete="tel-national" maxlength="40" required value="${h(t.phone ?? '')}"${bad('phone', 'phone-hint')}${focus('phone')}></div></div>${err('phone')}
  ${radios('department', [...CREW_DEPARTMENTS.map((x) => [x, x] as const), ['', 'Not sure']])}
  <div class="field"><label for="skills">${h(LABELS.skills)}</label><p class="hint" id="skills-hint">Separate them with commas, such as FOH, monitors, RF, desk op.</p>
    <input id="skills" name="skills" maxlength="${APPLICATION_SKILLS_LENGTH}" value="${h(t.skills ?? '')}"${bad('skills', 'skills-hint')}${focus('skills')}></div>${err('skills')}
  <div class="field"><label for="rate">${h(LABELS.rate)}<span class="sr-only">, €</span></label><span class="unit-box"><span class="unit" aria-hidden="true">€</span><input id="rate" name="rate" inputmode="decimal" maxlength="12" value="${h(t.rate ?? '')}"${bad('rate')}${focus('rate')}></span></div>${err('rate')}
  ${radios('tradesAs', [...TRADES_AS.map((x) => [x, TRADES_AS_LABELS[x]] as const), ['', 'Not sure']])}
  ${input('basedIn', `autocomplete="address-level2" maxlength="${APPLICATION_BASED_LENGTH}"`)}
  <div class="field"><label for="about">${h(LABELS.about)}</label><p class="hint" id="about-hint">Recent shows, venues and companies you've worked for, tickets and certificates you hold.</p>
    <textarea id="about" name="about" maxlength="${APPLICATION_ABOUT_LENGTH}"${bad('about', 'about-hint')}>${h(t.about ?? '')}</textarea></div>${err('about')}
  <fieldset class="choice agree" id="agree"${e.agree ? ' aria-describedby="agree-error"' : ''}><legend>${h(LABELS.agree)}</legend>
    <label><input type="checkbox" name="agree" value="yes"${t.agree ? ' checked' : ''}${focus('agree')}> <span>Session Hire can keep these details to offer me work. I can ask the office to delete them at any time.</span></label></fieldset>${err('agree')}
  <button class="yes">Send my application</button>
</form>${officeBlock(d.office)}${foot}`
}
