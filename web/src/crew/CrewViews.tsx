import { answersToCheck, canApproveLeave } from '@sh/shared'
import type { View } from '@sh/shared'
import { inDepartment, useMyDepartment } from '../Narrowed.tsx'
import { useAccess } from '../role.ts'
import { useToday } from '../view.ts'
import { Views } from '../Views.tsx'
import { calendarAnswersToSortOut } from './CrewScreen.tsx'
import { useMe } from './Leave.tsx'

/**
 * Crew's row (ADR 0041): the calls and the answers to check, the people,
 * staff leave and timesheets. Calls and Leave count what the Crew tab's
 * badge counts between them, so the badge says which page to open;
 * Timesheets counts those to approve. Calls and Timesheets count only for
 * a role that can act on them (audit of 18 October). Timesheets is left
 * off the row while the company doesn't use them (ADR 0090).
 */
export function CrewViews({ view, current }: { view: View; current: string }) {
  const today = useToday()
  const { me } = useMe(view)
  const mayCrew = useAccess().can('crew')
  // A head's own department's, as the page starts on them (audit, 5 November 2026, finding 6).
  const department = useMyDepartment()
  const calls = mayCrew ? crewToCheck(view, today, department) : 0
  // What's theirs to decide: their own request is another approver's (audit, 5 November 2026, finding 28).
  const leave = canApproveLeave(me) ? leaveToDecide(view, me).length : 0
  return (
    <Views
      label="Crew pages"
      current={current}
      pages={[
        { key: 'calls', href: '#crew', label: 'Calls', count: calls },
        { key: 'people', href: '#crew/people', label: 'People' },
        { key: 'leave', href: '#crew/leave', label: 'Leave', count: leave },
        ...(view.office.useTimesheets ? [{ key: 'timesheets', href: '#crew/timesheets', label: 'Timesheets', count: mayCrew ? view.timesheets.toApprove.length : 0 }] : []),
      ]}
    />
  )
}

/**
 * What waits on the office under Calls: answers to check or sort out, anyone running late, documents sent in. For a department,
 * its people's, as Answers to check lists them narrowed: an answer on Google Calendar isn't anyone's department.
 */
export function crewToCheck(view: View, today: string, department?: string): number {
  const theirs = inDepartment(department || undefined)
  return (
    answersToCheck(view.crew, today).filter((a) => theirs(a.offer.person)).length +
    (department ? 0 : calendarAnswersToSortOut(view, today).length) +
    view.late.toCheck.filter((n) => theirs(n.person)).length +
    view.documents.toCheck.filter((d) => theirs(d.person)).length
  )
}

/** The leave waiting on an approver: everyone's but their own, which another approver decides. */
export const leaveToDecide = (view: View, me: { id: string } | undefined) => view.leave.queue.filter((q) => q.person?.id !== me?.id)
