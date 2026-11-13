import { LOGO_SVG } from '@sh/shared'

/**
 * The company's mark at the top left of every screen (ADR 0170), in the brand red on the page's own ground in both
 * themes. The name is written beside it, so it's hidden from screen readers; on the app's own screens the whole block
 * goes Home (ADR 0122).
 */
export function Mark() {
  return <span className="mark" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
}
