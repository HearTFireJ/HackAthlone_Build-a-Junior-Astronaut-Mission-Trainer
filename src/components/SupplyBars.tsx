import { RESOURCES, RULES, type Resources } from '../game/mission.ts'
import { RESOURCE_WORDS } from './words.ts'

interface Props {
  now: Resources
  /** Where each supply will be at the end of the day with the current plan. */
  after?: Resources
}

/** The three supplies as bars, with a preview of where today's plan leaves them. */
export function SupplyBars({ now, after }: Props) {
  return (
    <div className="supplies">
      {RESOURCES.map((name) => {
        const words = RESOURCE_WORDS[name]
        const end = after?.[name]
        const change = end === undefined ? 0 : end - now[name]
        const low = (end ?? now[name]) <= RULES.dailyUse
        return (
          <div key={name} className={`supply${low ? ' supply-low' : ''}`}>
            <div className="supply-label">
              <span>
                {words.icon} {words.name}
              </span>
              <span className="supply-number">
                {now[name]}
                {end !== undefined && change !== 0 && (
                  <span className={change > 0 ? 'up' : 'down'}>
                    {' '}
                    → {end}
                  </span>
                )}
              </span>
            </div>
            <div
              className="bar"
              role="meter"
              aria-label={words.name}
              aria-valuemin={0}
              aria-valuemax={RULES.storageLimit}
              aria-valuenow={now[name]}
            >
              <div className="bar-fill" style={{ width: `${(now[name] / RULES.storageLimit) * 100}%` }} />
              {end !== undefined && (
                <div className="bar-mark" style={{ left: `${(end / RULES.storageLimit) * 100}%` }} />
              )}
            </div>
          </div>
        )
      })}
      <p className="hint">The base uses {RULES.dailyUse} of each every day.</p>
    </div>
  )
}
