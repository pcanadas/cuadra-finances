import { describe, it, expect } from 'vitest'
import { projectMonth, projectYear, savingsRate } from './projection'

describe('savingsRate', () => {
  it('is the share of income left', () => {
    expect(savingsRate(2000, 500)).toBe(25)
    expect(savingsRate(2000, -200)).toBe(-10)
    expect(savingsRate(0, -200)).toBeNull()
  })
})

describe('projectMonth', () => {
  it('extrapolates only the variable spending and adds pending fixed items', () => {
    // Día 10 de 30: 1000 gastados, de ellos 700 de alquiler; quedan 80 de luz por pagar
    const p = projectMonth({ incomeExpected: 2000, spent: 1000, fixedPaid: 700, pendingFixed: 80, day: 10, daysInMonth: 30 })
    expect(p.perDay).toBe(30)
    expect(p.daysLeft).toBe(20)
    expect(p.projectedSpend).toBe(1000 + 600 + 80)
    expect(p.savings).toBe(320)
  })

  it('can predict a deficit', () => {
    const p = projectMonth({ incomeExpected: 1000, spent: 900, day: 15, daysInMonth: 30 })
    expect(p.savings).toBe(-800)
  })

  it('on the last day is just what is left', () => {
    expect(projectMonth({ incomeExpected: 1500, spent: 1200, day: 30, daysInMonth: 30 }).savings).toBe(300)
  })
})

describe('projectYear', () => {
  it('scales the year so far to the whole year', () => {
    const p = projectYear({ income: 20000, spent: 15000, day: 146, daysInYear: 365 })
    expect(p.savings).toBe(12500)
    expect(p.perDay).toBe(102.74)
  })
})
