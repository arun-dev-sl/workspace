import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'

import type { FlightMap, FlightMapAirport } from '@workspace/domain'
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl'

const EARTH_RADIUS_METERS = 6_371_008.8
const ARC_POINT_COUNT = 72
export const AIRPORT_MIN_ZOOM = 6
const MODEL_ASSET_PATH = '/models/airplane.glb'
const MIN_PLANE_SCALE_METERS = 2000
const MAX_PLANE_SCALE_METERS = 10_000
const MIN_PLANE_LIFT_METERS = 30_000
const MAX_PLANE_LIFT_METERS = 110_000
const GLOW_RADIUS_MULTIPLIER = 1.85
const PICKABLE_PLANE_RADIUS_PX = 44
const DEFAULT_MODEL_FORWARD_AXIS = new THREE.Vector3(0, 0, 1)
const MODEL_UP_AXIS = new THREE.Vector3(0, 1, 0)
const MERCATOR_UP_AXIS = new THREE.Vector3(0, 0, 1)
const PLANE_AURA_COLOR = '#fb923c'
const ROUTE_PULSE_SPEED = 1.8
const ROUTE_MAIN_OPACITY_MIN = 0.72
const ROUTE_MAIN_OPACITY_MAX = 0.96
const ROUTE_GLOW_OPACITY_MIN = 0.16
const ROUTE_GLOW_OPACITY_MAX = 0.3
const ORIENTATION_SAMPLE_DELTA = 0.012
const MAX_PLANES_PER_ROUTE = 3
const PLANE_LANE_OFFSET_METERS = 18_000
const ROUTE_REVEAL_STAGGER_SECONDS = 0.08
const ROUTE_REVEAL_DURATION_SECONDS = 0.9

export const FLIGHT_SCENE_LAYER_ID = 'flight-map-3d-scene'

type ProjectionName = 'mercator' | 'globe'
type PlaneState = 'idle' | 'flying' | 'landed'

export interface FlightArcPoint {
  lng: number
  lat: number
  altitudeMeters: number
  progress: number
}

interface SceneRoute {
  id: string
  count: number
  distanceMeters: number
  arc: FlightArcPoint[]
}

interface ScenePlane {
  id: string
  routeId: string
  distanceMeters: number
  arc: FlightArcPoint[]
  state: PlaneState
  parkedProgress: number
  progress: number
  speedPerSecond: number
  laneOffsetMeters: number
}

interface FlightSceneData {
  routes: SceneRoute[]
  planes: ScenePlane[]
}

interface SceneSettings {
  showMarkers: boolean
  showRoutes: boolean
  showHeatmap3d: boolean
}

interface SceneNode {
  dispose(): void
}

type RouteMeshEntry = SceneNode & {
  main: THREE.Mesh
  glow: THREE.Mesh
  mainMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  pulseOffset: number
  mainGeometry: THREE.TubeGeometry
  glowGeometry: THREE.TubeGeometry
  revealOffsetSeconds: number
  indexCount: number
}

type PlaneMeshEntry = SceneNode & {
  mesh: THREE.Group
  plane: ScenePlane
  screenPos: { x: number, y: number } | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function hashCode(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function toUnitSphereVector(lng: number, lat: number) {
  const lngRadians = THREE.MathUtils.degToRad(lng)
  const latRadians = THREE.MathUtils.degToRad(lat)
  const cosLat = Math.cos(latRadians)

  return new THREE.Vector3(
    cosLat * Math.sin(lngRadians),
    Math.sin(latRadians),
    cosLat * Math.cos(lngRadians),
  ).normalize()
}

function vectorToLngLat(vector: THREE.Vector3) {
  const normalized = vector.clone().normalize()
  const lat = THREE.MathUtils.radToDeg(Math.asin(clamp(normalized.y, -1, 1)))
  const lng = THREE.MathUtils.radToDeg(Math.atan2(normalized.x, normalized.z))

  return { lng, lat }
}

function greatCirclePoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  progress: number,
) {
  const dot = clamp(start.dot(end), -1, 1)
  const omega = Math.acos(dot)

  if (omega < 1e-6) {
    return start.clone().lerp(end, progress).normalize()
  }

  const sinOmega = Math.sin(omega)
  const startScale = Math.sin((1 - progress) * omega) / sinOmega
  const endScale = Math.sin(progress * omega) / sinOmega

  return start
    .clone()
    .multiplyScalar(startScale)
    .add(end.clone().multiplyScalar(endScale))
    .normalize()
}

function distanceMetersBetween(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
) {
  const start = new maplibregl.LngLat(startLng, startLat)
  const end = new maplibregl.LngLat(endLng, endLat)

  return start.distanceTo(end)
}

function altitudeForDistance(distanceMeters: number, progress: number) {
  const maxHeight = clamp(distanceMeters * 0.24, 260_000, 1_800_000)
  return Math.sin(progress * Math.PI) * maxHeight
}

function getProjectionName(map: MapLibreMap): ProjectionName {
  return map.getProjection().type === 'globe' ? 'globe' : 'mercator'
}

function worldScaleForMeters(
  lng: number,
  lat: number,
  meters: number,
  projection: ProjectionName,
) {
  if (projection === 'globe') {
    return meters / EARTH_RADIUS_METERS
  }

  return (
    maplibregl.MercatorCoordinate.fromLngLat([lng, lat]).meterInMercatorCoordinateUnits()
    * meters
  )
}

function worldPointFromArcPoint(
  point: FlightArcPoint,
  projection: ProjectionName,
) {
  if (projection === 'globe') {
    return toUnitSphereVector(point.lng, point.lat).multiplyScalar(
      1 + point.altitudeMeters / EARTH_RADIUS_METERS,
    )
  }

  const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
    [point.lng, point.lat],
    point.altitudeMeters,
  )

  return new THREE.Vector3(coordinate.x, coordinate.y, coordinate.z)
}

function sampleArcPoint(arc: FlightArcPoint[], progress: number) {
  if (arc.length === 0) {
    return {
      lng: 0,
      lat: 0,
      altitudeMeters: 0,
      progress: 0,
    } satisfies FlightArcPoint
  }

  if (progress <= 0) {
    return arc[0]
  }

  if (progress >= 1) {
    return arc[arc.length - 1] ?? arc[0]
  }

  const scaledIndex = progress * (arc.length - 1)
  const startIndex = Math.floor(scaledIndex)
  const endIndex = Math.min(startIndex + 1, arc.length - 1)
  const localProgress = scaledIndex - startIndex
  const start = arc[startIndex]
  const end = arc[endIndex]

  return {
    lng: lerp(start.lng, end.lng, localProgress),
    lat: lerp(start.lat, end.lat, localProgress),
    altitudeMeters: lerp(start.altitudeMeters, end.altitudeMeters, localProgress),
    progress,
  } satisfies FlightArcPoint
}

export function generateFlightArc(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
) {
  const start = toUnitSphereVector(startLng, startLat)
  const end = toUnitSphereVector(endLng, endLat)
  const distanceMeters = distanceMetersBetween(startLng, startLat, endLng, endLat)
  const arc: FlightArcPoint[] = []

  for (let index = 0; index < ARC_POINT_COUNT; index += 1) {
    const progress = index / (ARC_POINT_COUNT - 1)
    const point = greatCirclePoint(start, end, progress)
    const lngLat = vectorToLngLat(point)

    arc.push({
      lng: lngLat.lng,
      lat: lngLat.lat,
      altitudeMeters: altitudeForDistance(distanceMeters, progress),
      progress,
    })
  }

  return {
    arc,
    distanceMeters,
  }
}

function buildSceneData(data: FlightMap): FlightSceneData {
  const routes = data.routes.map((route) => {
    const generated = generateFlightArc(
      route.fromLng,
      route.fromLat,
      route.toLng,
      route.toLat,
    )

    return {
      id: `${route.from}:${route.to}`,
      count: route.count,
      distanceMeters: generated.distanceMeters,
      arc: generated.arc,
    } satisfies SceneRoute
  })

  const planes = routes.flatMap((route) => {
    const planeCount = Math.min(MAX_PLANES_PER_ROUTE, Math.max(1, route.count))
    const baseSeed = (hashCode(route.id) % 1000) / 1000

    return Array.from({ length: planeCount }, (_, index) => {
      const parkedProgress = (baseSeed + index / planeCount) % 1
      const centeredLane = index - (planeCount - 1) / 2
      const routeSpeed = clamp(route.distanceMeters / 2_800_000, 0.028, 0.075)

      return {
        id: `plane:${route.id}:${index}`,
        routeId: route.id,
        distanceMeters: route.distanceMeters,
        arc: route.arc,
        state: 'idle',
        parkedProgress,
        progress: parkedProgress,
        speedPerSecond: routeSpeed,
        laneOffsetMeters: centeredLane * PLANE_LANE_OFFSET_METERS,
      } satisfies ScenePlane
    })
  })

  return {
    routes,
    planes,
  }
}

function interpolatePlaneScaleMeters(distanceMeters: number) {
  return clamp(distanceMeters * 0.0016, MIN_PLANE_SCALE_METERS, MAX_PLANE_SCALE_METERS)
}

function interpolatePlaneLiftMeters(distanceMeters: number) {
  return clamp(distanceMeters * 0.008, MIN_PLANE_LIFT_METERS, MAX_PLANE_LIFT_METERS)
}

function getPlaneLiftMeters(distanceMeters: number, progress: number) {
  return interpolatePlaneLiftMeters(distanceMeters) * Math.sin(progress * Math.PI)
}

function getPlaneVisualProgress(plane: ScenePlane) {
  if (plane.state === 'idle') {
    return plane.parkedProgress
  }

  if (plane.state === 'landed') {
    return 1
  }

  return plane.progress
}

function applyTubeGradient(geometry: THREE.TubeGeometry) {
  const positionAttribute = geometry.getAttribute('position')
  const vertexCount = positionAttribute.count
  const colors = new Float32Array(vertexCount * 3)
  const color = new THREE.Color()

  for (let index = 0; index < vertexCount; index += 1) {
    const segmentProgress
      = (Math.floor(index / (geometry.parameters.radialSegments + 1))
        / geometry.parameters.tubularSegments) || 0

    if (segmentProgress <= 0.5) {
      color.setRGB(
        lerp(0.2, 0.2, segmentProgress / 0.5),
        lerp(0.54, 0.86, segmentProgress / 0.5),
        lerp(0.99, 0.2, segmentProgress / 0.5),
      )
    } else {
      color.setRGB(
        lerp(0.2, 1, (segmentProgress - 0.5) / 0.5),
        lerp(0.86, 0.56, (segmentProgress - 0.5) / 0.5),
        lerp(0.2, 0.12, (segmentProgress - 0.5) / 0.5),
      )
    }

    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function createRouteMesh(
  route: SceneRoute,
  projection: ProjectionName,
  glowTint: string,
  zoom: number,
  revealOffsetSeconds: number,
) {
  const worldPoints = route.arc.map((point) =>
    worldPointFromArcPoint(point, projection),
  )
  const curve = new THREE.CatmullRomCurve3(worldPoints, false, 'catmullrom', 0.08)
  const midpoint = route.arc[Math.floor(route.arc.length / 2)] ?? route.arc[0]
  // Shrink tube radius as zoom increases so routes don't overwhelm the view
  const zoomScale = Math.pow(2, Math.max(0, zoom - 4) * 0.6)
  const radius = worldScaleForMeters(
    midpoint.lng,
    midpoint.lat,
    clamp(route.distanceMeters * 0.0048 / zoomScale, 2800, 26_000),
    projection,
  )
  const geometry = new THREE.TubeGeometry(
    curve,
    Math.max(96, worldPoints.length * 3),
    radius,
    10,
    false,
  )

  applyTubeGradient(geometry)

  const mainMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: ROUTE_MAIN_OPACITY_MAX,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const glowGeometry = geometry.clone()
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(glowTint),
    transparent: true,
    opacity: ROUTE_GLOW_OPACITY_MIN,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })

  glowGeometry.scale(
    GLOW_RADIUS_MULTIPLIER,
    GLOW_RADIUS_MULTIPLIER,
    GLOW_RADIUS_MULTIPLIER,
  )

  const main = new THREE.Mesh(geometry, mainMaterial)
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)

  main.renderOrder = 8
  glow.renderOrder = 7

  return {
    main,
    glow,
    mainMaterial,
    glowMaterial,
    mainGeometry: geometry,
    glowGeometry,
    pulseOffset: ((hashCode(route.id) % 360) / 360) * Math.PI * 2,
    revealOffsetSeconds,
    indexCount: geometry.index?.count ?? 0,
    dispose() {
      geometry.dispose()
      glowGeometry.dispose()
      mainMaterial.dispose()
      glowMaterial.dispose()
    },
  } satisfies RouteMeshEntry
}

function createFallbackModel() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1.3, 12),
    new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.2,
      roughness: 0.42,
    }),
  )
  const wings = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.06, 0.24),
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      metalness: 0.18,
      roughness: 0.44,
    }),
  )
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.18, 0.06),
    new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.18,
      roughness: 0.44,
    }),
  )
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.22, 0.18),
    new THREE.MeshStandardMaterial({
      color: '#0f766e',
      metalness: 0.18,
      roughness: 0.44,
    }),
  )

  body.rotation.z = Math.PI / 2
  tail.position.set(-0.45, 0.12, 0)
  fin.position.set(-0.46, 0.2, 0)
  group.add(body, wings, tail, fin)
  group.userData.modelForwardAxis = [1, 0, 0]
  group.userData.isFallbackModel = true

  return group
}

function hasRenderableMesh(object: THREE.Object3D) {
  let hasMesh = false

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      hasMesh = true
    }
  })

  return hasMesh
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    for (const nestedMaterial of material) {
      disposeMaterial(nestedMaterial)
    }
    return
  }

  material.dispose()
}

function cloneMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    return material.map((nestedMaterial) => nestedMaterial.clone())
  }

  return material.clone()
}

function tuneMaterial(
  material: THREE.Material | THREE.Material[],
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((nestedMaterial) =>
      tuneMaterial(nestedMaterial) as THREE.Material,
    )
  }

  material.depthWrite = false
  material.blending = THREE.NormalBlending
  material.depthTest = true
  material.side = THREE.FrontSide

  if ('transparent' in material) {
    material.transparent = true
  }

  if ('opacity' in material) {
    material.opacity = 0.92
  }

  material.needsUpdate = true
  return material
}

function inferModelForwardAxis(size: THREE.Vector3) {
  if (size.x >= size.y && size.x >= size.z) {
    return new THREE.Vector3(1, 0, 0)
  }

  if (size.z >= size.x && size.z >= size.y) {
    return new THREE.Vector3(0, 0, 1)
  }

  return DEFAULT_MODEL_FORWARD_AXIS.clone()
}

function normalizeModelTemplate(object: THREE.Object3D) {
  const root = object.clone(true)

  if (!hasRenderableMesh(root)) {
    return createFallbackModel()
  }

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    child.material = tuneMaterial(cloneMaterial(child.material))
    child.castShadow = false
    child.receiveShadow = false
    child.frustumCulled = false
    child.renderOrder = 28
  })

  const bounds = new THREE.Box3().setFromObject(root)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z)

  if (!Number.isFinite(maxDimension) || maxDimension <= 0.0001) {
    return createFallbackModel()
  }

  root.position.sub(center)
  root.scale.setScalar(1 / maxDimension)
  root.userData.modelForwardAxis = inferModelForwardAxis(size).toArray()
  root.userData.isFallbackModel = false
  root.updateMatrixWorld(true)

  return root
}

function cloneModelTemplate(template: THREE.Object3D) {
  const clone = template.clone(true)

  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    child.material = tuneMaterial(cloneMaterial(child.material))
    child.castShadow = false
    child.receiveShadow = false
    child.frustumCulled = false
    child.renderOrder = 28
  })

  return clone
}

function createPlaneAura() {
  const group = new THREE.Group()
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 18, 18),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(PLANE_AURA_COLOR),
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      depthTest: false,
    }),
  )
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.56, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fdba74'),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  )
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 14, 14),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff7ed'),
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      depthTest: false,
    }),
  )

  aura.renderOrder = 22
  ring.renderOrder = 23
  beacon.renderOrder = 24
  ring.rotation.x = Math.PI / 2
  group.add(aura, ring, beacon)

  return group
}

function createPlaneGuideModel() {
  const guide = createFallbackModel()

  guide.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    child.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff7ed'),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    child.renderOrder = 27
    child.frustumCulled = false
  })

  guide.scale.setScalar(1.18)
  return guide
}

function createRoutePlaneMesh(template: THREE.Object3D, planeId: string) {
  const group = new THREE.Group()
  const visual = new THREE.Group()
  const model = cloneModelTemplate(template)
  const guide
    = template.userData.isFallbackModel === true ? createPlaneGuideModel() : null
  const aura = createPlaneAura()

  group.matrixAutoUpdate = true
  group.frustumCulled = false
  visual.frustumCulled = false
  model.frustumCulled = false
  if (guide) {
    guide.frustumCulled = false
  }
  aura.frustumCulled = false
  model.scale.setScalar(3.25)
  model.position.set(0, 0.1, 0)
  if (guide) {
    guide.position.set(0, -0.02, 0)
  }
  visual.rotation.z = Math.PI / 18

  assignPlaneId(group, planeId)
  if (guide) {
    visual.add(guide)
  }
  visual.add(model)
  group.add(aura, visual)

  return group
}

function disposeObject3D(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    child.geometry.dispose()
    disposeMaterial(child.material)
  })
}

function assignPlaneId(object: THREE.Object3D, planeId: string) {
  object.userData.routePlaneId = planeId
  object.traverse((child) => {
    child.userData.routePlaneId = planeId
  })
}

export class FlightMap3DLayerController {
  readonly layer: CustomLayerInterface

  private map: MapLibreMap | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private camera = new THREE.PerspectiveCamera()
  private scene = new THREE.Scene()
  private routeGroup = new THREE.Group()
  private planeGroup = new THREE.Group()
  private ambientLight = new THREE.AmbientLight('#ffffff', 1)
  private directionalLight = new THREE.DirectionalLight('#f8fafc', 1.3)
  private modelLoader = new GLTFLoader()
  private modelTemplate: THREE.Object3D | null = null
  private modelLoadPromise: Promise<THREE.Object3D> | null = null
  private sceneData: FlightSceneData | null = null
  private settings: SceneSettings = {
    showMarkers: true,
    showRoutes: true,
    showHeatmap3d: false,
  }

  private projection: ProjectionName | null = null
  private routeGlowTint = '#38bdf8'
  private routeMeshes: RouteMeshEntry[] = []
  private planeMeshes: PlaneMeshEntry[] = []
  private heatmapBarGroup = new THREE.Group()
  private heatmapBarMeshes: THREE.Mesh[] = []
  private heatmapAirports: FlightMapAirport[] = []
  private modelForwardAxis = DEFAULT_MODEL_FORWARD_AXIS.clone()
  private lastAnimationTime = 0
  private routeRevealStartedAt = 0
  private routeRevealComplete = false
  private handleMapClick = (event: MapMouseEvent) => {
    this.startPlaneAnimation(event)
  }

  private handleZoomEnd = () => {
    this.rebuildRoutes()
  }

  constructor() {
    this.directionalLight.position.set(0.4, 0.8, 1.2)
    this.scene.add(
      this.ambientLight,
      this.directionalLight,
      this.heatmapBarGroup,
      this.routeGroup,
      this.planeGroup,
    )

    this.layer = {
      id: FLIGHT_SCENE_LAYER_ID,
      type: 'custom',
      renderingMode: '3d',
      onAdd: (map, gl) => {
        this.map = map

        if (!this.renderer) {
          this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
            alpha: true,
          })
          this.renderer.autoClear = false
          this.renderer.sortObjects = false
        }

        map.on('click', this.handleMapClick)
        map.on('zoomend', this.handleZoomEnd)

        void this.ensureModelTemplate().then(() => {
          this.rebuildScene()
          this.map?.triggerRepaint()
        })
      },
      onRemove: () => {
        this.map?.off('click', this.handleMapClick)
        this.map?.off('zoomend', this.handleZoomEnd)
        this.clearScene()
        this.renderer = null
      },
      render: (_gl, options) => {
        this.renderScene(options)
      },
    }
  }

  setData(data: FlightMap | null) {
    const nextSceneData = data ? buildSceneData(data) : null
    this.heatmapAirports = data?.airports ?? []

    if (!nextSceneData) {
      this.sceneData = null
      this.rebuildScene()
      this.map?.triggerRepaint()
      return
    }

    if (this.sceneData && this.canAppendSceneData(nextSceneData)) {
      this.sceneData = nextSceneData
      this.appendSceneData(nextSceneData)
      if (this.settings.showHeatmap3d) {
        this.buildHeatmapBars()
      }
      this.map?.triggerRepaint()
      return
    }

    this.sceneData = nextSceneData
    this.rebuildScene()
    this.map?.triggerRepaint()
  }

  setSettings(settings: SceneSettings & { glowTint?: string }) {
    const prev3d = this.settings.showHeatmap3d
    this.settings = settings
    this.routeGlowTint = settings.glowTint ?? this.routeGlowTint
    if (settings.showHeatmap3d !== prev3d) {
      this.buildHeatmapBars()
    }
    this.updateVisibility()
    this.map?.triggerRepaint()
  }

  destroy() {
    this.map?.off('click', this.handleMapClick)
    this.map?.off('zoomend', this.handleZoomEnd)
    this.clearScene()
    this.renderer?.dispose()
    this.renderer = null
    this.modelTemplate = null
    this.modelLoadPromise = null
    this.map = null
  }

  private canAppendSceneData(nextSceneData: FlightSceneData) {
    if (!this.sceneData) {
      return false
    }

    if (nextSceneData.routes.length < this.sceneData.routes.length) {
      return false
    }

    for (let index = 0; index < this.sceneData.routes.length; index += 1) {
      if (nextSceneData.routes[index]?.id !== this.sceneData.routes[index]?.id) {
        return false
      }
    }

    return true
  }

  private appendSceneData(nextSceneData: FlightSceneData) {
    if (!this.map || !this.projection) {
      this.rebuildScene()
      return
    }

    const previousRouteCount = this.routeMeshes.length
    const previousPlaneCount = this.planeMeshes.length
    const zoom = this.map.getZoom()
    const nowSeconds = performance.now() / 1000

    if (this.routeRevealStartedAt === 0) {
      this.routeRevealStartedAt = nowSeconds
    }

    const appendedRoutes = nextSceneData.routes.slice(previousRouteCount)
    if (appendedRoutes.length > 0) {
      const revealBaseOffset = Math.max(0, nowSeconds - this.routeRevealStartedAt)
      this.routeRevealComplete = false

      for (const [index, route] of appendedRoutes.entries()) {
        const mesh = createRouteMesh(
          route,
          this.projection,
          this.routeGlowTint,
          zoom,
          revealBaseOffset + index * ROUTE_REVEAL_STAGGER_SECONDS,
        )
        this.routeMeshes.push(mesh)
        this.routeGroup.add(mesh.glow, mesh.main)
      }
    }

    const appendedPlanes = nextSceneData.planes.slice(previousPlaneCount)
    if (appendedPlanes.length > 0) {
      void this.ensureModelTemplate().then((template) => {
        if (!this.map || !this.sceneData) {
          return
        }

        for (const plane of appendedPlanes) {
          const mesh = createRoutePlaneMesh(template, plane.id)
          this.planeGroup.add(mesh)
          this.planeMeshes.push({
            mesh,
            plane,
            screenPos: null,
            dispose() {
              disposeObject3D(mesh)
            },
          })
        }

        this.syncPlaneTransforms()
        this.updateVisibility()
        this.map?.triggerRepaint()
      })
    }

    this.updateVisibility()
  }

  private async ensureModelTemplate() {
    if (this.modelTemplate) {
      return this.modelTemplate
    }

    if (!this.modelLoadPromise) {
      this.modelLoadPromise = this.modelLoader
        .loadAsync(MODEL_ASSET_PATH)
        .then((gltf) => {
          this.modelTemplate = normalizeModelTemplate(gltf.scene)
          if (Array.isArray(this.modelTemplate.userData.modelForwardAxis)) {
            this.modelForwardAxis = new THREE.Vector3().fromArray(
              this.modelTemplate.userData.modelForwardAxis,
            )
          }
          return this.modelTemplate
        })
        .catch(() => {
          this.modelTemplate = createFallbackModel()
          this.modelForwardAxis = DEFAULT_MODEL_FORWARD_AXIS.clone()
          return this.modelTemplate
        })
    }

    return this.modelLoadPromise
  }

  private clearScene() {
    for (const mesh of this.routeMeshes) {
      this.routeGroup.remove(mesh.main)
      this.routeGroup.remove(mesh.glow)
      mesh.dispose()
    }

    for (const mesh of this.planeMeshes) {
      this.planeGroup.remove(mesh.mesh)
      mesh.dispose()
    }

    for (const mesh of this.heatmapBarMeshes) {
      this.heatmapBarGroup.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.heatmapBarMeshes = []

    this.routeMeshes = []
    this.planeMeshes = []
  }

  private rebuildScene() {
    if (!this.map || !this.sceneData) {
      this.clearScene()
      return
    }

    const projection = getProjectionName(this.map)
    const zoom = this.map.getZoom()

    this.clearScene()
    this.projection = projection
    this.routeRevealStartedAt = 0
    this.routeRevealComplete = false

    if (this.settings.showHeatmap3d) {
      this.buildHeatmapBars()
    }

    for (const [index, route] of this.sceneData.routes.entries()) {
      const mesh = createRouteMesh(
        route,
        projection,
        this.routeGlowTint,
        zoom,
        index * ROUTE_REVEAL_STAGGER_SECONDS,
      )
      this.routeMeshes.push(mesh)
      this.routeGroup.add(mesh.glow, mesh.main)
    }

    void this.ensureModelTemplate().then((template) => {
      if (!this.map || !this.sceneData || this.projection !== projection) {
        return
      }

      for (const plane of this.sceneData.planes) {
        const mesh = createRoutePlaneMesh(template, plane.id)
        this.planeGroup.add(mesh)
        this.planeMeshes.push({
          mesh,
          plane,
          screenPos: null,
          dispose() {
            disposeObject3D(mesh)
          },
        })
      }

      this.syncPlaneTransforms()
      this.updateVisibility()
      this.map?.triggerRepaint()
    })

    this.updateVisibility()
  }

  private buildHeatmapBars() {
    for (const mesh of this.heatmapBarMeshes) {
      this.heatmapBarGroup.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.heatmapBarMeshes = []

    if (!this.projection || this.heatmapAirports.length === 0) return

    const airports = this.heatmapAirports.filter((a) => a.visits > 0)
    if (airports.length === 0) return

    const maxVisits = Math.max(...airports.map((a) => a.visits))
    const MAX_HEIGHT_METERS = 600_000
    // Dome angular radius in degrees – each airport gets a smooth bell hill of this size
    const DOME_RADIUS_DEG = 0.8
    // σ chosen so the dome falls to ~5 % at the edge (σ = radius/2.5)
    const sigma = DOME_RADIUS_DEG / 2.5
    const sigma2 = 2 * sigma * sigma
    const PATCH = 200 // 24×24 vertex grid per dome

    const projection = this.projection
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    })

    for (const airport of airports) {
      // Relative intensity of this airport in [0, 1]
      const peakT = Math.pow(airport.visits / maxVisits, 0.55)

      const positions = new Float32Array(PATCH * PATCH * 3)
      const colors = new Float32Array(PATCH * PATCH * 3)

      for (let iy = 0; iy < PATCH; iy++) {
        for (let ix = 0; ix < PATCH; ix++) {
          const lng = airport.lng + DOME_RADIUS_DEG * (-1 + (2 * ix) / (PATCH - 1))
          const lat = airport.lat + DOME_RADIUS_DEG * (-1 + (2 * iy) / (PATCH - 1))
          const dlng = lng - airport.lng
          const dlat = lat - airport.lat
          const dist = Math.hypot(dlng, dlat)

          // Normalize distance inside dome radius
          const r = dist / DOME_RADIUS_DEG

          // Outside circle → zero height
          if (r > 1) {
            continue
          }

          // Gaussian bell for smooth center
          const gaussian = Math.exp(-(dist * dist) / sigma2)

          // Additional radial fade so edges disappear smoothly
          const radialFade = Math.pow(1 - r, 2.2)

          const altMeters = MAX_HEIGHT_METERS * peakT * gaussian * radialFade

          const wp = worldPointFromArcPoint(
            { lng, lat, altitudeMeters: altMeters, progress: 0 },
            projection,
          )
          const vi = (iy * PATCH + ix) * 3
          positions[vi] = wp.x
          positions[vi + 1] = wp.y
          positions[vi + 2] = wp.z

          // Colour is keyed on global normalised height (peakT × gaussian)
          // so high-traffic airports are hot-coloured at the peak,
          // low-traffic airports stay in the cool range throughout
          const t = peakT * gaussian
          const color = new THREE.Color()
          if (t < 0.25) {
            color.lerpColors(new THREE.Color('#3b82f6'), new THREE.Color('#06b6d4'), t / 0.25)
          } else if (t < 0.5) {
            color.lerpColors(new THREE.Color('#06b6d4'), new THREE.Color('#22c55e'), (t - 0.25) / 0.25)
          } else if (t < 0.75) {
            color.lerpColors(new THREE.Color('#22c55e'), new THREE.Color('#f97316'), (t - 0.5) / 0.25)
          } else {
            color.lerpColors(new THREE.Color('#f97316'), new THREE.Color('#ef4444'), (t - 0.75) / 0.25)
          }
          colors[vi] = color.r
          colors[vi + 1] = color.g
          colors[vi + 2] = color.b
        }
      }

      // Triangle indices for the patch
      const indices = new Uint32Array((PATCH - 1) * (PATCH - 1) * 6)
      let ii = 0
      for (let iy = 0; iy < PATCH - 1; iy++) {
        for (let ix = 0; ix < PATCH - 1; ix++) {
          const a = iy * PATCH + ix
          const b = a + 1
          const c = a + PATCH
          const d = c + 1
          indices[ii++] = a
          indices[ii++] = c
          indices[ii++] = b
          indices[ii++] = b
          indices[ii++] = c
          indices[ii++] = d
        }
      }

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geom.setIndex(new THREE.BufferAttribute(indices, 1))
      geom.computeVertexNormals()

      const mesh = new THREE.Mesh(geom, material)
      this.heatmapBarMeshes.push(mesh)
      this.heatmapBarGroup.add(mesh)
    }
  }

  private rebuildRoutes() {
    if (!this.map || !this.sceneData || !this.projection) return

    const zoom = this.map.getZoom()
    const revealAlreadyComplete = this.routeRevealComplete

    for (const mesh of this.routeMeshes) {
      this.routeGroup.remove(mesh.main)
      this.routeGroup.remove(mesh.glow)
      mesh.dispose()
    }
    this.routeMeshes = []

    for (const [index, route] of this.sceneData.routes.entries()) {
      const mesh = createRouteMesh(
        route,
        this.projection,
        this.routeGlowTint,
        zoom,
        index * ROUTE_REVEAL_STAGGER_SECONDS,
      )

      if (revealAlreadyComplete) {
        mesh.mainGeometry.setDrawRange(0, mesh.indexCount)
        mesh.glowGeometry.setDrawRange(0, mesh.indexCount)
      }

      this.routeMeshes.push(mesh)
      this.routeGroup.add(mesh.glow, mesh.main)
    }

    if (revealAlreadyComplete) {
      this.routeRevealComplete = true
    }

    this.updateVisibility()
    this.map.triggerRepaint()
  }

  private syncPlaneTransforms() {
    if (!this.map || !this.projection) return

    for (const entry of this.planeMeshes) {
      const visualProgress = getPlaneVisualProgress(entry.plane)
      const prevProgress = Math.max(0, visualProgress - ORIENTATION_SAMPLE_DELTA)
      const nextProgress = Math.min(1, visualProgress + ORIENTATION_SAMPLE_DELTA)

      const point = sampleArcPoint(entry.plane.arc, visualProgress)
      const prevArcPt = sampleArcPoint(entry.plane.arc, prevProgress)
      const nextArcPt = sampleArcPoint(entry.plane.arc, nextProgress)

      const liftNow = getPlaneLiftMeters(entry.plane.distanceMeters, visualProgress)
      const liftPrev = getPlaneLiftMeters(entry.plane.distanceMeters, prevProgress)
      const liftNext = getPlaneLiftMeters(entry.plane.distanceMeters, nextProgress)

      const liftedNow: FlightArcPoint = { ...point, altitudeMeters: point.altitudeMeters + liftNow }
      const liftedPrev: FlightArcPoint = { ...prevArcPt, altitudeMeters: prevArcPt.altitudeMeters + liftPrev }
      const liftedNext: FlightArcPoint = { ...nextArcPt, altitudeMeters: nextArcPt.altitudeMeters + liftNext }

      const worldPos = worldPointFromArcPoint(liftedNow, this.projection)
      const worldPrev = worldPointFromArcPoint(liftedPrev, this.projection)
      const worldNext = worldPointFromArcPoint(liftedNext, this.projection)

      // Cache screen position for click hit-testing — map.project() is always accurate
      entry.screenPos = this.map.project([point.lng, point.lat])

      const worldUp
        = this.projection === 'globe'
          ? worldPos.clone().normalize()
          : MERCATOR_UP_AXIS.clone()
      const laneRight = new THREE.Vector3().crossVectors(
        worldUp,
        worldNext.clone().sub(worldPrev),
      )
      if (laneRight.lengthSq() > 1e-14 && entry.plane.laneOffsetMeters !== 0) {
        laneRight.normalize().multiplyScalar(
          worldScaleForMeters(
            point.lng,
            point.lat,
            entry.plane.laneOffsetMeters,
            this.projection,
          ),
        )
        worldPos.add(laneRight)
      }

      // Always update position — never skip a frame
      entry.mesh.visible = this.settings.showMarkers
        && entry.plane.state !== 'landed'
        && this.routeRevealComplete
      entry.mesh.position.copy(worldPos)

      const tangent = worldNext.clone().sub(worldPrev)

      if (tangent.lengthSq() > 1e-14) {
        tangent.normalize()
        const quaternion = this.computePlaneOrientation(tangent, worldUp)
        if (entry.plane.state === 'flying') {
          quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(tangent, Math.PI / 14))
        }
        entry.mesh.quaternion.copy(quaternion)
      }
      // Degenerate tangent: keep previous frame's quaternion, still update position

      const scaleWorld = worldScaleForMeters(
        point.lng,
        point.lat,
        interpolatePlaneScaleMeters(entry.plane.distanceMeters),
        this.projection,
      )
      entry.mesh.scale.setScalar(scaleWorld)
      entry.mesh.updateMatrix()
      entry.mesh.updateMatrixWorld(true)
    }
  }

  private computePlaneOrientation(tangent: THREE.Vector3, worldUp: THREE.Vector3): THREE.Quaternion {
    const worldRight = new THREE.Vector3().crossVectors(worldUp, tangent)
    if (worldRight.lengthSq() < 1e-8) {
      return new THREE.Quaternion().setFromUnitVectors(this.modelForwardAxis, tangent)
    }
    worldRight.normalize()
    const worldUpOrtho = new THREE.Vector3().crossVectors(tangent, worldRight).normalize()

    const modelRight = new THREE.Vector3().crossVectors(MODEL_UP_AXIS, this.modelForwardAxis)
    if (modelRight.lengthSq() < 1e-8) {
      return new THREE.Quaternion().setFromUnitVectors(this.modelForwardAxis, tangent)
    }
    modelRight.normalize()
    const modelUp = new THREE.Vector3().crossVectors(this.modelForwardAxis, modelRight).normalize()

    const mWorld = new THREE.Matrix4().makeBasis(worldRight, worldUpOrtho, tangent)
    const mModel = new THREE.Matrix4().makeBasis(modelRight, modelUp, this.modelForwardAxis)
    return new THREE.Quaternion().setFromRotationMatrix(mWorld.multiply(mModel.transpose()))
  }

  private updateRouteAnimations(elapsedSeconds: number) {
    if (this.routeRevealStartedAt === 0) {
      this.routeRevealStartedAt = elapsedSeconds
    }

    let allRevealed = true
    for (const mesh of this.routeMeshes) {
      const revealProgress = clamp(
        (elapsedSeconds - this.routeRevealStartedAt - mesh.revealOffsetSeconds)
        / ROUTE_REVEAL_DURATION_SECONDS,
        0,
        1,
      )
      const visibleIndexCount = Math.max(0, Math.floor(mesh.indexCount * revealProgress))
      mesh.mainGeometry.setDrawRange(0, visibleIndexCount)
      mesh.glowGeometry.setDrawRange(0, visibleIndexCount)

      if (revealProgress < 1) {
        allRevealed = false
      }

      const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * ROUTE_PULSE_SPEED + mesh.pulseOffset)
      mesh.mainMaterial.opacity = lerp(
        ROUTE_MAIN_OPACITY_MIN * revealProgress,
        ROUTE_MAIN_OPACITY_MAX * revealProgress,
        pulse,
      )
      mesh.glowMaterial.opacity = lerp(
        ROUTE_GLOW_OPACITY_MIN * revealProgress,
        ROUTE_GLOW_OPACITY_MAX * revealProgress,
        pulse,
      )
    }

    if (allRevealed && !this.routeRevealComplete) {
      this.routeRevealComplete = true
      for (const entry of this.planeMeshes) {
        entry.plane.state = 'flying'
      }
      this.syncPlaneTransforms()
    }
  }

  private updatePlaneAnimations(deltaSeconds: number) {
    if (!this.routeRevealComplete) {
      this.syncPlaneTransforms()
      return
    }

    for (const entry of this.planeMeshes) {
      if (entry.plane.state !== 'flying') {
        continue
      }

      entry.plane.progress += deltaSeconds * entry.plane.speedPerSecond
      if (entry.plane.progress >= 1) {
        entry.plane.progress %= 1
      }
    }

    this.syncPlaneTransforms()
  }

  private updateVisibility() {
    this.routeGroup.visible = this.settings.showRoutes
    this.heatmapBarGroup.visible = this.settings.showHeatmap3d
    for (const entry of this.planeMeshes) {
      if (entry.plane.state !== 'flying') {
        entry.mesh.visible = this.settings.showMarkers && entry.plane.state !== 'landed'
      }
    }
  }

  private startPlaneAnimation(event: MapMouseEvent) {
    if (!this.map || !this.settings.showMarkers || this.planeMeshes.length === 0) return

    // Compute canvas dims once — event.point uses CSS pixels, clientWidth matches
    const canvas = this.map.getCanvas()
    const canvasW = canvas.clientWidth || canvas.width
    const canvasH = canvas.clientHeight || canvas.height

    let closestEntry: PlaneMeshEntry | null = null
    let closestDistanceSquared = PICKABLE_PLANE_RADIUS_PX ** 2

    for (const entry of this.planeMeshes) {
      if (entry.plane.state !== 'idle') continue

      const visualProgress = getPlaneVisualProgress(entry.plane)
      const groundPt = sampleArcPoint(entry.plane.arc, visualProgress)
      const liftMeters = getPlaneLiftMeters(entry.plane.distanceMeters, visualProgress)

      let sx: number
      let sy: number

      // Project the actual elevated 3D world position through the last-frame VP matrix.
      // camera.projectionMatrix holds MapLibre's combined view-projection matrix from
      // the most recent render call — valid at click time since the viewport is static.
      if (this.projection && canvasW > 0 && canvasH > 0) {
        const elevatedPt: FlightArcPoint = {
          ...groundPt,
          altitudeMeters: groundPt.altitudeMeters + liftMeters,
        }
        const world = worldPointFromArcPoint(elevatedPt, this.projection)
        const clip = new THREE.Vector4(world.x, world.y, world.z, 1)
          .applyMatrix4(this.camera.projectionMatrix)

        if (Math.abs(clip.w) > 1e-6 && Number.isFinite(clip.w)) {
          sx = ((clip.x / clip.w) * 0.5 + 0.5) * canvasW
          sy = (1 - ((clip.y / clip.w) * 0.5 + 0.5)) * canvasH
        } else {
          // Degenerate clip: fall back to ground-level map projection
          const p = this.map.project([groundPt.lng, groundPt.lat])
          sx = p.x
          sy = p.y
        }
      } else {
        const p = this.map.project([groundPt.lng, groundPt.lat])
        sx = p.x
        sy = p.y
      }

      const dx = sx - event.point.x
      const dy = sy - event.point.y
      const distSq = dx * dx + dy * dy
      if (distSq >= closestDistanceSquared) continue
      closestEntry = entry
      closestDistanceSquared = distSq
    }

    if (!closestEntry) return

    closestEntry.plane.state = 'flying'
    closestEntry.plane.progress = closestEntry.plane.parkedProgress
    this.syncPlaneTransforms()
    this.map.triggerRepaint()
  }

  private renderScene(options: CustomRenderMethodInput) {
    if (!this.renderer || !this.map) {
      return
    }

    const nextProjection = getProjectionName(this.map)
    if (nextProjection !== this.projection) {
      this.rebuildScene()
    }

    this.updateVisibility()

    const now = performance.now()
    const deltaSeconds = this.lastAnimationTime === 0 ? 0 : (now - this.lastAnimationTime) / 1000
    this.lastAnimationTime = now

    const hasAnimatedScene
      = (this.settings.showRoutes && this.routeMeshes.length > 0)
        || (this.settings.showMarkers && this.planeMeshes.length > 0)

    if (!document.hidden && hasAnimatedScene) {
      this.updateRouteAnimations(now / 1000)
      if (this.settings.showMarkers) {
        this.updatePlaneAnimations(deltaSeconds)
      }
      this.map.triggerRepaint()
    }

    this.camera.matrixWorld.identity()
    this.camera.matrixWorldInverse.identity()
    this.camera.projectionMatrix.fromArray(
      options.defaultProjectionData.mainMatrix as unknown as number[],
    )
    this.camera.projectionMatrixInverse
      .copy(this.camera.projectionMatrix)
      .invert()

    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
  }
}
