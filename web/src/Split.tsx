import type { ReactNode } from 'react'

/**
 * A page's main thing and what stands beside it (the design system's
 * supporting pane). On a phone the side comes first, as it holds what waits
 * on someone (answers to check, certificates running out), then the main;
 * from 1200px the main is the wide left column and the side a narrow right
 * one, each reading down on its own (app.css). An empty side leaves the main
 * the whole width.
 */
export function Split({ side, children, sideAfter }: { side?: ReactNode; children: ReactNode; sideAfter?: boolean }) {
  // A page whose main is what people come for (People: the person they're looking up) keeps the side under it on a phone; its
  // counts are on Home already (review of 11 November 2026, finding 17).
  return (
    <div className={`split${sideAfter ? ' side-after' : ''}`}>
      <div className="side">{side}</div>
      <div className="main">{children}</div>
    </div>
  )
}
