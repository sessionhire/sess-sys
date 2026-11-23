import { applicantAsPerson, APPLICATIONS_SETTING_ID, newId, type Application, type CommandArgs } from '@sh/shared'
import { emit, emitRemoved, Refused, type Ctx } from '../kernel.ts'
import { getSetting } from '../office/store.ts'
import { crewHandlers } from '../crew/handlers.ts'
import { getPerson } from '../crew/store.ts'
import { emailsApplicants, getApplication } from './store.ts'
import { keepPayment } from '../crew/payment.ts'

/**
 * Taking someone on from an application, or turning them down (ADR 0190). Either way the application goes, and its copy
 * in the change feed with it, so what a person turned down sent isn't kept anywhere the app reads (only the backups,
 * which age out). Nobody is told either way: the office gets in touch the usual way.
 */

type ApplicationCommand = 'application.take' | 'application.drop' | 'applications.use' | 'applications.email'
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
    await crewHandlers['person.upsert'](ctx, applicantAsPerson(app, a.personId))
    // Their payment details, still locked, go with them (ADR 0193): to the person, where those who see money can read them.
    const { rows } = await ctx.tx.query<{ payment_sealed: string | null }>('SELECT payment_sealed FROM applications WHERE id = $1', [a.id])
    if (rows[0]?.payment_sealed) await keepPayment(ctx.tx, a.personId, rows[0].payment_sealed, 'The Apply page')
    await queueEmail(ctx, 'taken', app, a.personId)
    await removeApplication(ctx, a.id)
  },

  /** Whether the public Apply page takes applications (ADR 0190). Turning it off keeps every application already in. */
  /** Whether people who apply are emailed when taken on or turned down (ADR 0193). Off until launch, as every way out is (ADR 0048). */
  async 'applications.email'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, email_applicants) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET email_applicants = EXCLUDED.email_applicants, updated_at = now()`,
      [APPLICATIONS_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', APPLICATIONS_SETTING_ID, await getSetting(ctx.tx, APPLICATIONS_SETTING_ID))
  },

  async 'applications.use'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, take_applications) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET take_applications = EXCLUDED.take_applications, updated_at = now()`,
      [APPLICATIONS_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', APPLICATIONS_SETTING_ID, await getSetting(ctx.tx, APPLICATIONS_SETTING_ID))
  },

  async 'application.drop'(ctx, a) {
    const app = await getApplication(ctx.tx, a.id, true)
    if (!app) throw new Refused({ code: 'not-found', message: GONE })
    await queueEmail(ctx, 'declined', app, null)
    await removeApplication(ctx, a.id)
  },
}

/**
 * The email to someone who applied (ADR 0193), queued in the same change, so it goes only if that change is kept, and
 * sent just after by ApplicantEmails. Only while the office has it on: off, nobody is told, as before.
 */
async function queueEmail(ctx: Ctx, kind: 'taken' | 'declined', app: Application, personId: string | null) {
  if (!(await emailsApplicants(ctx.tx))) return
  await ctx.tx.query(`INSERT INTO applicant_emails (id, kind, person_id, to_email, first_name, state) VALUES ($1, $2, $3, $4, $5, 'queued')`, [
    newId(),
    kind,
    personId,
    app.email,
    app.firstName,
  ])
}
