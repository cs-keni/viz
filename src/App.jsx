import React, { Suspense } from 'react'
import { useGraphData } from './hooks/useGraphData'
import './App.css'

const Graph3D = React.lazy(() => import('./components/Graph3D'))

function LoadingSkeleton() {
  return (
    <div className="loading-shell">
      <div className="spinner" aria-hidden="true" />
      <p>Loading graph</p>
    </div>
  )
}

function ErrorCard({ error }) {
  return (
    <main className="app-fallback">
      <section className="error-card" role="alert">
        <h1>Graph unavailable</h1>
        <p>{error.message}</p>
      </section>
    </main>
  )
}

function App() {
  const { data, loading, error } = useGraphData()

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorCard error={error} />

  return (
    <main className="graph-page">
      <Suspense fallback={<LoadingSkeleton />}>
        <Graph3D data={data} />
      </Suspense>
    </main>
  )
}

export default App
