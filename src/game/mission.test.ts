import { describe, expect, it } from 'vitest'
import { CREW_SIZE, JOBS, MISSION_DAYS, daysUntilSupplyShip } from './mission.ts'

describe('mission setup', () => {
  it('has fewer astronauts than jobs that produce something', () => {
    const productiveJobs = JOBS.filter((job) => job !== 'rest')
    // This is the core trade-off: every day at least one job goes undone.
    expect(CREW_SIZE).toBeLessThan(productiveJobs.length)
  })
})

describe('daysUntilSupplyShip', () => {
  it('counts down from the first day', () => {
    expect(daysUntilSupplyShip(1)).toBe(MISSION_DAYS - 1)
  })

  it('is zero on arrival day and never negative', () => {
    expect(daysUntilSupplyShip(MISSION_DAYS)).toBe(0)
    expect(daysUntilSupplyShip(MISSION_DAYS + 3)).toBe(0)
  })
})
