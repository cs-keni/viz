import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { colorForDegree, isRecentlyAdded, sizeForDegree } from '../utils/colors'

const BACKGROUND_COLOR = '#050820'
const PARTICLE_COUNT = 5
const PARTICLE_SPEED = 0.003

function shouldUseBloom() {
  if (typeof window === 'undefined') return false
  if (!window.WebGL2RenderingContext) return false
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator?.userAgent ?? '',
  )
}

function linkKey(link) {
  return link.__indexColor ?? `${link.source?.id ?? link.source}->${link.target?.id ?? link.target}`
}

function linkEndpoint(endpoint) {
  return typeof endpoint === 'object' && endpoint !== null ? endpoint : null
}

function hasPosition(node) {
  return (
    node &&
    Number.isFinite(node.x) &&
    Number.isFinite(node.y) &&
    Number.isFinite(node.z)
  )
}

export default function Graph3D({ data }) {
  const fgRef = useRef(null)
  const graphRef = useRef(data)
  const particleMapRef = useRef(new Map())
  const bloomAddedRef = useRef(false)
  const startTimeRef = useRef(performance.now())
  const [graphData, setGraphData] = useState(data)

  useEffect(() => {
    graphRef.current = data
    particleMapRef.current.clear()
    setGraphData(data)
  }, [data])

  const setForceGraphRef = useCallback((instance) => {
    fgRef.current = instance

    if (!instance || bloomAddedRef.current || !shouldUseBloom()) return

    const composer = instance.postProcessingComposer()
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,
      0.4,
      0.2,
    )
    composer.addPass(bloomPass)
    bloomAddedRef.current = true
  }, [])

  const nodeThreeObject = useCallback((node) => {
    const color = colorForDegree(node.degree)
    const radius = sizeForDegree(node.degree)
    const geometry = new THREE.SphereGeometry(radius, 16, 16)
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: isRecentlyAdded(node.created) ? 0.6 : 0.2,
      roughness: 0.55,
      metalness: 0.05,
    })

    node._phase = Math.random() * Math.PI * 2
    return new THREE.Mesh(geometry, material)
  }, [])

  const linkThreeObject = useCallback((link) => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      opacity: 0.6,
      transparent: true,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      t: index / PARTICLE_COUNT,
    }))

    particleMapRef.current.set(linkKey(link), { points, particles, link })
    return points
  }, [])

  const onRenderFramePost = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return

    const elapsedSeconds = (performance.now() - startTimeRef.current) / 1000

    graph.nodes?.forEach((node) => {
      if (node.__threeObj) {
        const amplitude = isRecentlyAdded(node.created) ? 0.08 : 0.04
        const scale = 1 + amplitude * Math.sin(elapsedSeconds * 1.2 + (node._phase || 0))
        node.__threeObj.scale.setScalar(scale)
      }
    })

    particleMapRef.current.forEach(({ points, particles, link }) => {
      const source = linkEndpoint(link.source)
      const target = linkEndpoint(link.target)
      if (!hasPosition(source) || !hasPosition(target)) return

      const position = points.geometry.attributes.position
      particles.forEach((particle, index) => {
        particle.t = (particle.t + PARTICLE_SPEED) % 1
        position.setXYZ(
          index,
          source.x + (target.x - source.x) * particle.t,
          source.y + (target.y - source.y) * particle.t,
          source.z + (target.z - source.z) * particle.t,
        )
      })
      position.needsUpdate = true
    })
  }, [])

  return (
    <ForceGraph3D
      ref={setForceGraphRef}
      graphData={graphData}
      backgroundColor={BACKGROUND_COLOR}
      warmupTicks={100}
      nodeLabel="label"
      nodeThreeObject={nodeThreeObject}
      linkThreeObject={linkThreeObject}
      onRenderFramePost={onRenderFramePost}
    />
  )
}
