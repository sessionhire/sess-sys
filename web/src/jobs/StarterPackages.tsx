import { STARTER_PACKAGES, starterPlan, type View } from '@sh/shared'
import { useState } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { Heading } from '../Icon.tsx'
import { client } from '../sync.ts'

/**
 * The starter packages (ADR 0117): kit sets drawn from Current RMS's past quotes, added to the price list in one go,
 * each to change afterwards as any package is. Offered while any is still to add; gone once they're all there.
 */
export function StarterPackagesCard({ view }: { view: View }) {
  const plan = starterPlan(view.warehouse.models, view.money.packages.map((p) => p.id))
  const [showWaiting, setShowWaiting] = useState(false)
  const { run, error } = useAct()
  if (plan.packages.length === 0 && plan.waiting.length === 0) return null
  const add = () =>
    void run(async () => {
      for (const p of plan.products)
        await client.mutate('model.create', { id: p.id, name: p.name, department: 'audio', category: p.category, tracking: 'bulk', isCase: false, valueCents: null, notes: '', aliases: [...p.aliases] })
      for (const p of plan.packages) await client.mutate('package.save', { ...p, rate: p.rate ?? 'daily' })
    })
  const n = plan.packages.length
  return (
    <section className="card starter-packages" aria-label="Starter packages">
      <Heading icon="kit">Starter packages</Heading>
      <p className="hint">
        {plan.already === 0
          ? `${STARTER_PACKAGES.length} packages drawn from the quotes in Current RMS: PA sizes from a speech PA to a J-Series stage, monitors, in-ears and radio mics, mic packages, cable packs in two sizes, lighting, staging, truss and an LED wall.`
          : `${n} more of the packages drawn from Current RMS's quotes.`}{' '}
        Each is priced at what its kit adds up to, and each can be changed or taken off afterwards.
      </p>
      {plan.products.length > 0 && (
        <p className="hint">
          The mic packages need {plan.products.length} products the stock list doesn't have yet ({plan.products.map((p) => p.name).join(', ')}): they're added too, with nothing counted, for the warehouse to
          count.
        </p>
      )}
      <Refusal error={error} />
      {n > 0 && (
        <div className="actions">
          <button type="button" className="primary" onClick={add}>
            Add {n === 1 ? 'the package' : `the ${n} packages`}
          </button>
        </div>
      )}
      {plan.waiting.length > 0 && (
        <>
          <button type="button" className="link" aria-expanded={showWaiting} onClick={() => setShowWaiting((s) => !s)}>
            {plan.waiting.length === 1 ? '1 waits' : `${plan.waiting.length} wait`} for a product the stock list doesn't have
          </button>
          {showWaiting && (
            <ul className="hint">
              {plan.waiting.map((w) => (
                <li key={w.name}>
                  <b>{w.name}</b>: {w.missing.join(', ')}
                </li>
              ))}
              <li>A product on the stock list by another name: add this one as another name it goes by, on its page, and its package is offered here.</li>
            </ul>
          )}
        </>
      )}
    </section>
  )
}
