import { APPLICANT_LEVEL, APPLICATIONS_SETTING_ID, dayLabel, irishToday, notesFrom, type CommandArgs } from '@sh/shared'
import { emit, emitRemoved, Refused, type Ctx } from '../kernel.ts'
import { getSetting } from '../office/store.ts'
import { crewHandlers } from '../crew/handlers.ts'
import { getPerson } from '../crew/store.ts'
import { getApplication } from './store.ts'

/**
 * Taking someone on from an application, or turning them down (ADR 0190). Either way the application goes, and its copy
 * in the change feed with it, so what a person turned down sent isn't kept anywhere the app reads (only the backups,
 * which age out). Nobody is told either way: the office gets in touch the usual way.
 */

type ApplicationCommand = 'application.take' | 'application.drop' | 'applications.use'
type Handler<N extends ApplicationCommand> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

const GONE = 'That application has already been taken on or turned down.'

/** The application out of the table, and out of the change feed, so devices drop it and a new device never gets it. */
export async function removeApplication(ctx: Ctx, id: string) {
  await ctx.tx.query('DELETE FROM applications WHERE id = $1', [id])
  await ctx.tx.query(`UPDATE changes SET op = 'delete', data = NULL WHERE entity = 'application' AND entity_id = $1`, [id])
  await emitRemoved(ctx, 'application', id)
}

export const applicationHandlers: { [N in ApplicationCommand]: Handler<N> } = {
  async 'application.take'(ctx, a) {
    const app = await getApplication(ctx.tx, a.id, true)
    if (!app) throw new Refused({ code: 'not-found', message: GONE })
    if (await getPerson(ctx.tx, a.personId)) throw new Refused({ code: 'conflict', message: 'That person is on the Crew tab already.' })
    const name = `${app.firstName} ${app.lastName}`.trim()
    // As the office would add them: a freelancer, at Level 0 so they stay out of Offer to… until vetted (ADR 0025).
    await crewHandlers['person.upsert'](ctx, {
      id: a.personId,
      name,
      firstName: app.firstName,
      lastName: app.lastName,
      kind: 'freelancer',
      email: app.email,
      phone: app.phone,
      skills: app.skills,
      dayRateCents: app.dayRateCents,
      notes: notesFrom(app, dayLabel(irishToday(new Date(app.appliedAt)))),
      department: app.department,
      level: APPLICANT_LEVEL,
      company: app.tradesAs ? { as: app.tradesAs, name: '', vatNumber: null, croNumber: null } : null,
      nameChecked: true,
    })
    await removeApplication(ctx, a.id)
  },

  /** Whether the public Apply page takes applications (ADR 0190). Turning it off keeps every application already in. */
  async 'applications.use'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, take_applications) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET take_applications = EXCLUDED.take_applications, updated_at = now()`,
      [APPLICATIONS_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', APPLICATIONS_SETTING_ID, await getSetting(ctx.tx, APPLICATIONS_SETTING_ID))
  },

  async 'application.drop'(ctx, a) {
    if (!(await getApplication(ctx.tx, a.id, true))) throw new Refused({ code: 'not-found', message: GONE })
    await removeApplication(ctx, a.id)
  },
}
