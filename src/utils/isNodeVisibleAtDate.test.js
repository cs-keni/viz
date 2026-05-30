import { describe, it, expect } from 'vitest'
import { isNodeVisibleAtDate } from './isNodeVisibleAtDate'

describe('isNodeVisibleAtDate', () => {
  const node = { id: 'A', created: '2024-03-15' }

  it('returns true when date is after creation', () => {
    expect(isNodeVisibleAtDate(node, new Date('2024-04-01'))).toBe(true)
  })

  it('returns true when date equals creation date', () => {
    expect(isNodeVisibleAtDate(node, new Date('2024-03-15'))).toBe(true)
  })

  it('returns false when date is before creation', () => {
    expect(isNodeVisibleAtDate(node, new Date('2024-01-01'))).toBe(false)
  })

  it('returns true for node with no created date', () => {
    expect(isNodeVisibleAtDate({ id: 'B' }, new Date('2020-01-01'))).toBe(true)
  })

  it('returns true for null node', () => {
    expect(isNodeVisibleAtDate(null, new Date())).toBe(true)
  })

  it('returns true when date is null', () => {
    expect(isNodeVisibleAtDate(node, null)).toBe(true)
  })

  it('returns true for unparseable created date string', () => {
    expect(isNodeVisibleAtDate({ created: 'not-a-date' }, new Date())).toBe(true)
  })

  it('returns true when both node and date are null', () => {
    expect(isNodeVisibleAtDate(null, null)).toBe(true)
  })
})
