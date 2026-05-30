import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { forceCollide } from 'd3-force-3d'
import { colorForDegree, isRecentlyAdded, sizeForDegree } from '../utils/colors'
import { isMobile } from '../utils/device'
import InfoPanel from './InfoPanel'
import { parseNodeHash } from '../utils/parseNodeHash'
import { matchesSearch } from '../utils/matchesSearch'

const BACKGROUND_COLOR = '#050820'
const STAR_COUNT = 6000
const STAR_RADIUS = 6000
const LINK_PARTICLE_COLOR = '#a0c0ff'
const COMET_TRAIL = 25
const COMET_TRAIL_DEPTH = 0.18
const ORBIT_RESUME_DELAY = 3000
const TIMELINE_PLAY_DURATION_SEC = 30
const TIMELINE_LINK_DEBOUNCE_MS = 200
const TIMELINE_FADE_MS = 3 * 86400 * 1000
const SEARCH_RESULT_LIMIT = 8

const Y_AXIS = new THREE.Vector3(0, 1, 0)

const TRACKER_MAT = new THREE.MeshBasicMaterial()
const _trackerGeos = {}

function getTopHubs(nodes, n) {
  return [...nodes].sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0)).slice(0, n)
}

const WIDE_SHOT = {
  key: 'WIDE',
  duration: 12000,
  setup: () => ({ pos: null, pivot: new THREE.Vector3(0, 0, 0), speed: 0.0008 }),
}

const CINEMATIC_SHOTS = [
  WIDE_SHOT,
  {
    key: 'HUB_0',
    duration: 10000,
    setup: (nodes) => {
      const hub = getTopHubs(nodes, 3)[0]
      if (!hub?.x && !hub?.y && !hub?.z) return null
      const pivot = new THREE.Vector3(hub.x ?? 0, hub.y ?? 0, hub.z ?? 0)
      return { pos: { x: pivot.x, y: pivot.y + 40, z: pivot.z + 130 }, pivot, speed: 0.0016 }
    },
  },
  WIDE_SHOT,
  {
    key: 'UNDERWORLD',
    duration: 11000,
    setup: () => ({ pos: { x: 80, y: -360, z: 320 }, pivot: new THREE.Vector3(0, 0, 0), speed: 0.0007 }),
  },
  {
    key: 'POLAR',
    duration: 11000,
    setup: () => ({ pos: { x: 60, y: 580, z: 100 }, pivot: new THREE.Vector3(0, 0, 0), speed: 0.0006 }),
  },
  WIDE_SHOT,
  {
    key: 'SIDE',
    duration: 12000,
    setup: () => ({ pos: { x: 620, y: 60, z: 80 }, pivot: new THREE.Vector3(0, 0, 0), speed: 0.0007 }),
  },
  {
    key: 'HUB_1',
    duration: 10000,
    setup: (nodes) => {
      const hubs = getTopHubs(nodes, 3)
      const hub = hubs[1] ?? hubs[0]
      if (!hub?.x && !hub?.y && !hub?.z) return null
      const pivot = new THREE.Vector3(hub.x ?? 0, hub.y ?? 0, hub.z ?? 0)
      return { pos: { x: pivot.x - 90, y: pivot.y + 50, z: pivot.z + 120 }, pivot, speed: 0.0014 }
    },
  },
]

function shouldUseBloom() {
  if (typeof window === 'undefined') return false
  if (!window.WebGL2RenderingContext) return false
  return !isMobile()
}

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

function spawnComet(scene, spawnT, camera) {
  const camFwd = new THREE.Vector3()
  camera.getWorldDirection(camFwd)
  const camRight = new THREE.Vector3().crossVectors(camFwd, camera.up).normalize()
  const camUp2 = new THREE.Vector3().crossVectors(camRight, camFwd).normalize()

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
  let end = mkEdge()
  let tries = 0
  while (start.distanceTo(end) < STAR_RADIUS * 0.8 && tries++ < 8) end = mkEdge()

  const trailPositions = new Float32Array(COMET_TRAIL * 3)
  const trailColors = new Float32Array(COMET_TRAIL * 3)
  for (let i = 0; i < COMET_TRAIL; i++) {
    trailPositions[i * 3] = start.x
    trailPositions[i * 3 + 1] = start.y
    trailPositions[i * 3 + 2] = start.z
  }
  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
  const tex = getCircleTex()
  const trailMat = new THREE.PointsMaterial({
    vertexColors: true, size: 3.5, sizeAttenuation: false,
    map: tex, alphaTest: 0.01, transparent: true, opacity: 0.6, depthWrite: false,
  })
  const trail = new THREE.Points(trailGeo, trailMat)
  scene.add(trail)

  const headGeo = new THREE.BufferGeometry()
  headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([start.x, start.y, start.z]), 3))
  const headMat = new THREE.PointsMaterial({
    color: '#ffffff', size: 7, sizeAttenuation: false,
    map: tex, alphaTest: 0.01, transparent: true, opacity: 0.55, depthWrite: false,
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

const spacePanel = {
  background: 'rgba(5, 8, 32, 0.88)',
  border: '1px solid rgba(160, 192, 255, 0.22)',
  backdropFilter: 'blur(12px)',
  borderRadius: 8,
  fontFamily: "'Inter', system-ui, sans-serif",
  color: '#a0c0ff',
  boxShadow: '0 0 24px rgba(74, 80, 160, 0.3)',
}

// --- component ---

export default function Graph3D({ data }) {
  const fgRef = useRef(null)
  const graphRef = useRef(data)
  const bloomAddedRef = useRef(false)
  const hasZoomedToFitRef = useRef(false)
  const startTimeRef = useRef(performance.now())
  const frameCountRef = useRef(0)
  const prevTRef = useRef(null)
  const instancedMeshRef = useRef({ low: null, mid: null, high: null })
  const instanceInitializedRef = useRef(false)
  const dummyRef = useRef(new THREE.Object3D())
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
  const cinematicRef = useRef({ shotIndex: 0, pivot: new THREE.Vector3(0, 0, 0), speed: 0.0008, nextShotAt: 0 })
  const advanceShotRef = useRef(null)
  const nodeMapRef = useRef(new Map())
  // F2
  const selectNodeRef = useRef(null)
  // F1
  const searchQueryRef = useRef('')
  const searchInputRef = useRef(null)
  // F5
  const timelineDateRef = useRef(null)
  const timelinePlayingRef = useRef(false)
  const timelineMinRef = useRef(0)
  const timelineMaxRef = useRef(Date.now())
  const timelineLinkTimerRef = useRef(null)
  const timelineWasPlayingRef = useRef(false)

  const [graphData, setGraphData] = useState(data)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [timelineActive, setTimelineActive] = useState(false)
  const [timelineDate, setTimelineDate] = useState(0)
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const [timelineLinkDate, setTimelineLinkDate] = useState(null)

  // Live search results — computed from current query and graph nodes
  const searchResults = useMemo(() => {
    if (!searchQuery) return []
    return (graphData?.nodes ?? []).filter(n => matchesSearch(n, searchQuery))
  }, [searchQuery, graphData])

  useEffect(() => {
    graphRef.current = data
    setGraphData(data)
    nodeMapRef.current = new Map(data?.nodes?.map(n => [n.id, n]) ?? [])
    const dateMsArr = (data?.nodes ?? [])
      .map(n => n.created ? new Date(n.created).getTime() : null)
      .filter(Boolean)
    if (dateMsArr.length) {
      timelineMinRef.current = Math.min(...dateMsArr)
      timelineMaxRef.current = Math.max(...dateMsArr)
    }
  }, [data])

  // Independent rAF loop — drives orbit, comets, InstancedMesh sync, stars, nebulae.
  useEffect(() => {
    let rafId

    const BUCKET_PHASES = { low: 0, mid: 2.2, high: 4.4 }
    const BUCKET_BASE_EI = { low: 0.2, mid: 0.45, high: 0.75 }

    const tick = () => {
      const nowMs = performance.now()
      const t = (nowMs - startTimeRef.current) / 1000
      const dt = prevTRef.current !== null ? t - prevTRef.current : 1 / 60
      prevTRef.current = t
      const frame = ++frameCountRef.current

      const fg = fgRef.current
      const camera = fg?.camera?.()
      const controls = fg?.controls?.()

      // --- Cinematic orbit + shot timer ---
      if (isAutoRotatingRef.current && fg && camera && controls) {
        const c = cinematicRef.current
        camera.position.sub(c.pivot)
        camera.position.applyAxisAngle(Y_AXIS, c.speed)
        camera.position.add(c.pivot)
        camera.lookAt(c.pivot)
        controls.target.copy(c.pivot)
        if (c.nextShotAt > 0 && nowMs >= c.nextShotAt) {
          c.nextShotAt = 0
          advanceShotRef.current?.()
        }
      }

      // --- Comets ---
      if (fg) {
        const scene = fg.scene?.()

        cometsRef.current.forEach((comet) => {
          const progress = (t - comet.spawnT) / comet.duration
          const fadeIn = Math.min(1, progress * 12)
          const headFade = Math.max(0, 1 - Math.max(0, (progress - 0.55) / 0.27))
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

        cometsRef.current = cometsRef.current.filter((comet) => {
          const done = t - comet.spawnT >= comet.duration
          if (done && scene) {
            scene.remove(comet.trail); scene.remove(comet.head)
            comet.trail.geometry.dispose(); comet.trail.material.dispose()
            comet.head.geometry.dispose(); comet.head.material.dispose()
          }
          return !done
        })

        if (t >= nextCometRef.current && scene && camera && cometsRef.current.length < 5) {
          const fwd = new THREE.Vector3()
          camera.getWorldDirection(fwd)
          if (fwd.lengthSq() > 0.5) cometsRef.current.push(spawnComet(scene, t, camera))
          nextCometRef.current = t + 1.5 + Math.random() * 1.5
        }
      }

      // --- F5: Timeline play advancement ---
      if (timelinePlayingRef.current) {
        const totalMs = Math.max(timelineMaxRef.current - timelineMinRef.current, 1)
        const advance = (totalMs / TIMELINE_PLAY_DURATION_SEC) * dt
        const curMs = timelineDateRef.current?.getTime() ?? timelineMinRef.current
        const next = Math.min(curMs + advance, timelineMaxRef.current)
        timelineDateRef.current = new Date(next)
        if (next >= timelineMaxRef.current) {
          timelinePlayingRef.current = false
          setTimelinePlaying(false)
          // Restore cinematic orbit after play ends
          isAutoRotatingRef.current = true
          cinematicRef.current.nextShotAt = performance.now() + 2000
        }
        if (frame % 6 === 0) setTimelineDate(next)
        if (frame % 30 === 0) setTimelineLinkDate(timelineDateRef.current)
      }

      // --- InstancedMesh: init once positions are ready, then sync every 2nd frame ---
      if (!instanceInitializedRef.current) {
        const graph = graphRef.current
        const n0 = graph?.nodes?.[0]
        if (n0?._radius !== undefined && n0?.x !== undefined) initInstancedMeshes()
      }
      if (frame % 2 === 0 && instanceInitializedRef.current) {
        const graph = graphRef.current
        const meshes = instancedMeshRef.current
        const dummy = dummyRef.current
        const dirty = { low: false, mid: false, high: false }
        const tlDate = timelineDateRef.current
        const tlDateMs = tlDate ? tlDate.getTime() : 0

        graph?.nodes?.forEach((node) => {
          if (node._bucket === undefined || node._instanceIdx === undefined) return
          const mesh = meshes[node._bucket]
          if (!mesh) return

          const amplitude = node._baseEmissive > 0.5 ? 0.08 : 0.04
          const pulse = 1 + amplitude * Math.sin(t * 1.2 + (node._phase || 0))

          let scale
          if (tlDate) {
            const hidden = node._createdMs != null && node._createdMs > tlDateMs
            if (hidden) {
              scale = 0
            } else {
              const ageMs = tlDateMs - (node._createdMs ?? tlDateMs)
              const fadeIn = node._createdMs ? Math.min(1, ageMs / TIMELINE_FADE_MS) : 1
              scale = (node._radius ?? 1) * pulse * fadeIn
            }
          } else {
            scale = (node._radius ?? 1) * pulse
          }

          dummy.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0)
          dummy.scale.setScalar(scale)
          dummy.updateMatrix()
          mesh.setMatrixAt(node._instanceIdx, dummy.matrix)
          dirty[node._bucket] = true
        })

        Object.entries(BUCKET_PHASES).forEach(([key, phase]) => {
          const mesh = meshes[key]
          if (mesh?.material) {
            const base = BUCKET_BASE_EI[key]
            mesh.material.emissiveIntensity = Math.max(0, base + Math.sin(t * 0.7 + phase) * 0.3)
          }
          if (dirty[key]) mesh.instanceMatrix.needsUpdate = true
        })
      }

      // --- Star twinkling ---
      const sf = starfieldRef.current
      if (sf && frame % 3 === 0) {
        const colors = sf.points.geometry.attributes.color
        for (let i = 0; i < STAR_COUNT; i++) {
          const speed = 0.25 + sf.phases[i] * 0.5
          const v = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * speed + sf.phases[i] * 2.0))
          colors.setXYZ(i, v * 0.65, v * 0.7, v)
        }
        colors.needsUpdate = true
      }

      // --- Slow nebula drift ---
      nebulaeRef.current.forEach((nebula, i) => {
        nebula.rotation.y = t * 0.012 * (i % 2 === 0 ? 1 : -1)
        nebula.rotation.x = t * 0.007 * (i % 2 === 0 ? -1 : 1)
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const advanceShot = useCallback(() => {
    const fg = fgRef.current
    const nodes = graphRef.current?.nodes ?? []
    if (!fg) return
    const c = cinematicRef.current
    let idx = (c.shotIndex + 1) % CINEMATIC_SHOTS.length
    for (let tries = 0; tries < CINEMATIC_SHOTS.length; tries++) {
      const shot = CINEMATIC_SHOTS[idx]
      const cfg = shot.setup(nodes)
      if (cfg) {
        c.shotIndex = idx
        c.pivot.copy(cfg.pivot)
        c.speed = cfg.speed
        if (cfg.pos) {
          const cam = fg.camera?.()
          const ctrl = fg.controls?.()
          if (cam && ctrl) {
            cam.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z)
            ctrl.target.copy(cfg.pivot)
            ctrl.update()
          }
        }
        c.nextShotAt = performance.now() + shot.duration
        return
      }
      idx = (idx + 1) % CINEMATIC_SHOTS.length
    }
  }, [])

  useEffect(() => { advanceShotRef.current = advanceShot }, [advanceShot])

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
    if (instance.d3Force('charge')) instance.d3Force('charge').strength(-200)
    if (instance.d3Force('link')) instance.d3Force('link').distance(70)
    instance.d3Force('collide', forceCollide(n => sizeForDegree(n.degree) * 2.5 + 12))

    const controls = instance.controls()
    if (controls) {
      controls.maxDistance = 4500
      controls.autoRotate = false
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.addEventListener('start', () => {
        // Don't interrupt camera movement during timeline play
        if (timelineWasPlayingRef.current) return
        isAutoRotatingRef.current = false
        clearTimeout(orbitResumeTimerRef.current)
        cinematicRef.current.nextShotAt = 0
      })
      controls.addEventListener('end', () => {
        if (timelineWasPlayingRef.current) return
        orbitResumeTimerRef.current = setTimeout(() => {
          isAutoRotatingRef.current = true
          const selId = selectedNodeRef.current
          if (selId) {
            const node = graphRef.current?.nodes?.find(n => n.id === selId)
            if (node?.x != null) {
              cinematicRef.current.pivot.set(node.x, node.y ?? 0, node.z ?? 0)
              cinematicRef.current.speed = 0.0016
              cinematicRef.current.nextShotAt = Infinity
              return
            }
          }
          cinematicRef.current.nextShotAt = performance.now() + 2000
        }, ORBIT_RESUME_DELAY)
      })
    }

    if (!starfieldRef.current) {
      const sf = buildStarfield()
      starfieldRef.current = sf
      instance.scene().add(sf.points)
    }
    if (!nebulaeRef.current.length) nebulaeRef.current = buildNebulae(instance.scene())

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

  const initInstancedMeshes = useCallback(() => {
    if (instanceInitializedRef.current) return
    const fg = fgRef.current
    const graph = graphRef.current
    if (!fg || !graph?.nodes?.length) return

    const scene = fg.scene()
    const nodes = graph.nodes
    const buckets = { low: [], mid: [], high: [] }
    nodes.forEach(node => {
      const b = (node.degree ?? 0) >= 9 ? 'high' : (node.degree ?? 0) >= 3 ? 'mid' : 'low'
      node._bucket = b
      node._instanceIdx = buckets[b].length
      buckets[b].push(node)
    })

    const BUCKET_CFG = {
      low:  { segs: 6,  color: '#7B8CDE', ei: 0.2  },
      mid:  { segs: 8,  color: '#C4A0E8', ei: 0.45 },
      high: { segs: 12, color: '#F4C87B', ei: 0.75 },
    }
    const dummy = dummyRef.current

    Object.entries(BUCKET_CFG).forEach(([key, cfg]) => {
      const list = buckets[key]
      if (!list.length) return
      const geo = new THREE.SphereGeometry(1, cfg.segs, cfg.segs)
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color, emissive: cfg.color, emissiveIntensity: cfg.ei,
        roughness: 0.55, metalness: 0.05,
      })
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      list.forEach((node, i) => {
        dummy.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0)
        dummy.scale.setScalar(node._radius ?? 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      scene.add(mesh)
      instancedMeshRef.current[key] = mesh
    })

    instanceInitializedRef.current = true
  }, [])

  const applySelectionColors = useCallback(() => {
    if (!instanceInitializedRef.current) return
    const graph = graphRef.current
    if (!graph?.nodes) return
    const selId = selectedNodeRef.current
    const neighbors = neighborSetRef.current
    const bright = new THREE.Color(1, 1, 1)
    const dim = new THREE.Color(0.08, 0.08, 0.08)
    const meshes = instancedMeshRef.current
    graph.nodes.forEach(node => {
      if (node._bucket === undefined || node._instanceIdx === undefined) return
      const mesh = meshes[node._bucket]
      if (!mesh) return
      mesh.setColorAt(node._instanceIdx, selId && !neighbors.has(node.id) ? dim : bright)
    })
    Object.values(meshes).forEach(m => { if (m?.instanceColor) m.instanceColor.needsUpdate = true })
  }, [])

  const applySearchColors = useCallback((query) => {
    if (!instanceInitializedRef.current) return
    const graph = graphRef.current
    if (!graph?.nodes) return
    const bright = new THREE.Color(1, 1, 1)
    const dim = new THREE.Color(0.08, 0.08, 0.08)
    const meshes = instancedMeshRef.current
    graph.nodes.forEach(node => {
      if (node._bucket === undefined || node._instanceIdx === undefined) return
      const mesh = meshes[node._bucket]
      if (!mesh) return
      mesh.setColorAt(node._instanceIdx, (!query || matchesSearch(node, query)) ? bright : dim)
    })
    Object.values(meshes).forEach(m => { if (m?.instanceColor) m.instanceColor.needsUpdate = true })
  }, [])

  const handleDismiss = useCallback(() => {
    selectedNodeRef.current = null
    neighborSetRef.current = new Set()
    setSelectedNodeId(null)
    setSelectedNode(null)
    applySelectionColors()
    history.replaceState(null, '', location.pathname + location.search)
    isAutoRotatingRef.current = false
    clearTimeout(orbitResumeTimerRef.current)
    cinematicRef.current.nextShotAt = 0
    orbitResumeTimerRef.current = setTimeout(() => {
      isAutoRotatingRef.current = true
      cinematicRef.current.nextShotAt = performance.now() + 2000
    }, ORBIT_RESUME_DELAY)
  }, [applySelectionColors])

  const onNodeClick = useCallback((node, event) => {
    // F1: clear active search when clicking a node
    if (searchQueryRef.current) {
      searchQueryRef.current = ''
      setSearchQuery('')
    }

    if (selectedNodeRef.current === node.id) {
      handleDismiss()
      return
    }

    const fg = fgRef.current
    if (fg) {
      const camera = fg.camera()
      const nodeVec = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0)
      const dir = nodeVec.clone().sub(camera.position.clone())
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
      cinematicRef.current.nextShotAt = 0
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
    applySelectionColors()
    setSelectedNodeId(node.id)
    setSelectedNode(node)

    // F2: update URL hash
    history.replaceState(null, '', '#node=' + encodeURIComponent(node.id))
  }, [handleDismiss, applySelectionColors])

  // Keep selectNodeRef current so onEngineStop can call onNodeClick after graph settles
  useEffect(() => { selectNodeRef.current = onNodeClick }, [onNodeClick])

  const onEngineStop = useCallback(() => {
    isAutoRotatingRef.current = true
    if (!hasZoomedToFitRef.current && fgRef.current) {
      hasZoomedToFitRef.current = true
      const wideCfg = CINEMATIC_SHOTS[0].setup([])
      cinematicRef.current.shotIndex = 0
      cinematicRef.current.pivot.copy(wideCfg.pivot)
      cinematicRef.current.speed = wideCfg.speed
      cinematicRef.current.nextShotAt = performance.now() + CINEMATIC_SHOTS[0].duration

      // F2: check URL hash — navigate directly to node instead of zoom-to-fit
      const nodeId = parseNodeHash(window.location.hash)
      if (nodeId) {
        const node = graphRef.current?.nodes?.find(n => n.id === nodeId)
        if (node) {
          selectNodeRef.current?.(node, {})
        } else {
          fgRef.current.zoomToFit(0, 160)
          history.replaceState(null, '', location.pathname + location.search)
        }
      } else {
        fgRef.current.zoomToFit(0, 160)
      }
    }
    initInstancedMeshes()
  }, [initInstancedMeshes])

  const onBackgroundClick = useCallback(() => { handleDismiss() }, [handleDismiss])

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

  // Hide non-neighbor links when a node is selected; hide links to hidden nodes during timeline.
  const getLinkVisibility = useCallback((link) => {
    const srcId = typeof link.source === 'object' && link.source ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' && link.target ? link.target.id : link.target

    if (selectedNodeId && !neighborSetRef.current.has(srcId) && !neighborSetRef.current.has(tgtId)) return false

    if (timelineLinkDate) {
      const tlMs = timelineLinkDate.getTime()
      const srcNode = nodeMapRef.current.get(srcId)
      const tgtNode = nodeMapRef.current.get(tgtId)
      const srcOk = !srcNode?._createdMs || srcNode._createdMs <= tlMs
      const tgtOk = !tgtNode?._createdMs || tgtNode._createdMs <= tlMs
      if (!srcOk || !tgtOk) return false
    }

    return true
  }, [selectedNodeId, timelineLinkDate])

  const getLinkParticleColor = useCallback(() => LINK_PARTICLE_COLOR, [])

  // F1: keyboard shortcuts — search focus, Escape to clear state
  useEffect(() => {
    const onKey = (e) => {
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

      if (e.key === 'Escape') {
        if (searchQueryRef.current) {
          searchQueryRef.current = ''
          setSearchQuery('')
          applySelectionColors()
          return
        }
      }

      if (!inInput && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applySelectionColors])

  const nodeThreeObject = useCallback((node) => {
    const base = baseEmissiveForDegree(node.degree ?? 0)
    const isRecent = isRecentlyAdded(node.created)
    node._phase = Math.random() * Math.PI * 2
    node._baseEmissive = isRecent ? Math.min(1.0, base * 1.5) : base
    node._radius = sizeForDegree(node.degree)
    // Cache parsed timestamp for hot-path rAF comparisons
    node._createdMs = node.created ? new Date(node.created).getTime() : null
    const r = node._radius
    if (!_trackerGeos[r]) _trackerGeos[r] = new THREE.SphereGeometry(r, 6, 4)
    const tracker = new THREE.Mesh(_trackerGeos[r], TRACKER_MAT)
    tracker.visible = false
    return tracker
  }, [])

  // --- F5 Timeline helpers ---

  const startTimeline = useCallback(() => {
    const startMs = timelineMinRef.current
    timelineDateRef.current = new Date(startMs)
    setTimelineActive(true)
    setTimelineDate(startMs)
    setTimelineLinkDate(new Date(startMs))
  }, [])

  const exitTimeline = useCallback(() => {
    timelineDateRef.current = null
    timelinePlayingRef.current = false
    timelineWasPlayingRef.current = false
    clearTimeout(timelineLinkTimerRef.current)
    setTimelineActive(false)
    setTimelinePlaying(false)
    setTimelineLinkDate(null)
    // Restore normal cinematic orbit
    isAutoRotatingRef.current = true
    cinematicRef.current.nextShotAt = performance.now() + 2000
  }, [])

  const handleTimelineScrub = useCallback((e) => {
    const ms = parseInt(e.target.value)
    const d = new Date(ms)
    timelineDateRef.current = d
    setTimelineDate(ms)
    clearTimeout(timelineLinkTimerRef.current)
    timelineLinkTimerRef.current = setTimeout(() => setTimelineLinkDate(d), TIMELINE_LINK_DEBOUNCE_MS)
  }, [])

  const toggleTimelinePlay = useCallback(() => {
    const next = !timelinePlayingRef.current
    if (next) {
      // Reset to start if already at the end
      if (timelineDateRef.current?.getTime() >= timelineMaxRef.current) {
        timelineDateRef.current = new Date(timelineMinRef.current)
        setTimelineDate(timelineMinRef.current)
      }
      // Switch to global wide-shot orbit during playback
      const fg = fgRef.current
      if (fg) {
        fg.zoomToFit(800, 120)
        const wideCfg = CINEMATIC_SHOTS[0].setup([])
        cinematicRef.current.pivot.copy(wideCfg.pivot)
        cinematicRef.current.speed = wideCfg.speed * 0.55
        cinematicRef.current.nextShotAt = Infinity // hold wide shot for entire play
        isAutoRotatingRef.current = true
        clearTimeout(orbitResumeTimerRef.current)
      }
      timelineWasPlayingRef.current = true
    } else {
      timelineWasPlayingRef.current = false
    }
    timelinePlayingRef.current = next
    setTimelinePlaying(next)
  }, [])

  // Navigate to a search result node and clear the search
  const selectSearchResult = useCallback((node) => {
    searchQueryRef.current = ''
    setSearchQuery('')
    applySelectionColors()
    onNodeClick(node, {})
  }, [applySelectionColors, onNodeClick])

  return (
    <>
      <ForceGraph3D
        ref={setForceGraphRef}
        graphData={graphData}
        backgroundColor={BACKGROUND_COLOR}
        warmupTicks={300}
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
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.001}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={getLinkParticleColor}
      />

      {/* Hover tooltip */}
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

      {/* F1: Search — top-center, / or ⌘K to focus */}
      <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: 'rgba(160, 192, 255, 0.45)', pointerEvents: 'none',
          }}>⌕</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value
              searchQueryRef.current = q
              setSearchQuery(q)
              if (q && selectedNodeRef.current) {
                selectedNodeRef.current = null
                neighborSetRef.current = new Set()
                setSelectedNodeId(null)
                setSelectedNode(null)
                history.replaceState(null, '', location.pathname + location.search)
              }
              if (q) {
                applySearchColors(q)
              } else {
                applySelectionColors()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                searchQueryRef.current = ''
                setSearchQuery('')
                applySelectionColors()
                e.currentTarget.blur()
              }
              // Arrow down / Enter: focus first result
              if ((e.key === 'ArrowDown' || e.key === 'Enter') && searchResults.length > 0) {
                e.preventDefault()
                selectSearchResult(searchResults[0])
              }
            }}
            placeholder="Search notes…  / or ⌘K"
            style={{
              ...spacePanel,
              padding: '7px 30px 7px 26px',
              borderRadius: searchQuery && searchResults.length > 0 ? '20px 20px 0 0' : 20,
              fontSize: 12,
              outline: 'none',
              width: 260,
              letterSpacing: '0.03em',
              opacity: searchQuery ? 1 : 0.6,
              transition: 'opacity 0.2s ease',
              caretColor: '#a0c0ff',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                searchQueryRef.current = ''
                setSearchQuery('')
                applySelectionColors()
                searchInputRef.current?.focus()
              }}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(160, 192, 255, 0.5)', fontSize: 14, lineHeight: 1, padding: 2,
              }}
            >×</button>
          )}

          {/* Live results dropdown */}
          {searchQuery && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              ...spacePanel,
              borderRadius: '0 0 12px 12px',
              borderTop: 'none',
              overflow: 'hidden',
              maxHeight: 320,
              overflowY: 'auto',
            }}>
              {searchResults.slice(0, SEARCH_RESULT_LIMIT).map((node, i) => (
                <button
                  key={node.id}
                  onClick={() => selectSearchResult(node)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px',
                    background: 'none', border: 'none',
                    borderBottom: i < Math.min(searchResults.length, SEARCH_RESULT_LIMIT) - 1
                      ? '1px solid rgba(160, 192, 255, 0.07)' : 'none',
                    cursor: 'pointer', fontSize: 12,
                    color: '#a0c0ff', letterSpacing: '0.02em',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(160, 192, 255, 0.09)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ opacity: 0.9 }}>{node.label}</span>
                  {node.tags?.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.4, letterSpacing: '0.03em' }}>
                      {node.tags.slice(0, 3).join(' · ')}
                    </span>
                  )}
                </button>
              ))}
              {searchResults.length > SEARCH_RESULT_LIMIT && (
                <div style={{
                  padding: '6px 14px', fontSize: 11,
                  color: 'rgba(160, 192, 255, 0.35)',
                  letterSpacing: '0.04em',
                  borderTop: '1px solid rgba(160, 192, 255, 0.07)',
                }}>
                  +{searchResults.length - SEARCH_RESULT_LIMIT} more — keep typing to narrow
                </div>
              )}
            </div>
          )}

          {/* No results indicator */}
          {searchQuery && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              ...spacePanel,
              borderRadius: '0 0 12px 12px',
              borderTop: 'none',
              padding: '8px 14px',
              fontSize: 11,
              color: 'rgba(160, 192, 255, 0.35)',
              letterSpacing: '0.04em',
            }}>
              No results
            </div>
          )}
        </div>
      </div>

      {/* F5: Timeline toggle button */}
      {!timelineActive && (
        <button
          onClick={startTimeline}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 20,
            ...spacePanel, padding: '7px 14px',
            fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
            color: 'rgba(160, 192, 255, 0.5)',
            opacity: 0.7, transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}
        >
          TIMELINE
        </button>
      )}

      {/* F5: Timeline scrubber */}
      {timelineActive && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, ...spacePanel, padding: '14px 22px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          minWidth: 340,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(160, 192, 255, 0.7)', letterSpacing: '0.06em' }}>
            {timelineDate
              ? new Date(timelineDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              : '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <button
              onClick={toggleTimelinePlay}
              style={{
                background: 'none',
                border: '1px solid rgba(160, 192, 255, 0.3)',
                color: '#a0c0ff', borderRadius: 4,
                padding: '3px 10px', cursor: 'pointer',
                fontSize: 13, flexShrink: 0,
              }}
            >
              {timelinePlaying ? '⏸' : '▶'}
            </button>
            <input
              type="range"
              min={timelineMinRef.current}
              max={timelineMaxRef.current}
              value={timelineDate || timelineMinRef.current}
              onChange={handleTimelineScrub}
              style={{ flex: 1, accentColor: '#a0c0ff', cursor: 'pointer' }}
            />
          </div>
          <button
            onClick={exitTimeline}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(160, 192, 255, 0.3)',
              fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em',
            }}
          >
            EXIT TIMELINE
          </button>
        </div>
      )}
    </>
  )
}
