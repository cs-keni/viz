import { useEffect, useState } from 'react'

export function validateGraph(data) {
  if (!Array.isArray(data?.nodes)) {
    throw new Error('graph.json: nodes must be an array')
  }

  if (!Array.isArray(data?.links)) {
    throw new Error('graph.json: links must be an array')
  }

  for (const node of data.nodes) {
    if (!node.id || !node.label) {
      throw new Error('graph.json: node missing id or label')
    }
  }

  return data
}

export function useGraphData(url = '/graph.json') {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    setState({ data: null, loading: true, error: null })

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      })
      .then(validateGraph)
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error })
        }
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return state
}
