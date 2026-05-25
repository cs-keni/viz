import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { forceCollide } from 'd3-force-3d'
import { colorForDegree, isRecentlyAdded, sizeForDegree } from '../utils/colors'
import { isMobile } from '../utils/device'
import InfoPanel from './InfoPanel'

const BACKGROUND_COLOR = '#050820'
const STAR_COUNT = 4000
const STAR_RADIUS = 4000
const LINK_PARTICLE_COLOR = '#a0c0ff'
const COMET_TRAIL = 25
const COMET_TRAIL_DEPTH = 0.18
const ORBIT_RESUME_DELAY = 3000

function shouldUseBloom() {
  if (typeof window === 'undefined') return false
  if (!window.WebGL2RenderingContext) return false
  return !isMobile()
}

// --- degree helpers ---

function baseEmissiveForDegree(degree) {
  if (degree >= 9) return 0.75
  if (degree >= 3) return 0.45
  return 0.2
}

function edgeColorForDegree(degree) {
  if (degree >= 9) return '#d4881a'
  if (degree >= 3) return '#8860cc'
  return '#4a78e0'
}

// --- scene object builders ---

// Cached circular sprite texture — makes Points render as soft circles, not squares
let _circleTex = null
function getCircleTex() {
  if (_circleTex) return _circleTex
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0,   'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  _circleTex = new THREE.CanvasTexture(canvas)
  return _circleTex
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

function spawnComet(scene, spawnT, camera) {
  const camFwd = new THREE.Vector3()
  camera.getWorldDirection(camFwd)
  const camRight = new THREE.Vector3().crossVectors(camFwd, camera.up).normalize()
  const camUp2 = new THREE.Vector3().crossVectors(camRight, camFwd).normalize()

  // Sample a point near the peripheral edge of the forward hemisphere
  // (60-80° from forward) so comets spawn at screen edges and sweep across.
  const mkEdge = () => {
    const coneAngle = (Math.PI / 180) * (60 + Math.random() * 20)
    const spin = Math.random() * Math.PI * 2
    return camFwd.clone()
      .multiplyScalar(Math.cos(coneAngle))
      .addScaledVector(camRight, Math.sin(coneAngle) * Math.cos(spin))
      .addScaledVector(camUp2,  Math.sin(coneAngle) * Math.sin(spin))
      .normalize()
      .multiplyScalar(STAR_RADIUS)
  }

  const start = mkEdge()
  // End point on the opposite side of the screen (negate the spin component)
  // by ensuring it's far enough from start that the comet sweeps across.
  let end = mkEdge()
  let tries = 0
  while (start.distanceTo(end) < STAR_RADIUS * 0.8 && tries++ < 8) {
    end = mkEdge()
  }

  // Trail
  const trailPositions = new Float32Array(COMET_TRAIL * 3)
  const trailColors = new Float32Array(COMET_TRAIL * 3)
  for (let i = 0; i < COMET_TRAIL; i++) {
    trailPositions[i * 3]     = start.x
    trailPositions[i * 3 + 1] = start.y
    trailPositions[i * 3 + 2] = start.z
  }
  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
  const tex = getCircleTex()
  const trailMat = new THREE.PointsMaterial({
    vertexColors: true, size: 3.5, sizeAttenuation: false,
    map: tex, alphaTest: 0.01,
    transparent: true, opacity: 0.6, depthWrite: false,
  })
  const trail = new THREE.Points(trailGeo, trailMat)
  scene.add(trail)

  // Head: pure white, small soft circle
  const headGeo = new THREE.BufferGeometry()
  headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([start.x, start.y, start.z]), 3))
  const headMat = new THREE.PointsMaterial({
    color: '#ffffff', size: 7, sizeAttenuation: false,
    map: tex, alphaTest: 0.01,
    transparent: true, opacity: 0.55, depthWrite: false,
  })
  const head = new THREE.Points(headGeo, headMat)
  scene.add(head)

  return { start, end, spawnT, duration: 0.9 + Math.random() * 0.75, trail, head }
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
    colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.65; colors[i * 3 + 2] = 0.9
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 1.2, vertexColors: true, transparent: true,
    opacity: 0.85, depthWrite: false, sizeAttenuation: false,
  })
  return { points: new THREE.Points(geo, mat), phases }
}

function buildNebulae(scene) {
  return [
    { pos: [-120, 80, -160], r: 320, emissive: '#2a0050', opacity: 0.055 },
    { pos: [200, -120, -120], r: 270, emissive: '#005040', opacity: 0.045 },
    { pos: [-20, -120,  80], r: 370, emissive: '#1a0068', opacity: 0.035 },
  ].map(({ pos, r, emissive, opacity }) => {
    const geo = new THREE.SphereGeometry(r, 32, 32)
    const mat = new THREE.MeshStandardMaterial({
      color: '#000000', emissive, emissiveIntensity: 0.12,
      transparent: true, opacity, depthWrite: false, side: THREE.BackSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(pos[0], pos[1], pos[2])
    scene.add(mesh)
    return mesh
  })
}

// --- tooltip styles ---

const tooltipBase = {
  position: 'fixed',
  background: 'rgba(5, 8, 32, 0.88)',
  border: '1px solid rgba(160, 192, 255, 0.25)',
  color: '#a0c0ff',
  padding: '5px 11px',
  borderRadius: '5px',
  fontSize: '12px',
  fontFamily: "'Inter', system-ui, sans-serif",
  letterSpacing: '0.04em',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 0 16px rgba(74, 80, 160, 0.35)',
  pointerEvents: 'none',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.18s ease, transform 0.18s ease',
}

// --- component ---

export default function Graph3D({ data }) {
  const fgRef = useRef(null)
  const graphRef = useRef(data)
  const bloomAddedRef = useRef(false)
  const hasZoomedToFitRef = useRef(false)
  const startTimeRef = useRef(performance.now())
  const starfieldRef = useRef(null)
  const nebulaeRef = useRef([])
  const cometsRef = useRef([])
  const nextCometRef = useRef(1.5 + Math.random() * 1)
  const selectedNodeRef = useRef(null)
  const neighborSetRef = useRef(new Set())
  const tooltipDivRef = useRef(null)
  const hoveredNodeRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const orbitResumeTimerRef = useRef(null)
  const isAutoRotatingRef = useRef(true)
  const [graphData, setGraphData] = useState(data)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)

  useEffect(() => {
    graphRef.current = data
    setGraphData(data)
  }, [data])

  // Independent rAF loop — runs orbit and comets unconditionally every frame,
  // regardless of whether the physics simulation is still ticking.
  useEffect(() => {
    const axis = new THREE.Vector3(0, 1, 0)
    let rafId

    const tick = () => {
      const fg = fgRef.current
      const t = (performance.now() - startTimeRef.current) / 1000

      // --- Orbit ---
      if (isAutoRotatingRef.current && fg) {
        const camera = fg.camera?.()
        const controls = fg.controls?.()
        if (camera && controls) {
          camera.position.applyAxisAngle(axis, 0.001)
          camera.lookAt(controls.target)
        }
      }

      // --- Comets ---
      if (fg) {
        const scene = fg.scene?.()
        const camera = fg.camera?.()

        // Animate existing comets
        cometsRef.current.forEach((comet) => {
          const progress = (t - comet.spawnT) / comet.duration
          const fadeIn = Math.min(1, progress * 12)
          // Head fades out first (starts at 55%, gone by 82%)
          const headFade = Math.max(0, 1 - Math.max(0, (progress - 0.55) / 0.27))
          // Trail lingers (starts at 70%, gone by 100%)
          const trailFade = Math.max(0, 1 - Math.max(0, (progress - 0.70) / 0.30))
          const headEnv = fadeIn * headFade
          const trailEnv = fadeIn * trailFade

          const tPos = comet.trail.geometry.attributes.position
          const tCol = comet.trail.geometry.attributes.color
          for (let i = 0; i < COMET_TRAIL; i++) {
            const trailT = Math.max(0, progress - (i / COMET_TRAIL) * COMET_TRAIL_DEPTH)
            tPos.setXYZ(
              i,
              comet.start.x + (comet.end.x - comet.start.x) * trailT,
              comet.start.y + (comet.end.y - comet.start.y) * trailT,
              comet.start.z + (comet.end.z - comet.start.z) * trailT,
            )
            // Ice-white trail fading with its own envelope
            const brightness = (1 - i / COMET_TRAIL) * trailEnv
            tCol.setXYZ(i, brightness, brightness * 0.96, brightness * 0.92)
          }
          tPos.needsUpdate = true
          tCol.needsUpdate = true

          const hPos = comet.head.geometry.attributes.position
          hPos.setXYZ(
            0,
            comet.start.x + (comet.end.x - comet.start.x) * progress,
            comet.start.y + (comet.end.y - comet.start.y) * progress,
            comet.start.z + (comet.end.z - comet.start.z) * progress,
          )
          hPos.needsUpdate = true
          comet.head.material.opacity = headEnv * 0.55
        })

        // Remove finished comets
        cometsRef.current = cometsRef.current.filter((comet) => {
          const done = t - comet.spawnT >= comet.duration
          if (done && scene) {
            scene.remove(comet.trail)
            scene.remove(comet.head)
            comet.trail.geometry.dispose()
            comet.trail.material.dispose()
            comet.head.geometry.dispose()
            comet.head.material.dispose()
          }
          return !done
        })

        // Spawn new comet — up to 5 concurrent, interval 1.5-3s
        if (t >= nextCometRef.current && scene && camera && cometsRef.current.length < 5) {
          const fwd = new THREE.Vector3()
          camera.getWorldDirection(fwd)
          if (fwd.lengthSq() > 0.5) {
            cometsRef.current.push(spawnComet(scene, t, camera))
          }
          nextCometRef.current = t + 1.5 + Math.random() * 1.5
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Track mouse position to place tooltip without re-renders
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      if (tooltipDivRef.current && hoveredNodeRef.current) {
        tooltipDivRef.current.style.left = `${e.clientX + 14}px`
        tooltipDivRef.current.style.top  = `${e.clientY - 10}px`
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const setForceGraphRef = useCallback((instance) => {
    fgRef.current = instance
    if (!instance) return

    // Push nodes apart — default charge is too weak for 67 nodes with 175 links
    if (instance.d3Force('charge')) instance.d3Force('charge').strength(-200)
    if (instance.d3Force('link')) instance.d3Force('link').distance(70)
    // Collision force prevents nodes from physically overlapping regardless of link tension
    instance.d3Force('collide', forceCollide(n => sizeForDegree(n.degree) * 2.5 + 12))

    const controls = instance.controls()
    if (controls) {
      controls.maxDistance = 3000
      controls.autoRotate = false  // manual rotation via applyAxisAngle — more reliable across Three.js versions
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      // Pause orbit on grab; resume 3s after release
      controls.addEventListener('start', () => {
        isAutoRotatingRef.current = false
        clearTimeout(orbitResumeTimerRef.current)
      })
      controls.addEventListener('end', () => {
        orbitResumeTimerRef.current = setTimeout(() => {
          isAutoRotatingRef.current = true
        }, ORBIT_RESUME_DELAY)
      })
    }

    if (!starfieldRef.current) {
      const sf = buildStarfield()
      starfieldRef.current = sf
      instance.scene().add(sf.points)
    }

    if (!nebulaeRef.current.length) {
      nebulaeRef.current = buildNebulae(instance.scene())
    }

    // Cap pixel ratio on mobile — phones report 3× DPR which kills GPU throughput
    if (instance.renderer) {
      const renderer = instance.renderer()
      if (renderer) {
        const maxDPR = isMobile() ? 1 : Math.min(2, window.devicePixelRatio)
        renderer.setPixelRatio(maxDPR)
      }
    }

    if (!bloomAddedRef.current && shouldUseBloom()) {
      const composer = instance.postProcessingComposer()
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.4, 0.4, 0.25,
      )
      composer.addPass(bloomPass)
      bloomAddedRef.current = true
    }
  }, [])

  // Ensure auto-orbit is running once physics settles
  const onEngineStop = useCallback(() => {
    if (!hasZoomedToFitRef.current && fgRef.current) {
      fgRef.current.zoomToFit(800, 160)
      hasZoomedToFitRef.current = true
    }
    isAutoRotatingRef.current = true
  }, [])

  const nodeThreeObject = useCallback((node) => {
    const color = colorForDegree(node.degree)
    const radius = sizeForDegree(node.degree)
    const isRecent = isRecentlyAdded(node.created)
    const base = baseEmissiveForDegree(node.degree ?? 0)
    const geometry = new THREE.SphereGeometry(radius, 16, 16)
    const material = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: base,
      roughness: 0.55, metalness: 0.05,
      transparent: true, opacity: 1.0,
    })
    node._phase = Math.random() * Math.PI * 2
    node._glimmerPhase = Math.random() * Math.PI * 2
    node._baseEmissive = isRecent ? Math.min(1.0, base * 1.5) : base
    return new THREE.Mesh(geometry, material)
  }, [])

  const handleDismiss = useCallback(() => {
    selectedNodeRef.current = null
    neighborSetRef.current = new Set()
    setSelectedNodeId(null)
    setSelectedNode(null)
    isAutoRotatingRef.current = false
    clearTimeout(orbitResumeTimerRef.current)
    orbitResumeTimerRef.current = setTimeout(() => {
      isAutoRotatingRef.current = true
    }, ORBIT_RESUME_DELAY)
  }, [])

  const onNodeClick = useCallback((node) => {
    if (selectedNodeRef.current === node.id) {
      handleDismiss()
      return
    }

    // Fly camera to 60 units in front of the node
    const fg = fgRef.current
    if (fg) {
      const camera = fg.camera()
      const nodeVec = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0)
      const camVec = camera.position.clone()
      const dir = nodeVec.clone().sub(camVec)
      if (dir.lengthSq() > 0.01) {
        dir.normalize()
        const targetCamPos = nodeVec.clone().sub(dir.multiplyScalar(60))
        fg.cameraPosition(
          { x: targetCamPos.x, y: targetCamPos.y, z: targetCamPos.z },
          { x: node.x, y: node.y, z: node.z },
          1000,
        )
      }
      isAutoRotatingRef.current = false
      clearTimeout(orbitResumeTimerRef.current)
    }

    const neighbors = new Set([node.id])
    graphRef.current.links?.forEach((link) => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target
      if (srcId === node.id) neighbors.add(tgtId)
      if (tgtId === node.id) neighbors.add(srcId)
    })
    selectedNodeRef.current = node.id
    neighborSetRef.current = neighbors
    setSelectedNodeId(node.id)
    setSelectedNode(node)
  }, [handleDismiss])

  const onBackgroundClick = useCallback(() => {
    handleDismiss()
  }, [handleDismiss])

  const onNodeHover = useCallback((node) => {
    document.body.style.cursor = node ? 'pointer' : ''
    hoveredNodeRef.current = node
    setHoveredNode(node || null)
    if (tooltipDivRef.current) {
      tooltipDivRef.current.style.left = `${mouseRef.current.x + 14}px`
      tooltipDivRef.current.style.top  = `${mouseRef.current.y - 10}px`
    }
  }, [])

  const getLinkColor = useCallback((link) => {
    const src = link.source
    const degree = typeof src === 'object' && src !== null ? (src.degree ?? 0) : 0
    return edgeColorForDegree(degree)
  }, [])

  // Hide non-neighbor links entirely when a node is selected — avoids dark
  // lines rendering on top of the background (Three.js lines ignore alpha).
  const getLinkVisibility = useCallback((link) => {
    if (!selectedNodeId) return true
    const srcId = typeof link.source === 'object' && link.source ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' && link.target ? link.target.id : link.target
    return neighborSetRef.current.has(srcId) || neighborSetRef.current.has(tgtId)
  }, [selectedNodeId])

  const getLinkParticleColor = useCallback(() => LINK_PARTICLE_COLOR, [])

  const onRenderFramePost = useCallback(() => {
    // Keep OrbitControls damping alive (damping decays _sphericalDelta each frame)
    fgRef.current?.controls()?.update()

    const graph = graphRef.current
    if (!graph) return
    const t = (performance.now() - startTimeRef.current) / 1000
    const selId = selectedNodeRef.current

    graph.nodes?.forEach((node) => {
      if (!node.__threeObj) return
      const mat = node.__threeObj.material

      mat.opacity = selId && !neighborSetRef.current.has(node.id) ? 0.08 : 1.0

      const amplitude = node._baseEmissive > 0.5 ? 0.08 : 0.04
      node.__threeObj.scale.setScalar(1 + amplitude * Math.sin(t * 1.2 + (node._phase || 0)))

      // Firefly: oscillates below and above baseEmissive so nodes actually go near-dark
      const glow = Math.sin(t * 0.7 + (node._glimmerPhase || 0)) * 0.3
      mat.emissiveIntensity = Math.max(0, (node._baseEmissive || 0.2) + glow)
    })

    // Star twinkling — each star has its own speed + phase so they never sync
    const sf = starfieldRef.current
    if (sf) {
      const colors = sf.points.geometry.attributes.color
      for (let i = 0; i < STAR_COUNT; i++) {
        const speed = 0.25 + sf.phases[i] * 0.5
        const v = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * speed + sf.phases[i] * 2.0))
        colors.setXYZ(i, v * 0.65, v * 0.7, v)
      }
      colors.needsUpdate = true
    }

    // Slow nebula drift
    nebulaeRef.current.forEach((nebula, i) => {
      nebula.rotation.y = t * 0.012 * (i % 2 === 0 ? 1 : -1)
      nebula.rotation.x = t * 0.007 * (i % 2 === 0 ? -1 : 1)
    })

  }, [])

  return (
    <>
      <ForceGraph3D
        ref={setForceGraphRef}
        graphData={graphData}
        backgroundColor={BACKGROUND_COLOR}
        warmupTicks={100}
        nodeLabel=""
        nodeThreeObject={nodeThreeObject}
        onNodeClick={onNodeClick}
        onBackgroundClick={onBackgroundClick}
        onNodeHover={onNodeHover}
        onEngineStop={onEngineStop}
        linkColor={getLinkColor}
        linkVisibility={getLinkVisibility}
        linkOpacity={0.85}
        linkWidth={1.0}
        linkDirectionalParticles={3}
        linkDirectionalParticleSpeed={0.001}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={getLinkParticleColor}
        onRenderFramePost={onRenderFramePost}
      />
      <div
        ref={tooltipDivRef}
        style={{
          ...tooltipBase,
          opacity: hoveredNode ? 1 : 0,
          transform: hoveredNode ? 'translateY(0)' : 'translateY(5px)',
        }}
      >
        {hoveredNode?.label}
      </div>
      {selectedNode && <InfoPanel node={selectedNode} onDismiss={handleDismiss} />}
    </>
  )
}
