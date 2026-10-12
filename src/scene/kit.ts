import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js"
import { radialTexture } from "./textures"

export type V3 = [number, number, number]
export type Bucket = "matte" | "metal" | "glass" | "glow" | "facade" | "haze"
export type Tint = THREE.Color | number | string

/** Shared unit primitives. Everything is transformed by matrix, so one
 *  geometry instance can serve thousands of parts. */
const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: new RoundedBoxGeometry(1, 1, 1, 1, 0.14),
  // Keep round silhouettes smooth in the wide establishing shot as well as
  // close up. These are shared and instanced, so extra facets add little cost.
  cyl: new THREE.CylinderGeometry(1, 1, 1, 32, 1, false),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 24, 1, false),
  cone: new THREE.ConeGeometry(1, 1, 32, 1, true),
  sphere: new THREE.SphereGeometry(1, 24, 16),
  capsule: new THREE.CapsuleGeometry(1, 1, 3, 12),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 48),
  plane: new THREE.PlaneGeometry(1, 1),
}

const dummy = new THREE.Object3D()
const tintColor = new THREE.Color()

/** Merging needs every part to agree on indexing, so non-indexed primitives
 *  (RoundedBoxGeometry ships that way) are indexed once and reused. */
const indexed = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
const asIndexed = (geometry: THREE.BufferGeometry) => {
  if (geometry.index) return geometry
  const cached = indexed.get(geometry)
  if (cached) return cached
  const merged = mergeVertices(geometry)
  indexed.set(geometry, merged)
  return merged
}

const materialFor = (color: Tint, intensity: number) => {
  tintColor.set(color as THREE.ColorRepresentation)
  if (intensity !== 1) tintColor.multiplyScalar(intensity)
  return tintColor
}

/** Batches every static part of the studio into one mesh per material so the
 *  scene can stay extremely detailed without paying per-prop draw calls. */
export class Kit {
  /** light-spill cards are a luxury on software renderers */
  hazeEnabled = true
  private parts: Record<Bucket, THREE.BufferGeometry[]> = {
    matte: [],
    metal: [],
    glass: [],
    glow: [],
    facade: [],
    haze: [],
  }
  private base = new THREE.Matrix4()
  private local = new THREE.Matrix4()

  /** Builds the following parts in a local frame; world placement follows. */
  at(position: V3, yaw = 0): this {
    dummy.position.set(position[0], position[1], position[2])
    dummy.rotation.set(0, yaw, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    this.base.copy(dummy.matrix)
    return this
  }

  world(): this {
    this.base.identity()
    return this
  }

  add(
    bucket: Bucket,
    geometry: THREE.BufferGeometry,
    position: V3,
    scale: V3,
    color: Tint,
    rotation: V3 = [0, 0, 0],
    intensity = 1,
  ): this {
    dummy.position.set(position[0], position[1], position[2])
    dummy.rotation.set(rotation[0], rotation[1], rotation[2])
    dummy.scale.set(scale[0], scale[1], scale[2])
    dummy.updateMatrix()
    this.local.multiplyMatrices(this.base, dummy.matrix)
    this.place(bucket, geometry, this.local.clone(), color, intensity)
    return this
  }

  place(
    bucket: Bucket,
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    color: Tint,
    intensity = 1,
  ): this {
    const source = asIndexed(geometry).clone()
    source.applyMatrix4(matrix)
    const count = source.attributes.position.count
    const colors = new Float32Array(count * 3)
    const c = materialFor(color, intensity)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    source.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    for (const key of Object.keys(source.attributes)) {
      if (
        key !== "position" &&
        key !== "normal" &&
        key !== "uv" &&
        key !== "color"
      )
        source.deleteAttribute(key)
    }
    if (!source.attributes.uv) {
      source.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(count * 2), 2),
      )
    }
    this.parts[bucket].push(source)
    return this
  }

  box(
    bucket: Bucket,
    size: V3,
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.box,
      position,
      size,
      color,
      rotation,
      intensity,
    )
  }
  round(
    bucket: Bucket,
    size: V3,
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.rbox,
      position,
      size,
      color,
      rotation,
      intensity,
    )
  }
  cyl(
    bucket: Bucket,
    radius: number,
    height: number,
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
    simple?: boolean,
  ) {
    return this.add(
      bucket,
      simple ? UNIT.cyl8 : UNIT.cyl,
      position,
      [radius, height, radius],
      color,
      rotation,
      intensity,
    )
  }
  cone(
    bucket: Bucket,
    radius: number,
    height: number,
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.cone,
      position,
      [radius, height, radius],
      color,
      rotation,
      intensity,
    )
  }
  ball(
    bucket: Bucket,
    radius: number,
    position: V3,
    color: Tint,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.sphere,
      position,
      [radius, radius, radius],
      color,
      [0, 0, 0],
      intensity,
    )
  }
  capsule(
    bucket: Bucket,
    radius: number,
    length: number,
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.capsule,
      position,
      [radius, length + radius * 2, radius],
      color,
      rotation,
      intensity,
    )
  }
  ring(
    bucket: Bucket,
    radius: number,
    tube: number,
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.torus,
      position,
      [radius, radius, radius],
      color,
      rotation,
      intensity,
    )
  }
  plane(
    bucket: Bucket,
    size: [number, number],
    position: V3,
    color: Tint,
    rotation?: V3,
    intensity?: number,
  ) {
    return this.add(
      bucket,
      UNIT.plane,
      position,
      [size[0], size[1], 1],
      color,
      rotation,
      intensity,
    )
  }

  /** Capsule limb stretched between two points — arms, cables, pipes. */
  limb(
    bucket: Bucket,
    from: V3,
    to: V3,
    radius: number,
    color: Tint,
    intensity?: number,
  ) {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const delta = b.clone().sub(a)
    const length = delta.length()
    const middle = a.clone().add(b).multiplyScalar(0.5)
    dummy.position.copy(middle)
    dummy.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    )
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    this.local.multiplyMatrices(this.base, dummy.matrix)
    this.place(
      bucket,
      UNIT.cyl,
      this.local.clone().scale(new THREE.Vector3(radius, length, radius)),
      color,
      intensity,
    )
    return this
  }

  /** Planar quad with explicit uv scaling, for tiled facades and panels. */
  quad(
    bucket: Bucket,
    width: number,
    height: number,
    position: V3,
    rotation: V3,
    color: Tint,
    uv: [number, number] = [1, 1],
  ) {
    const geometry = UNIT.plane.clone()
    const attribute = geometry.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < attribute.count; i++)
      attribute.setXY(i, attribute.getX(i) * uv[0], attribute.getY(i) * uv[1])
    return this.add(
      bucket,
      geometry,
      position,
      [width, height, 1],
      color,
      rotation,
    )
  }

  /** Soft additive card — light spill on the floor, glow pools, halos. */
  spill(position: V3, size: number, color: Tint, intensity = 1) {
    if (!this.hazeEnabled) return this
    const geometry = UNIT.plane.clone()
    const attribute = geometry.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < attribute.count; i++)
      attribute.setXY(i, attribute.getX(i) * 2 - 1, attribute.getY(i) * 2 - 1)
    return this.add(
      "haze",
      geometry,
      position,
      [size, size, 1],
      color,
      [-Math.PI / 2, 0, 0],
      intensity,
    )
  }

  count(bucket: Bucket) {
    return this.parts[bucket].length
  }

  commit(
    parent: THREE.Object3D,
    materials: Record<Bucket, THREE.Material>,
  ): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    for (const bucket of Object.keys(this.parts) as Bucket[]) {
      const geometries = this.parts[bucket]
      if (!geometries.length) continue
      const merged = mergeGeometries(geometries, false)
      geometries.forEach((geometry) => geometry.dispose())
      this.parts[bucket] = []
      if (!merged)
        throw new Error(`Could not batch the ${bucket} layer of the studio.`)
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, materials[bucket])
      mesh.castShadow = bucket !== "glow" && bucket !== "glass"
      mesh.receiveShadow = bucket === "matte" || bucket === "metal"
      mesh.name = `studio-${bucket}`
      parent.add(mesh)
      meshes.push(mesh)
    }
    return meshes
  }
}

/** Surface grain shared by every lit material in the studio. */
export function grainTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const image = ctx.createImageData(size, size)
  let seed = 1337
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < size * size; i++) {
    const value = 168 + random() * 84
    image.data[i * 4] = value
    image.data[i * 4 + 1] = value
    image.data[i * 4 + 2] = value
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

export interface StudioMaterials {
  matte: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  glass: THREE.Material
  glow: THREE.MeshBasicMaterial
  facade: THREE.MeshBasicMaterial
  haze: THREE.MeshBasicMaterial
}

/** PBR palette tuned for a rain-lit night interior: matte paint, brushed
 *  alloy, smoked glass and untone-mapped neon for the glow layer. */
export function createMaterials(lowPower = false): StudioMaterials {
  const grain = grainTexture()
  const halo = radialTexture("#ffffff", 0.32)
  const materials: StudioMaterials = {
    matte: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0.12,
      roughnessMap: grain,
      envMapIntensity: 1.05,
    }),
    metal: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.94,
      roughnessMap: grain,
      envMapIntensity: 1.5,
    }),
    glass: lowPower
      ? new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.1,
          metalness: 0.5,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          roughness: 0.06,
          metalness: 0.1,
          transparent: true,
          opacity: 0.2,
          envMapIntensity: 2.6,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    glow: new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    }),
    facade: new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      map: null,
    }),
    haze: new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      map: halo,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  }
  // a night interior still needs light on the paintwork — this is the gain
  // applied on top of every vertex colour so dark greys stay readable
  materials.matte.color.setRGB(1.9, 1.9, 1.9)
  materials.metal.color.setRGB(1.45, 1.45, 1.45)
  // the crew shares these materials, so they must survive per-agent teardown
  for (const material of Object.values(materials))
    material.userData.shared = true
  return materials
}

/** Neon emissive intensity used everywhere in the studio. */
export const NEON = 2.6
export const DIM = 1.15
