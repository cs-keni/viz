function relativeTime(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

export default function StatsOverlay({ data }) {
  if (!data) return null

  const nodeCount = data.nodes?.length ?? 0
  const linkCount = data.links?.length ?? 0
  const updated = relativeTime(data.generated_at)

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      color: 'rgba(160, 192, 255, 0.55)',
      fontSize: 11,
      fontFamily: "'Inter', system-ui, sans-serif",
      letterSpacing: '0.06em',
      pointerEvents: 'none',
      userSelect: 'none',
      lineHeight: 1,
    }}>
      {nodeCount} notes · {linkCount} connections{updated ? ` · Updated ${updated}` : ''}
    </div>
  )
}
