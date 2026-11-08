import { firstName, type OfficeDetails } from '@sh/shared'
import { CSS, fieldError, h, invalid, officeBlock } from './page.ts'

/**
 * The two pages a freelancer meets when their link checks a phone
 * (ADR 0114): "Is this you?" on a phone the link hasn't seen, and "Lost
 * your link?". Plain HTML with ordinary forms, as their page is (ADR 0002).
 */

const head = (title: string, heading: string, small?: string) => `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${h(title)}</title><style>${CSS}</style></head>
<body><main><header class="top"><span class="mark">SH</span><div><b>Session Hire</b><h1>${heading}</h1>${small ? `<small>${small}</small>` : ''}</div></header>`
const foot = '</main></body></html>'

/** Where the check stands on this phone. */
export type PhoneCheck =
  /** Nothing asked yet. */
  | 'ask'
  /** A code has gone to their email. */
  | 'sent'
  /** The code typed isn't the one sent. */
  | 'wrong'
  /** The code ran out, or was tried too often: a new one is needed. */
  | 'expired'
  /** Asked again within the minute. */
  | 'wait'
  /** The mailbox couldn't send it just now. */
  | 'not-sent'

/** "a•••@gmail.com": enough for them to know which address, no more for whoever holds the link. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '•••'
  return `${email[0]}•••${email.slice(at)}`
}

const SAID: Record<PhoneCheck, string> = {
  ask: '',
  sent: '<p class="flash ok" role="status">Sent. It can take a minute to arrive; check your spam folder too.</p>',
  wrong: '<p class="flash bad" role="alert">That isn\'t the code we sent. Check it and try again.</p>',
  expired: '<p class="flash bad" role="alert">That code has run out. Send yourself a new one.</p>',
  wait: '<p class="flash warn" role="status">A code went a moment ago. Give it a minute before asking for another.</p>',
  'not-sent': '<p class="flash bad" role="alert">The code couldn\'t be sent just now. Try again in a few minutes, or ring the office.</p>',
}

/**
 * A phone the link hasn't seen, while the office has checking on (ADR 0114). One job: let the person in on this
 * phone, by a code to the email the office has for them. With no email, or no way to send one, the office makes them
 * a new link, which opens on the first phone that uses it.
 */
export function renderCheckPhone(d: { name: string; base: string; email: string | null; canSend: boolean; state: PhoneCheck; office?: OfficeDetails | null }): string {
  const first = h(firstName({ name: d.name }))
  const top = head('Check this phone', `Is this you, ${first}?`, `${first}'s page`)
  const intro = `<p>This link has been opened on another phone before. To keep your offers and details safe, we check each new phone once. After that, this phone is remembered.</p>`
  if (!d.email || !d.canSend)
    return `${top}${intro}
<p class="flash warn">We can't send you a code just now. Ring the office and ask for a new link: a new link opens on the first phone that uses it.</p>${officeBlock(d.office)}${foot}`
  const codeSent = d.state !== 'ask' && d.state !== 'expired' && d.state !== 'not-sent'
  const enter = `<form method="post" action="${h(d.base)}/code">
  <div class="field"><label for="code">The code from the email</label>
    <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="9" required${d.state === 'wrong' ? ' aria-invalid="true" autofocus' : ''}></div>
  <button class="yes">Let this phone in</button>
</form>`
  const send = (again: boolean) => `<form method="post" action="${h(d.base)}/code/send">
  <button${again ? '' : ' class="yes"'}>${again ? 'Send a new code' : 'Email me a code'}</button>
</form>`
  return `${top}${intro}${SAID[d.state]}
<p>${codeSent ? "We've emailed" : "We'll email"} a six-digit code to <b>${h(maskEmail(d.email))}</b>, the address the office has for you. It works for 15 minutes.</p>
${codeSent ? `${enter}${send(true)}` : send(false)}
<p class="small">Not your address any more? Ring the office to change it.</p>${officeBlock(d.office)}${foot}`
}

/** Where "Lost your link?" stands. */
export type LostState = 'ask' | 'sent' | 'off' | 'not-an-email'

/**
 * A freelancer who has lost their link asks for it by email (ADR 0114). The answer is the same whether or not the
 * address is one we have, so the page tells nobody who works here. While checking is off, the office sends links.
 */
export function renderLost(d: { state: LostState; office?: OfficeDetails | null; typed?: string }): string {
  const title = 'Lost your link?'
  if (d.state === 'off')
    return `${head(title, title)}
<p>Ask the office to send it to you again. Staff sign in to the app with their Session Hire Google account instead.</p>${officeBlock(d.office)}${foot}`
  if (d.state === 'sent')
    return `${head(title, 'Check your email')}
<p class="flash ok" role="status">If that's the address the office has for you, your link is on its way. It can take a minute; check your spam folder too.</p>
<p>Nothing come through? Ring the office and they'll send it.</p>${officeBlock(d.office)}${foot}`
  const wrong = d.state === 'not-an-email'
  return `${head(title, title)}
<p>Put in the email address the office has for you and we'll send your link to it. Staff sign in to the app with their Session Hire Google account instead.</p>
<form method="post" action="/link">
  <div class="field"><label for="email">Your email</label>
    <input type="email" id="email" name="email" autocomplete="email" maxlength="200" required value="${h(d.typed ?? '')}"${wrong ? `${invalid('email-error')} autofocus` : ''}></div>
  ${wrong ? fieldError('email-error', "That doesn't look like an email address.") : ''}
  <button class="yes">Send me my link</button>
</form>${officeBlock(d.office)}${foot}`
}
