export function matchesSearch(node, query) {
  if (!query) return true
  const q = query.toLowerCase().trim()
  if (!q) return true
  const label = (node.label ?? '').toLowerCase()
  const tags = (node.tags ?? []).join(' ').toLowerCase()
  return label.includes(q) || tags.includes(q)
}
