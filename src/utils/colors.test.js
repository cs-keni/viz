import { describe, expect, it } from 'vitest'
import { colorForDegree, DEGREE_COLORS, isRecentlyAdded, sizeForDegree } from './colors'

describe('colorForDegree', () => {
  it('uses the low bucket for degrees 0 through 2', () => {
    expect(colorForDegree(0)).toBe(DEGREE_COLORS.low)
    expect(colorForDegree(2)).toBe(DEGREE_COLORS.low)
  })

  it('uses the medium bucket for degrees 3 through 8', () => {
    expect(colorForDegree(3)).toBe(DEGREE_COLORS.medium)
    expect(colorForDegree(8)).toBe(DEGREE_COLORS.medium)
  })

  it('uses the high bucket for degree 9 and above', () => {
    expect(colorForDegree(9)).toBe(DEGREE_COLORS.high)
    expect(colorForDegree(20)).toBe(DEGREE_COLORS.high)
  })
})

describe('sizeForDegree', () => {
  it('keeps isolated nodes visible', () => {
    expect(sizeForDegree(0)).toBe(2)
  })

  it('uses logarithmic growth for connected nodes', () => {
    expect(sizeForDegree(3)).toBeCloseTo(Math.log(4) * 3)
  })
})

describe('isRecentlyAdded', () => {
  const now = new Date('2026-05-24T12:00:00')

  it('treats dates under 7 days old as recent', () => {
    expect(isRecentlyAdded('2026-05-18', now)).toBe(true)
  })

  it('does not treat dates 7 or more days old as recent', () => {
    expect(isRecentlyAdded('2026-05-17', now)).toBe(false)
  })

  it('rejects future, missing, and invalid dates', () => {
    expect(isRecentlyAdded('2026-05-25', now)).toBe(false)
    expect(isRecentlyAdded(null, now)).toBe(false)
    expect(isRecentlyAdded('not-a-date', now)).toBe(false)
  })
})
