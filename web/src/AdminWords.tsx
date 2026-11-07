import { Fragment } from 'react'

/** Admin's tabs as a sentence names them, and where each is. */
const TABS: Record<string, string> = { Company: '#admin/company', Connections: '#admin/connections' }

/**
 * A sentence that sends someone to Admin, with "Admin › Company" or
 * "Admin › Connections" a link to that tab rather than words to follow by
 * hand (audit, 5 November 2026, finding 89).
 */
export function AdminWords({ children }: { children: string }) {
  const parts = children.split(/(Admin › (?:Company|Connections))/)
  return (
    <>
      {parts.map((part, i) => {
        const tab = /^Admin › (.+)$/.exec(part)?.[1]
        return tab && TABS[tab] ? (
          <a key={i} href={TABS[tab]}>
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      })}
    </>
  )
}
