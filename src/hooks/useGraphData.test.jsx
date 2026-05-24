import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGraphData } from './useGraphData'

function HookProbe({ url = '/graph.json' }) {
  const { data, loading, error } = useGraphData(url)

  if (loading) return <div>loading</div>
  if (error) return <div role="alert">{error.message}</div>
  return <div>{data.nodes[0].label}</div>
}

function mockFetch(response) {
  global.fetch = vi.fn().mockResolvedValue(response)
}

afterEach(() => {
  vi.restoreAllMocks()
  delete global.fetch
})

describe('useGraphData', () => {
  it('loads valid graph data', async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          nodes: [{ id: 'Projects/Bobby', label: 'Bobby' }],
          links: [],
        }),
    })

    render(<HookProbe />)

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('Bobby')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/graph.json')
  })

  it('reports HTTP failures', async () => {
    mockFetch({ ok: false, status: 404 })

    render(<HookProbe />)

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
  })

  it('reports malformed JSON', async () => {
    mockFetch({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })

    render(<HookProbe />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected token')
  })

  it('reports invalid schema', async () => {
    mockFetch({
      ok: true,
      json: () => Promise.resolve({ nodes: [{ id: 'missing-label' }], links: [] }),
    })

    render(<HookProbe />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'graph.json: node missing id or label',
      )
    })
  })
})
