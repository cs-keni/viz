export function parseNodeHash(hash) {
  if (!hash || !hash.startsWith('#node=')) return null
  try {
    return decodeURIComponent(hash.slice(6))
  } catch {
    return null
  }
}
