import { describe, it, expect } from 'vitest'
import { matchesSearch } from './matchesSearch'

describe('matchesSearch', () => {
  const node = { label: 'Bobby Brain Viz', tags: ['project', 'obsidian'] }

  it('returns true for empty query', () => {
    expect(matchesSearch(node, '')).toBe(true)
    expect(matchesSearch(node, '   ')).toBe(true)
    expect(matchesSearch(node, null)).toBe(true)
  })

  it('matches on label substring (case-insensitive)', () => {
    expect(matchesSearch(node, 'bobby')).toBe(true)
    expect(matchesSearch(node, 'BRAIN')).toBe(true)
    expect(matchesSearch(node, 'viz')).toBe(true)
  })

  it('matches on tag', () => {
    expect(matchesSearch(node, 'obsidian')).toBe(true)
    expect(matchesSearch(node, 'project')).toBe(true)
  })

  it('returns false when no match', () => {
    expect(matchesSearch(node, 'xyz')).toBe(false)
  })

  it('handles node with no tags', () => {
    expect(matchesSearch({ label: 'Note', tags: [] }, 'note')).toBe(true)
    expect(matchesSearch({ label: 'Note' }, 'note')).toBe(true)
  })

  it('handles node with no label', () => {
    expect(matchesSearch({ label: undefined, tags: ['tag'] }, 'tag')).toBe(true)
    expect(matchesSearch({ tags: ['tag'] }, 'xyz')).toBe(false)
  })
})
