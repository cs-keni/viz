import { useEffect, useRef } from 'react'

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function InfoPanel({ node, onDismiss }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // Slide in on mount / node change
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.transform = 'translateX(0) translateY(-50%)'
      panelRef.current.style.opacity = '1'
    }
  }, [node?.id])

  if (!node) return null

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: '50%',
        right: 24,
        transform: 'translateX(32px) translateY(-50%)',
        opacity: 0,
        width: 272,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: 'rgba(5, 8, 32, 0.90)',
        border: '1px solid rgba(160, 192, 255, 0.18)',
        borderRadius: 10,
        padding: '18px 20px',
        boxShadow: '0 0 32px rgba(74, 80, 160, 0.3)',
        backdropFilter: 'blur(14px)',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#a0c0ff',
        transition: 'transform 0.22s ease, opacity 0.22s ease',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 600, color: '#d0e4ff', marginBottom: 10, lineHeight: 1.3 }}>
        {node.label}
      </div>

      {/* Excerpt */}
      <div style={{ fontSize: 12, color: 'rgba(160, 192, 255, 0.72)', lineHeight: 1.6, marginBottom: 14 }}>
        {node.excerpt || 'No preview available.'}
      </div>

      {/* Tags */}
      {node.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {node.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 99,
                background: 'rgba(100, 130, 220, 0.18)',
                border: '1px solid rgba(100, 130, 220, 0.3)',
                color: 'rgba(160, 192, 255, 0.8)',
                letterSpacing: '0.04em',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div style={{ fontSize: 11, color: 'rgba(160, 192, 255, 0.45)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span>{node.degree ?? 0} connection{node.degree !== 1 ? 's' : ''}</span>
        {node.created && <span>{formatDate(node.created)}</span>}
      </div>

      {/* Dismiss hint */}
      <div
        onClick={onDismiss}
        style={{
          marginTop: 16,
          fontSize: 10,
          color: 'rgba(160, 192, 255, 0.3)',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textAlign: 'right',
        }}
      >
        ESC or click away to close
      </div>
    </div>
  )
}
