/**
 * BFS shortest path between two node IDs.
 * Returns ordered array of node IDs (inclusive of source and target),
 * or null if no path exists.
 */
export function findPath(nodes, links, sourceId, targetId) {
  if (sourceId === targetId) return [sourceId]

  const adj = new Map()
  for (const n of nodes) adj.set(n.id, [])
  for (const link of links) {
    const src = typeof link.source === 'object' ? link.source.id : link.source
    const tgt = typeof link.target === 'object' ? link.target.id : link.target
    adj.get(src)?.push(tgt)
    adj.get(tgt)?.push(src)
  }

  const parent = new Map([[sourceId, null]])
  const queue = [sourceId]

  while (queue.length) {
    const cur = queue.shift()
    if (cur === targetId) {
      const path = []
      let node = targetId
      while (node !== null) {
        path.unshift(node)
        node = parent.get(node)
      }
      return path
    }
    for (const neighbor of (adj.get(cur) ?? [])) {
      if (!parent.has(neighbor)) {
        parent.set(neighbor, cur)
        queue.push(neighbor)
      }
    }
  }

  return null
}
