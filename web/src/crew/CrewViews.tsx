import { canApproveLeave, standing } from '@sh/shared'
import type { View } from '@sh/shared'
import { useMyDepartment } from '../Narrowed.tsx'
import { useAccess } from '../role.ts'
import { useToday } from '../view.ts'
import { Views } from '../Views.tsx'
import { useMe } from './Leave.tsx'

/**
 * Crew's row (ADR 0041): the calls and the answers to check, the people,
 * staff leave and timesheets. Calls and Leave count what the Crew tab's
 * badge counts between them, so the badge says which page to open, and
 * each is the list its page heads with, read from the same place as Home's
 * counts (shared/src/sync/standing.ts); Timesheets counts those to approve.
 * Calls and Timesheets count only for a role that can act on them (audit of
 * 18 October). Timesheets is left off the row while the company doesn't
 * use them (ADR 0090).
 */
export function CrewViews({ view, current }: { view: View; current: string }) {
  const today = useToday()
  const { me } = useMe(view)
  const mayCrew = useAccess().can('crew')
  // A head's own department's, as the page starts on them (audit, 5 November 2026, finding 6).
  const department = useMyDepartment()
  const calls = mayCrew ? crewToCheck(view, today, department) : 0
  // What's theirs to decide: their own request is another approver's (audit, 5 November 2026, finding 28).
  const leave = canApproveLeave(me) ? leaveToDecide(view, today, me).length : 0
  // Only those they can decide, as Home counts them: one whose amounts they aren't sent waits on the office (ADR 0062; Move 3 of
  // the sweep of 6 November 2026).
  const timesheets = mayCrew ? standing(view, today).timesheets.length : 0
  return (
    <Views
      label="Crew pages"
      current={current}
      pages={[
        { key: 'calls', href: '#crew', label: 'Calls', count: calls },
        { key: 'people', href: '#crew/people', label: 'People' },
      ]}
      more={[
        { key: 'leave', href: '#crew/leave', label: 'Leave', count: leave },
        ...(view.office.useTimesheets ? [{ key: 'timesheets', href: '#crew/timesheets', label: 'Timesheets', count: timesheets }] : []),
      ]}
    />
  )
}

/**
 * What waits on the office under Calls, as Answers to check heads it: answers to check or sort out, documents sent in, and
 * anyone running late. For a department, its people's, as Answers to check lists them narrowed: an answer on Google Calendar
 * isn't anyone's department.
 */
export function crewToCheck(view: View, today: string, department?: string): number {
  const waiting = standing(view, today, { department: department || undefined })
  return waiting.answers.length + waiting.late.length
}

/** The leave waiting on an approver: everyone's but their own, which another approver decides. */
export const leaveToDecide = (view: View, today: string, me: { id: string } | undefined) => standing(view, today, { me }).leave
