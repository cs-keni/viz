/**
 * Returns true if the node should be visible at the given date.
 * Nodes without a created date are always visible (present from the beginning).
 */
export function isNodeVisibleAtDate(node, date) {
  if (!node || !node.created || !date) return true
  const created = new Date(node.created)
  if (isNaN(created.getTime())) return true
  return created <= date
}
