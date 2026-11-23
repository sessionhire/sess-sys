import { randomBytes, createHash, timingSafeEqual, X509Certificate } from 'node:crypto'
import { connect, rootCertificates, type DetailedPeerCertificate, type PeerCertificate } from 'node:tls'
import { WEBLINK_PATH, WEBLINK_USER } from '@sh/shared'

/**
 * The setup file for the ZT411 (ADR 0191): what the printer is sent once, by
 * Zebra Browser Print, Zebra's own tools or a USB stick, so that it connects
 * to the app. Commands in the printer's own language, a line each:
 *
 * 1. turn WebLink off a moment (`location` empty), since the password can
 *    only be changed while it is;
 * 2. forget any password it had for the app's address and add the new one
 *    (`authentication.add`, "server user password"): the app asks for it
 *    with an HTTP 401 and the printer answers;
 * 3. say where to connect (`location`), from the app's own address, so a
 *    new address means a new file, never a code change;
 * 4. try again every 10 seconds when the connection drops, and keep the
 *    last 100 lines of its WebLink log, for when it won't connect;
 * 5. the certificate authority the app's certificate comes from, as
 *    WEBLINK1_CA.NRD on its E: drive (`~DY`), which Link-OS 5.2 and later
 *    trusts for WebLink connection 1; and
 * 6. restart, which WebLink settings need before they take.
 *
 * The password is made here and kept only as a hash: a lost file means a
 * new one, which stops the old password working.
 */

/** A new password: 24 random bytes, written with letters and digits only, since the printer splits the entry at spaces. */
export const newSecret = () => randomBytes(24).toString('base64url')

export const hashSecret = (secret: string) => createHash('sha256').update(secret, 'utf8').digest('hex')

/** Whether the password given is the one whose hash is kept, compared in constant time. */
export function secretMatches(given: string, hash: string | null | undefined): boolean {
  if (!hash) return false
  const a = Buffer.from(hashSecret(given), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** The password from a request's basic sign-in, "Basic base64(user:password)", whatever the user name. */
export function basicPassword(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined
  const [scheme, value = ''] = header.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'basic') return undefined
  const decoded = Buffer.from(value, 'base64').toString('utf8')
  const colon = decoded.indexOf(':')
  return colon >= 0 ? decoded.slice(colon + 1) : undefined
}

/** A setting, as the printer reads it: `! U1 setvar "name" "value"` and a carriage return and line feed. */
const setvar = (name: string, value: string) => `! U1 setvar "${name}" "${value}"\r\n`

export interface SetupParts {
  /** The app's own address, such as https://server.letissier.ie. */
  origin: string
  secret: string
  /** The certificate authority's certificate, in PEM, if found. */
  ca?: string
}

/** Where the printer connects: the app's address and the WebLink path. */
export const weblinkAddress = (origin: string) => `${origin.replace(/\/$/, '')}${WEBLINK_PATH}`

export function setupFile({ origin, secret, ca }: SetupParts): string {
  const host = new URL(origin).hostname
  let out = ''
  out += setvar('weblink.ip.conn1.location', '')
  out += setvar('weblink.ip.conn1.authentication.remove', host)
  out += setvar('weblink.ip.conn1.authentication.add', `${host} ${WEBLINK_USER} ${secret}`)
  out += setvar('weblink.ip.conn1.retry_interval', '10')
  out += setvar('weblink.logging.max_entries', '100')
  out += setvar('weblink.ip.conn1.location', weblinkAddress(origin))
  if (ca) out += caDownload(ca)
  out += '! U1 do "device.reset" ""\r\n'
  return out
}

/** The certificate as a file on the printer's E: drive, WEBLINK1_CA.NRD, by `~DY` with its length in bytes. */
export function caDownload(pem: string): string {
  const body = pem.trim().replace(/\r?\n/g, '\n') + '\n'
  return `~DYE:WEBLINK1_CA,B,NRD,${Buffer.byteLength(body, 'utf8')},,${body}`
}

/**
 * The root certificate authority behind the app's own address, as the
 * printer must trust it: the chain the address presents, followed up to its
 * top and matched against the roots Node itself trusts. Asked of the address
 * from outside, so it's what Railway (or whoever serves the address) shows,
 * whichever authority that is, and a new address finds its own.
 */
export async function findRootCa(origin: string, waitMs = 8_000): Promise<{ pem: string; name: string } | { problem: string }> {
  const url = new URL(origin)
  if (url.protocol !== 'https:') return { problem: `The app's address, ${origin}, isn't https, and the printer only connects securely.` }
  const chain = await new Promise<DetailedPeerCertificate | Error>((resolve) => {
    const socket = connect({ host: url.hostname, port: Number(url.port) || 443, servername: url.hostname, timeout: waitMs }, () => {
      const cert = socket.getPeerCertificate(true)
      socket.end()
      resolve(cert)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(new Error('no answer'))
    })
    socket.on('error', (err) => resolve(err))
  })
  if (chain instanceof Error || !chain.raw) return { problem: `Couldn't read the certificate at ${url.hostname} (${chain instanceof Error ? chain.message : 'none given'}).` }
  // Up the chain to the last one given, stopping where a certificate is its own issuer.
  let top: PeerCertificate | DetailedPeerCertificate = chain
  const seen = new Set<string>()
  while ('issuerCertificate' in top && top.issuerCertificate && top.issuerCertificate !== top && !seen.has(top.fingerprint256)) {
    seen.add(top.fingerprint256)
    top = top.issuerCertificate
  }
  return rootFor(new X509Certificate(top.raw))
}

/** The trusted root that is, or signed, this certificate. */
export function rootFor(top: X509Certificate, roots: readonly string[] = rootCertificates): { pem: string; name: string } | { problem: string } {
  const nameOf = (c: X509Certificate) => /CN=([^\n]+)/.exec(c.subject)?.[1] ?? c.subject
  if (top.subject === top.issuer && roots.some((r) => new X509Certificate(r).fingerprint256 === top.fingerprint256)) return { pem: top.toString(), name: nameOf(top) }
  for (const pem of roots) {
    const root = new X509Certificate(pem)
    if (root.subject === top.issuer && top.checkIssued(root)) return { pem: root.toString(), name: nameOf(root) }
  }
  return { problem: `The certificate's authority (${top.issuer.replace(/\n/g, ', ')}) isn't one Node trusts, so the app can't tell the printer which to trust.` }
}
