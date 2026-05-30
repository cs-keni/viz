import { describe, it, expect } from 'vitest'
import { findPath } from './findPath'

const nodes = [
  { id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' },
]

const links = [
  { source: 'A', target: 'B' },
  { source: 'B', target: 'C' },
  { source: 'C', target: 'D' },
  { source: 'A', target: 'D' },
]

describe('findPath', () => {
  it('returns [id] when source equals target', () => {
    expect(findPath(nodes, links, 'A', 'A')).toEqual(['A'])
  })

  it('finds direct neighbor', () => {
    expect(findPath(nodes, links, 'A', 'B')).toEqual(['A', 'B'])
  })

  it('finds shortest path (1-hop direct vs 3-hop indirect)', () => {
    expect(findPath(nodes, links, 'A', 'D')).toEqual(['A', 'D'])
  })

  it('finds 2-hop path', () => {
    expect(findPath(nodes, links, 'A', 'C')).toEqual(['A', 'B', 'C'])
  })

  it('graph is undirected — works in both directions', () => {
    expect(findPath(nodes, links, 'D', 'A')).toEqual(['D', 'A'])
    expect(findPath(nodes, links, 'C', 'A')).toEqual(['C', 'B', 'A'])
  })

  it('returns null when no path exists (disconnected node)', () => {
    expect(findPath(nodes, links, 'A', 'E')).toBeNull()
  })

  it('returns null for node not in graph', () => {
    expect(findPath(nodes, links, 'A', 'Z')).toBeNull()
  })

  it('works with object-style source/target (force-graph runtime format)', () => {
    const runtimeLinks = [
      { source: { id: 'A' }, target: { id: 'B' } },
      { source: { id: 'B' }, target: { id: 'C' } },
    ]
    expect(findPath(nodes, runtimeLinks, 'A', 'C')).toEqual(['A', 'B', 'C'])
  })

  it('handles empty nodes/links', () => {
    expect(findPath([], [], 'A', 'B')).toBeNull()
  })
})
