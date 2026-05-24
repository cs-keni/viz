import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { colorForDegree, isRecentlyAdded, sizeForDegree } from '../utils/colors'
import { isMobile } from '../utils/device'

const BACKGROUND_COLOR = '#050820'
const STAR_COUNT = 1500
const STAR_RADIUS = 800
const LINK_COLOR = '#3a4f8a'
const LINK_PARTICLE_COLOR = '#a0c0ff'
const COMET_TRAIL = 30
const COMET_TRAIL_DEPTH = 0.15

function shouldUseBloom() {
  if (typeof window === 'undefined') return false
  if (!window.WebGL2RenderingContext) return false
  return !isMobile()
}

function randomOnSphere(r) {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  )
}

function spawnComet(scene, spawnT) {
  const start = randomOnSphere(STAR_RADIUS)
  let end = randomOnSphere(STAR_RADIUS)
  // Ensure enough angular separation so the comet travels a visible arc
  while (start.dot(end) / (STAR_RADIUS * STAR_RADIUS) > 0.6) {
    end = randomOnSphere(STAR_RADIUS)
  }

  const positions = new Float32Array(COMET_TRAIL * 3)
  const colors = new Float32Array(COMET_TRAIL * 3)
  for (let i = 0; i < COMET_TRAIL; i++) {
    positions[i * 3]     = start.x
    positions[i * 3 + 1] = start.y
    positions[i * 3 + 2] = start.z
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthWrite: false })
  const line = new THREE.Line(geo, mat)
  scene.add(line)

  return { start, end, spawnT, duration: 2.0 + Math.random() * 1.5, object: line }
}

function buildStarfield() {
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const phases = new Float32Array(STAR_COUNT)

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3]     = STAR_RADIUS * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = STAR_RADIUS * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = STAR_RADIUS * Math.cos(phi)
    phases[i] = Math.random() * Math.PI * 2
    colors[i * 3]     = 0.6
    colors[i * 3 + 1] = 0.65
    colors[i * 3 + 2] = 0.9
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: false,
  })
  return { points: new THREE.Points(geo, mat), phases }
}

export default function Graph3D({ data }) {
  const fgRef = useRef(null)
  const graphRef = useRef(data)
  const bloomAddedRef = useRef(false)
  const startTimeRef = useRef(performance.now())
  const starfieldRef = useRef(null)
  const cometsRef = useRef([])
  const nextCometRef = useRef(5 + Math.random() * 3)
  const [graphData, setGraphData] = useState(data)

  useEffect(() => {
    graphRef.current = data
    setGraphData(data)
  }, [data])

  const setForceGraphRef = useCallback((instance) => {
    fgRef.current = instance
    if (!instance) return

    if (!starfieldRef.current) {
      const sf = buildStarfield()
      starfieldRef.current = sf
      instance.scene().add(sf.points)
    }

    if (!bloomAddedRef.current && shouldUseBloom()) {
      const composer = instance.postProcessingComposer()
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2,
        0.4,
        0.2,
      )
      composer.addPass(bloomPass)
      bloomAddedRef.current = true
    }
  }, [])

  const nodeThreeObject = useCallback((node) => {
    const color = colorForDegree(node.degree)
    const radius = sizeForDegree(node.degree)
    const isRecent = isRecentlyAdded(node.created)
    const geometry = new THREE.SphereGeometry(radius, 16, 16)
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: isRecent ? 0.6 : 0.2,
      roughness: 0.55,
      metalness: 0.05,
    })
    node._phase = Math.random() * Math.PI * 2
    node._glimmerPhase = Math.random() * Math.PI * 2
    node._baseEmissive = isRecent ? 0.6 : 0.2
    return new THREE.Mesh(geometry, material)
  }, [])

  const onRenderFramePost = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const t = (performance.now() - startTimeRef.current) / 1000

    // Breathing pulse + glimmer (glimmer at 1.0 vs previous 2.0 — 50% slower)
    graph.nodes?.forEach((node) => {
      if (!node.__threeObj) return
      const amplitude = node._baseEmissive > 0.3 ? 0.08 : 0.04
      node.__threeObj.scale.setScalar(1 + amplitude * Math.sin(t * 1.2 + (node._phase || 0)))
      const glimmer = Math.pow(Math.max(0, Math.sin(t * 1.0 + (node._glimmerPhase || 0))), 8) * 0.45
      const mat = node.__threeObj.material
      if (mat) mat.emissiveIntensity = (node._baseEmissive || 0.2) + glimmer
    })

    // Star twinkling
    const sf = starfieldRef.current
    if (sf) {
      const colors = sf.points.geometry.attributes.color
      for (let i = 0; i < STAR_COUNT; i++) {
        const v = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + sf.phases[i] * 1.2) + sf.phases[i]))
        colors.setXYZ(i, v * 0.7, v * 0.75, v)
      }
      colors.needsUpdate = true
    }

    // Update and draw active comets
    const scene = fgRef.current?.scene()
    cometsRef.current.forEach((comet) => {
      const progress = (t - comet.spawnT) / comet.duration
      const positions = comet.object.geometry.attributes.position
      const cColors = comet.object.geometry.attributes.color

      for (let i = 0; i < COMET_TRAIL; i++) {
        const trailT = Math.max(0, progress - (i / COMET_TRAIL) * COMET_TRAIL_DEPTH)
        positions.setXYZ(
          i,
          comet.start.x + (comet.end.x - comet.start.x) * trailT,
          comet.start.y + (comet.end.y - comet.start.y) * trailT,
          comet.start.z + (comet.end.z - comet.start.z) * trailT,
        )
        // Head white, tail fades; envelope fades in fast and out slow
        const envelope = Math.min(1, progress * 10) * Math.min(1, (1 - progress) * 5)
        const brightness = (1 - i / COMET_TRAIL) * envelope
        // Slight blue tint on the trail
        cColors.setXYZ(i, brightness * 0.9, brightness * 0.95, brightness)
      }
      positions.needsUpdate = true
      cColors.needsUpdate = true
    })

    // Remove finished comets and clean up GPU resources
    cometsRef.current = cometsRef.current.filter((comet) => {
      const done = t - comet.spawnT >= comet.duration
      if (done && scene) {
        scene.remove(comet.object)
        comet.object.geometry.dispose()
        comet.object.material.dispose()
      }
      return !done
    })

    // Spawn next comet when scheduled (max 2 simultaneous)
    if (t >= nextCometRef.current && scene && cometsRef.current.length < 2) {
      cometsRef.current.push(spawnComet(scene, t))
      nextCometRef.current = t + 8 + Math.random() * 7
    }
  }, [])

  return (
    <ForceGraph3D
      ref={setForceGraphRef}
      graphData={graphData}
      backgroundColor={BACKGROUND_COLOR}
      warmupTicks={100}
      nodeLabel="label"
      nodeThreeObject={nodeThreeObject}
      linkColor={LINK_COLOR}
      linkOpacity={0.25}
      linkWidth={0.5}
      linkDirectionalParticles={3}
      linkDirectionalParticleSpeed={0.002}
      linkDirectionalParticleWidth={1.5}
      linkDirectionalParticleColor={LINK_PARTICLE_COLOR}
      onRenderFramePost={onRenderFramePost}
    />
  )
}
