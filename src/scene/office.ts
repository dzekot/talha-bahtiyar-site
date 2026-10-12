import * as THREE from "three"
import { Kit, type V3 } from "./kit"
import { PALETTE, type StudioFocus } from "./types"
import {
  Screen,
  floorStencil,
  hex,
  linkCardTexture,
  marqueeTexture,
  radialTexture,
  signTexture,
  type ScreenKind,
} from "./textures"

export interface Station {
  id: StudioFocus
  name: string
  accent: number
  desk: V3
  yaw: number
  /** where an agent sits — slightly behind the desk edge, facing the screen */
  seat: V3
  face: number
}

export interface DeskSpot {
  x: number
  z: number
  yaw: number
  accent: number
  room: StudioFocus
}

export interface Waypoints {
  loungeSeat: V3
  loungeFront: V3
  kitchen: V3
  pod: V3
  core: V3
}

export interface Hotspot {
  id: string
  url: string
  label: string
  accent: number
  /** invisible pick plane sitting just in front of the wall display */
  target: THREE.Mesh
  /** the card that unfolds when the pointer is over it */
  card: THREE.Group
  hover: number
  hoverTarget: boolean
  opened: boolean
}

export interface Office {
  group: THREE.Group
  stations: Station[]
  screens: Screen[]
  desks: DeskSpot[]
  core: THREE.Group
  drone: THREE.Group
  hotspots: Hotspot[]
  waypoints: Waypoints
  /** where a walker is allowed to stand */
  bounds: { halfWidth: number; halfDepth: number }
  update: (time: number, vibe: number) => void
  dispose: () => void
}

const PLATE = { w: 24, d: 17.8, y: 0 }

const ROOMS: Record<StudioFocus, {
  name: string
  accent: number
  label: string
  sub: string
}> = {
  studio: {
    name: "STUDIO COMMONS",
    accent: PALETTE.cyan,
    label: "STUDIO",
    sub: "commons / night shift",
  },
  radar: {
    name: "RADARPRO",
    accent: PALETTE.lime,
    label: "RADARPRO",
    sub: "mobility intelligence",
  },
  vektr: {
    name: "VEKTR",
    accent: PALETTE.magenta,
    label: "VEKTR",
    sub: "creative intelligence",
  },
  lab: {
    name: "EXPERIMENTAL LAB",
    accent: PALETTE.violet,
    label: "LAB",
    sub: "emerging technology",
  },
}

function panel(
  parent: THREE.Group,
  texture: THREE.Texture,
  size: [number, number],
  position: V3,
  rotation: V3 = [0, 0, 0],
  disposables: { dispose(): void }[],
) {
  const geometry = new THREE.PlaneGeometry(size[0], size[1])
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    transparent: true,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.set(rotation[0], rotation[1], rotation[2])
  parent.add(mesh)
  disposables.push(geometry, material, texture)
  return mesh
}

/** Builds one working position: desk, monitor arm, peripherals, chair. */
interface WorkstationOptions {
  x: number
  z: number
  yaw: number
  accent: number
  kind: ScreenKind
  title: string
  room: StudioFocus
}

function workstation(
  kit: Kit,
  parent: THREE.Group,
  screens: Screen[],
  disposables: { dispose(): void }[],
  quality: number,
  options: {
    x: number
    z: number
    yaw: number
    accent: number
    kind: ScreenKind
    title: string
    room: StudioFocus
  },
) {
  const { x, z, yaw, accent, kind, title, room } = options
  const color = hex(accent)
  const screen = new Screen(kind, title, accent)
  screens.push(screen)

  kit.at([x, 0, z], yaw)
  // desk: floating glass top on an alloy frame, cable tray underneath
  kit.box("metal", [1.72, 0.07, 0.92], [0, 0.76, 0], PALETTE.metalDark)
  kit.box("matte", [1.66, 0.02, 0.86], [0, 0.81, 0], 0x2a333d)
  kit.box("glow", [1.5, 0.012, 0.025], [0, 0.795, 0.44], accent, undefined, 1.6)
  for (const side of [-1, 1]) {
    kit.box(
      "metal",
      [0.08, 0.74, 0.08],
      [side * 0.78, 0.37, -0.36],
      PALETTE.metal,
    )
    kit.box(
      "metal",
      [0.08, 0.74, 0.08],
      [side * 0.78, 0.37, 0.36],
      PALETTE.metal,
    )
    kit.box("metal", [0.07, 0.05, 0.86], [side * 0.78, 0.7, 0], PALETTE.metal)
    kit.box("matte", [0.12, 0.34, 0.7], [side * 0.74, 0.52, 0], PALETTE.fabric)
  }
  kit.box("metal", [1.5, 0.05, 0.2], [0, 0.2, -0.3], PALETTE.metalDark)
  // monitor: arm, shell, panel
  kit.cyl("metal", 0.045, 0.34, [0, 0.95, -0.34], PALETTE.metal)
  kit.box("metal", [0.06, 0.06, 0.3], [0, 1.1, -0.2], PALETTE.metal)
  kit.round("matte", [1.16, 0.68, 0.07], [0, 1.32, -0.12], 0x222b35)
  kit.box("glow", [1.06, 0.02, 0.02], [0, 0.99, -0.14], accent, undefined, 1.4)
  kit.box("matte", [0.3, 0.06, 0.12], [0, 0.83, -0.12], 0x1b222a)
  // peripherals
  kit.box("matte", [0.46, 0.018, 0.16], [-0.02, 0.835, 0.26], 0x2a333d)
  kit.box(
    "glow",
    [0.36, 0.006, 0.1],
    [-0.02, 0.845, 0.26],
    accent,
    undefined,
    0.9,
  )
  kit.box("matte", [0.16, 0.12, 0.1], [0.6, 0.87, 0.24], 0x323c47)
  kit.box(
    "glow",
    [0.1, 0.04, 0.01],
    [0.6, 0.9, 0.3],
    PALETTE.lime,
    undefined,
    1.1,
  )
  kit.cyl("matte", 0.055, 0.11, [-0.58, 0.87, 0.24], PALETTE.metal)
  kit.ring(
    "glow",
    0.075,
    0.02,
    [-0.58, 0.93, 0.24],
    accent,
    [Math.PI / 2, 0, 0],
    1.1,
  )
  // desk lamp throwing a cone onto the work surface
  kit.cyl("metal", 0.025, 0.5, [0.74, 1.08, 0.1], PALETTE.metal, [0, 0, -0.3])
  kit.cone("metal", 0.12, 0.16, [0.82, 1.32, 0.1], 0x3d4854, [Math.PI, 0, 0])
  kit.ball("glow", 0.05, [0.84, 1.26, 0.1], 0xfff0d0, 1.6)
  // a second small screen for the busiest desks
  if ((kind === "code" || kind === "render") && quality > 0.5) {
    const facing = yaw + 0.5
    const side = new Screen(
      kind === "code" ? "wave" : "chart",
      "sidecar",
      accent,
      384,
      224,
    )
    screens.push(side)
    const geometry = new THREE.PlaneGeometry(0.56, 0.33)
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ map: side.texture, toneMapped: false }),
    )
    mesh.position.set(
      x + Math.sin(facing) * 0.86,
      1.06,
      z + Math.cos(facing) * 0.86,
    )
    mesh.rotation.set(0, facing, 0)
    parent.add(mesh)
    disposables.push(geometry, mesh.material)
    kit.box(
      "metal",
      [0.62, 0.4, 0.05],
      [x + Math.sin(facing) * 0.82, 1.06, z + Math.cos(facing) * 0.82],
      0x222b35,
      [0, facing, 0],
    )
  }
  // desk light spilling onto the floor
  kit.world()
  kit.spill(
    [x - Math.sin(yaw) * 0.3, 0.012, z - Math.cos(yaw) * 0.3],
    3.4,
    color,
    0.16,
  )

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 0.57),
    new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }),
  )
  screenMesh.position.set(
    x - Math.sin(yaw) * 0.08,
    1.32,
    z - Math.cos(yaw) * 0.08,
  )
  screenMesh.rotation.set(0, yaw, 0)
  parent.add(screenMesh)
  disposables.push(screenMesh.geometry, screenMesh.material)

  // chair, built at the seat position
  const seat = 0.92
  const cx = x + Math.sin(yaw) * seat
  const cz = z + Math.cos(yaw) * seat
  kit.at([cx, 0, cz], yaw + Math.PI)
  kit.cyl("metal", 0.05, 0.3, [0, 0.24, 0], PALETTE.metal)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    kit.box(
      "metal",
      [0.07, 0.05, 0.36],
      [Math.sin(angle) * 0.16, 0.07, Math.cos(angle) * 0.16],
      PALETTE.metalDark,
      [0, angle, 0],
    )
    kit.cyl(
      "metal",
      0.06,
      0.05,
      [Math.sin(angle) * 0.32, 0.05, Math.cos(angle) * 0.32],
      0x15191e,
      [Math.PI / 2, 0, angle],
    )
  }
  kit.box("matte", [0.56, 0.1, 0.54], [0, 0.44, 0], PALETTE.fabric)
  kit.box(
    "matte",
    [0.52, 0.62, 0.09],
    [0, 0.78, -0.26],
    PALETTE.fabric,
    [0.12, 0, 0],
  )
  kit.box(
    "glow",
    [0.44, 0.02, 0.02],
    [0, 1.06, -0.29],
    accent,
    [0.12, 0, 0],
    0.7,
  )
  for (const side of [-1, 1]) {
    kit.box(
      "metal",
      [0.05, 0.05, 0.34],
      [side * 0.3, 0.62, -0.06],
      PALETTE.metal,
    )
    kit.box(
      "matte",
      [0.07, 0.16, 0.3],
      [side * 0.3, 0.55, -0.06],
      PALETTE.fabric,
    )
  }
  kit.cyl("metal", 0.03, 0.2, [0, 0.52, 0], PALETTE.metal)
  kit.world()

  return {
    station: {
      id: room,
      name: ROOMS[room].name,
      accent,
      desk: [x, 0, z] as V3,
      yaw,
      seat: [cx, 0, cz] as V3,
      face: yaw,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Room shell                                                          */
/* ------------------------------------------------------------------ */

function floorPlate(kit: Kit) {
  const { w, d } = PLATE
  // slab + edge beam so the plate reads as a slice of a tower
  kit.box("matte", [w + 0.6, 0.5, d + 0.6], [0, -0.28, 0], 0x0b0f16)
  kit.box("metal", [w + 0.7, 0.12, d + 0.7], [0, -0.56, 0], PALETTE.metalDark)
  for (let i = 0; i < 26; i++) {
    kit.box(
      "glow",
      [0.5, 0.05, 0.05],
      [-w / 2 + 0.4 + i * ((w - 0.8) / 25), -0.5, d / 2 + 0.4],
      i % 3 === 0 ? PALETTE.neonPink : PALETTE.cyan,
      undefined,
      0.7,
    )
  }
  // panels
  const tilesX = 13
  const tilesZ = 9
  for (let x = 0; x < tilesX; x++) {
    for (let z = 0; z < tilesZ; z++) {
      const px = -w / 2 + (x + 0.5) * (w / tilesX)
      const pz = -d / 2 + (z + 0.5) * (d / tilesZ)
      const shade = (x + z) % 2 ? PALETTE.floorAlt : PALETTE.floor
      kit.box(
        "matte",
        [w / tilesX - 0.05, 0.06, d / tilesZ - 0.05],
        [px, -0.02, pz],
        shade,
      )
    }
  }
  // inlaid neon walkways
  kit.box(
    "glow",
    [w - 0.6, 0.012, 0.05],
    [0, 0.03, 2.2],
    PALETTE.cyan,
    undefined,
    0.5,
  )
  kit.box(
    "glow",
    [0.04, 0.012, d - 1.2],
    [-3.2, 0.03, 0],
    PALETTE.cyan,
    undefined,
    0.22,
  )
  kit.box(
    "glow",
    [0.04, 0.012, d - 1.2],
    [3.4, 0.03, 0],
    PALETTE.magenta,
    undefined,
    0.22,
  )
  kit.spill([0, 0.02, 2.2], 6, hex(PALETTE.cyan), 0.07)
  // wet patches
  for (const [x, z, s, i] of [
    [-6.6, 4.6, 3.2, 0.09],
    [5.4, -4.4, 2.6, 0.07],
    [2.2, 5.2, 3.8, 0.08],
    [-2.4, -5.2, 2.4, 0.06],
  ] as [number, number, number, number][]) {
    kit.spill([x, 0.015, z], s, "#9fd8ff", i)
  }
}

function shell(kit: Kit, quality: number) {
  const { w, d } = PLATE
  const H = 8.35
  // back glazing: mullions + tinted glass so the skyline reads through it
  for (let i = 0; i <= 12; i++) {
    kit.box(
      "metal",
      [0.14, H, 0.16],
      [-w / 2 + (i * w) / 12, H / 2, -d / 2],
      PALETTE.trim,
    )
  }
  for (const y of [0.12, H - 0.12, 1.9])
    kit.box("metal", [w, 0.12, 0.16], [0, y, -d / 2], PALETTE.trim)
  kit.box("glass", [w, H - 0.3, 0.04], [0, H / 2, -d / 2], 0x6fa8c8)
  // side walls
  for (const side of [-1, 1]) {
    kit.box(
      "matte",
      [0.4, H, d],
      [side * (w / 2 + 0.2), H / 2, 0],
      PALETTE.wallDeep,
    )
    kit.box(
      "matte",
      [0.1, 0.3, d],
      [side * (w / 2 - 0.02), 0.16, 0],
      PALETTE.trim,
    )
    kit.box(
      "glow",
      [0.04, 0.04, d],
      [side * (w / 2 - 0.02), 2.6, 0],
      side < 0 ? PALETTE.cyan : PALETTE.magenta,
      undefined,
      0.8,
    )
    // panel detailing
    for (let i = 0; i < 7; i++) {
      kit.box(
        "matte",
        [0.08, 1.5, 1.4],
        [side * (w / 2 - 0.05), 1.7, -d / 2 + 1.6 + i * 1.7],
        PALETTE.wall,
      )
      kit.box(
        "metal",
        [0.1, 0.05, 1.5],
        [side * (w / 2 - 0.06), 0.92, -d / 2 + 1.6 + i * 1.7],
        PALETTE.trim,
      )
    }
  }
  // Open roof for the architectural cutaway; a clean perimeter beam frames the
  // full-height glass while leaving the upper studio visible from outside.
  for (const x of [-w / 2, w / 2])
    kit.box("metal", [0.22, 0.18, d + 0.25], [x, H + 0.06, 0], PALETTE.trim)
  kit.box("metal", [w + 0.2, 0.18, 0.22], [0, H + 0.06, -d / 2], PALETTE.trim)
}

/** A quieter upper studio level overlooking the active floor below. */
function upperLevel(kit: Kit) {
  const { w } = PLATE
  const y = 4.28
  const back = -5.05
  const front = 0.75
  const depth = front - back

  // A cantilevered gallery with a warm timber inset and exposed steel edge.
  kit.box("metal", [w - 2.2, 0.22, depth + 0.3], [0, y - 0.14, (front + back) / 2], 0x27313b)
  kit.box("matte", [w - 2.35, 0.06, depth], [0, y - 0.005, (front + back) / 2], 0x36322e)
  kit.box("matte", [w - 3, 0.025, depth - 0.35], [0, y + 0.04, (front + back) / 2], 0x45403a)

  // Structural columns and a glass balustrade make the second floor read as
  // architecture rather than a floating prop shelf.
  for (const x of [-10.2, -5.1, 0, 5.1, 10.2]) {
    kit.box("metal", [0.28, y * 2, 0.3], [x, y, -2.4], PALETTE.trim)
    kit.box("glow", [0.035, 3.3, 0.04], [x + 0.17, 5.75, -2.4], PALETTE.cyan, undefined, 0.22)
  }
  kit.box("glass", [w - 2.25, 0.86, 0.045], [0, y + 0.55, front], 0x8bb9cb)
  kit.box("metal", [w - 2.25, 0.08, 0.12], [0, y + 1.02, front], PALETTE.trim)
  kit.box("metal", [w - 2.25, 0.06, 0.1], [0, y + 0.08, front], PALETTE.trim)
  for (const x of [-8.8, -4.4, 0, 4.4, 8.8]) {
    kit.box("metal", [0.07, 0.92, 0.1], [x, y + 0.53, front], PALETTE.trim)
  }

  // Three calm work bays: large collaborative tables, task lamps and acoustic
  // fins. They are intentionally less saturated than the ground-floor labs.
  for (const x of [-6.5, 0, 6.5]) {
    kit.box("matte", [4.8, 0.12, 1.65], [x, y + 0.76, -3.25], 0x303943)
    for (const dx of [-2, 2]) {
      for (const dz of [-0.55, 0.55]) {
        kit.box("metal", [0.07, 0.72, 0.07], [x + dx, y + 0.36, -3.25 + dz], PALETTE.metalDark)
      }
    }
    for (let i = 0; i < 2; i++) {
      const sx = x - 0.7 + i * 1.4
      kit.box("matte", [0.95, 0.055, 0.62], [sx, y + 0.86, -3.25], 0x111923)
      kit.box("glass", [0.88, 0.52, 0.045], [sx, y + 1.16, -3.48], 0x8093a0)
      kit.box("glow", [0.68, 0.012, 0.018], [sx, y + 1.05, -3.45], i ? PALETTE.amber : PALETTE.cyan, undefined, 0.32)
    }
    for (const dx of [-1.55, 0, 1.55]) {
      kit.cyl("metal", 0.3, 0.08, [x + dx, y + 0.48, -1.85], PALETTE.metalDark)
      kit.cyl("metal", 0.045, 0.45, [x + dx, y + 0.25, -1.85], PALETTE.trim)
    }
    // Warm linear task light suspended from the open roof structure.
    kit.box("metal", [0.045, 0.48, 0.045], [x, 7.96, -3.25], PALETTE.trim)
    kit.box("glow", [3.2, 0.075, 0.34], [x, 7.68, -3.25], 0xffd39a, undefined, 0.55)
  }

  // Lightly smoked glass dividers give the loft three distinct work suites
  // while keeping the double-height room legible from the exterior.
  for (const x of [-3.25, 3.25]) {
    kit.box("glass", [0.055, 2.35, 5.25], [x, y + 1.28, -2.18], 0x91a9b5)
    for (const z of [-4.8, -2.18, 0.42]) {
      kit.box("metal", [0.075, 2.42, 0.075], [x, y + 1.28, z], PALETTE.trim)
    }
    kit.box("metal", [0.08, 0.08, 5.35], [x, y + 2.46, -2.18], PALETTE.trim)
    kit.box("metal", [0.08, 0.06, 5.35], [x, y + 0.1, -2.18], PALETTE.trim)
  }

  // A restrained stair sits at the west end and connects both levels.
  const stairX = -9.25
  for (let i = 0; i < 14; i++) {
    const rise = (i + 1) * 0.3
    const z = 3.75 - i * 0.38
    kit.box("metal", [1.25, 0.13, 0.43], [stairX, rise, z], i % 2 ? 0x343d47 : 0x252d36)
    kit.box("glow", [1.12, 0.018, 0.028], [stairX, rise + 0.075, z + 0.16], PALETTE.amber, undefined, 0.28)
  }
  for (const side of [-1, 1]) {
    kit.box("metal", [0.09, 3.9, 0.1], [stairX + side * 0.69, 2.35, 1.18], PALETTE.trim, [0.72, 0, 0])
  }
  kit.box("glow", [w - 3.2, 0.025, 0.045], [0, y + 0.07, back + 0.35], PALETTE.amber, undefined, 0.22)
}

function parapet(kit: Kit) {
  const { w, d } = PLATE
  // open front edge with a low guard rail — reads as a cutaway floor
  for (const side of [-1, 1]) {
    kit.box(
      "matte",
      [0.3, 0.44, d + 0.4],
      [side * (w / 2 + 0.1), 0.22, 0],
      PALETTE.wallDeep,
    )
    kit.box(
      "glow",
      [0.06, 0.05, d + 0.2],
      [side * (w / 2 + 0.1), 0.46, 0],
      PALETTE.cyan,
      undefined,
      1.2,
    )
    for (let i = 0; i < 5; i++) {
      kit.cyl(
        "metal",
        0.05,
        0.9,
        [side * (w / 2 + 0.1), 0.9, -d / 2 + 1 + i * ((d - 2) / 4)],
        PALETTE.trim,
      )
    }
    kit.box(
      "metal",
      [0.1, 0.08, d - 0.4],
      [side * (w / 2 + 0.1), 1.36, 0],
      PALETTE.trim,
    )
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function coreColumn(
  kit: Kit,
  group: THREE.Group,
  disposables: { dispose(): void }[],
) {
  const [x, z] = [0, -2.6]
  // plinth + steps
  kit.cyl("matte", 1.8, 0.16, [x, 0.08, z], PALETTE.trim)
  kit.cyl("matte", 1.5, 0.14, [x, 0.22, z], 0x232f3b)
  kit.cyl("metal", 1.38, 0.06, [x, 0.3, z], 0x36414d)
  kit.ring(
    "glow",
    1.46,
    0.035,
    [x, 0.31, z],
    PALETTE.cyan,
    [Math.PI / 2, 0, 0],
    0.55,
  )
  kit.spill([x, 0.33, z], 4.2, hex(PALETTE.cyan), 0.1)
  // slim column, open at the top so the core reads as a floating core
  kit.cyl("metal", 0.44, 1.5, [x, 1.05, z], 0x36414d)
  kit.cyl("matte", 0.52, 0.22, [x, 0.42, z], 0x28323d)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    kit.box(
      "glow",
      [0.05, 1.1, 0.05],
      [x + Math.cos(angle) * 0.46, 1.1, z + Math.sin(angle) * 0.46],
      i % 2 ? PALETTE.cyan : PALETTE.violet,
      undefined,
      0.9,
    )
  }
  kit.cyl("matte", 0.78, 0.12, [x, 1.86, z], PALETTE.trim)
  kit.cyl("metal", 0.88, 0.07, [x, 1.95, z], 0x3c4753)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
    kit.box(
      "metal",
      [0.07, 1.7, 0.07],
      [x + Math.cos(angle) * 0.6, 2.9, z + Math.sin(angle) * 0.6],
      PALETTE.trim,
    )
  }
  kit.box("metal", [1.5, 0.08, 1.5], [x, 3.78, z], 0x39434f)
  kit.ring(
    "glow",
    0.82,
    0.03,
    [x, 1.99, z],
    PALETTE.violet,
    [Math.PI / 2, 0, 0],
    0.7,
  )

  const core = new THREE.Group()
  core.position.set(x, 2.72, z)
  group.add(core)

  const ringMaterial = (color: number, opacity: number) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })

  const rings = [
    {
      radius: 0.92,
      tube: 0.03,
      color: PALETTE.cyan,
      opacity: 0.55,
      speed: 0.5,
      tilt: [Math.PI / 2, 0, 0] as V3,
    },
    {
      radius: 0.74,
      tube: 0.028,
      color: PALETTE.magenta,
      opacity: 0.5,
      speed: -0.75,
      tilt: [0.5, 0.3, 0] as V3,
    },
    {
      radius: 0.58,
      tube: 0.022,
      color: PALETTE.violet,
      opacity: 0.45,
      speed: 1.1,
      tilt: [1.2, 0, 0.4] as V3,
    },
  ].map((spec) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius, spec.tube, 8, 64),
      ringMaterial(spec.color, spec.opacity),
    )
    mesh.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2])
    mesh.userData.speed = spec.speed
    core.add(mesh)
    disposables.push(mesh.geometry, mesh.material)
    return mesh
  })

  const orbMaterial = new THREE.MeshBasicMaterial({
    color: 0x6fd2ff,
    toneMapped: false,
  })
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 2),
    orbMaterial,
  )
  core.add(orb)
  disposables.push(orb.geometry, orbMaterial)

  const cage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 1),
    new THREE.MeshBasicMaterial({
      color: PALETTE.cyan,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
    }),
  )
  core.add(cage)
  disposables.push(cage.geometry, cage.material as THREE.Material)

  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture("#8fe9ff", 0.3),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.85,
    }),
  )
  glowSprite.scale.set(1.7, 1.7, 1)
  core.add(glowSprite)
  disposables.push(glowSprite.material)

  return { core, rings, orb, cage }
}

function lounge(
  kit: Kit,
  screens: Screen[],
  disposables: { dispose(): void }[],
) {
  // sofa + rug + coffee table with a floating display
  const [x, z] = [-6.4, 4.4]
  kit.box("matte", [3.2, 0.02, 2.4], [x, 0.03, z], 0x161d27)
  kit.box(
    "glow",
    [3.0, 0.01, 2.2],
    [x, 0.045, z],
    PALETTE.violet,
    undefined,
    0.3,
  )
  kit.box("matte", [2.2, 0.42, 0.9], [x, 0.24, z - 0.5], PALETTE.fabric)
  kit.box(
    "matte",
    [2.2, 0.72, 0.22],
    [x, 0.6, z - 0.85],
    PALETTE.fabric,
    [-0.12, 0, 0],
  )
  for (const side of [-1, 1]) {
    kit.box(
      "matte",
      [0.22, 0.56, 0.9],
      [x + side * 1.1, 0.38, z - 0.5],
      PALETTE.fabric,
    )
    kit.box(
      "glow",
      [0.03, 0.03, 0.7],
      [x + side * 1.1, 0.62, z - 0.5],
      PALETTE.cyan,
      undefined,
      0.8,
    )
  }
  for (let i = 0; i < 3; i++)
    kit.box(
      "matte",
      [0.62, 0.1, 0.6],
      [x - 0.7 + i * 0.7, 0.5, z - 0.62],
      i === 1 ? PALETTE.magenta : 0x2c3644,
      [0.1, i * 0.2, 0],
    )
  kit.cyl("matte", 0.5, 0.06, [x + 0.2, 0.42, z + 0.6], 0x1c242e)
  kit.cyl("metal", 0.08, 0.4, [x + 0.2, 0.2, z + 0.6], PALETTE.metalDark)
  kit.cyl("metal", 0.32, 0.05, [x + 0.2, 0.03, z + 0.6], PALETTE.metalDark)

  const loungeScreen = new Screen(
    "wave",
    "night shift radio",
    PALETTE.magenta,
    512,
    256,
  )
  screens.push(loungeScreen)
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.45),
    new THREE.MeshBasicMaterial({
      map: loungeScreen.texture,
      toneMapped: false,
      transparent: true,
    }),
  )
  table.position.set(x + 0.2, 1.05, z + 0.6)
  table.rotation.set(-0.5, 0.3, 0)
  disposables.push(table.geometry, table.material)
  kit.world()

  // standing lamp + plants
  kit.cyl("metal", 0.05, 1.7, [x - 1.6, 0.85, z + 0.4], PALETTE.trim)
  kit.cone("matte", 0.3, 0.34, [x - 1.6, 1.75, z + 0.4], 0x3b4552)
  kit.ball("glow", 0.14, [x - 1.6, 1.66, z + 0.4], PALETTE.amber, 1.6)
  kit.spill([x - 1.6, 0.02, z + 0.4], 2.4, hex(PALETTE.amber), 0.12)
  return { sofa: [x, 0, z - 0.1] as V3, seat: [x + 0.1, 0.52, z - 0.5] as V3 }
}

function kitchen(kit: Kit) {
  const [x, z] = [6.6, 4.2]
  kit.box("matte", [3.4, 0.92, 0.8], [x, 0.46, z], 0x222c37)
  kit.box("metal", [3.5, 0.08, 0.86], [x, 0.95, z], 0x39434f)
  kit.box(
    "glow",
    [3.3, 0.02, 0.1],
    [x, 0.42, z - 0.42],
    PALETTE.amber,
    undefined,
    0.8,
  )
  for (let i = 0; i < 5; i++) {
    kit.box(
      "metal",
      [0.6, 0.7, 0.04],
      [x - 1.4 + i * 0.7, 0.5, z + 0.42],
      0x2c3540,
    )
    kit.box(
      "glow",
      [0.4, 0.02, 0.02],
      [x - 1.4 + i * 0.7, 0.76, z + 0.45],
      PALETTE.cyan,
      undefined,
      0.7,
    )
  }
  // coffee machine + cups + shelves
  kit.box("matte", [0.5, 0.5, 0.4], [x - 1.1, 1.24, z], 0x2b3540)
  kit.box(
    "glow",
    [0.3, 0.1, 0.02],
    [x - 1.1, 1.3, z - 0.21],
    PALETTE.lime,
    undefined,
    1.2,
  )
  for (let i = 0; i < 4; i++)
    kit.cyl(
      "matte",
      0.06,
      0.1,
      [x - 0.2 + i * 0.22, 1.04, z - 0.1],
      i % 2 ? PALETTE.magenta : 0xd7dee6,
    )
  for (let s = 0; s < 2; s++) {
    kit.box("metal", [2.6, 0.06, 0.3], [x, 1.9 + s * 0.5, z + 0.3], 0x39434f)
    for (let i = 0; i < 7; i++) {
      kit.cyl(
        "matte",
        0.07,
        0.22,
        [x - 1.1 + i * 0.34, 2.05 + s * 0.5, z + 0.3],
        [0x3d4a58, 0x54424a, 0x3a4a44][i % 3],
      )
    }
  }
  // vending machine
  kit.box("matte", [1.3, 2.2, 0.7], [x + 1.1, 1.1, z - 1.2], 0x1a222c)
  kit.box(
    "glow",
    [1.1, 1.5, 0.06],
    [x + 1.1, 1.3, z - 1.56],
    PALETTE.magenta,
    undefined,
    0.55,
  )
  kit.box(
    "glow",
    [0.9, 0.08, 0.04],
    [x + 1.1, 2.02, z - 1.58],
    0xffffff,
    undefined,
    1.2,
  )
  for (let i = 0; i < 3; i++)
    kit.box(
      "glow",
      [0.86, 0.02, 0.02],
      [x + 1.1, 0.8 + i * 0.45, z - 1.59],
      hex(PALETTE.cyan),
      undefined,
      0.9,
    )
  kit.spill([x + 1.1, 0.02, z - 1.8], 3.2, hex(PALETTE.magenta), 0.16)
  // bar stools
  for (let i = 0; i < 3; i++) {
    kit.cyl("matte", 0.2, 0.08, [x - 1.2 + i * 0.6, 0.68, z + 0.85], 0x2b3540)
    kit.cyl(
      "metal",
      0.05,
      0.64,
      [x - 1.2 + i * 0.6, 0.34, z + 0.85],
      PALETTE.metal,
    )
    kit.cyl(
      "metal",
      0.26,
      0.04,
      [x - 1.2 + i * 0.6, 0.03, z + 0.85],
      PALETTE.metalDark,
    )
  }
  return { standing: [x - 0.2, 0, z + 1.7] as V3 }
}

function serverCorner(kit: Kit) {
  const [x, z] = [7.4, -5.2]
  kit.box("matte", [3, 2.8, 0.9], [x, 1.4, z], 0x161d26)
  for (let i = 0; i < 6; i++) {
    kit.box("metal", [2.6, 0.36, 0.06], [x, 0.5 + i * 0.42, z + 0.47], 0x212a34)
    for (let j = 0; j < 9; j++) {
      kit.ball(
        "glow",
        0.028,
        [x - 1.1 + j * 0.28, 0.5 + i * 0.42, z + 0.51],
        j % 4 === 0 ? PALETTE.lime : j % 3 === 0 ? PALETTE.amber : PALETTE.cyan,
        0.9,
      )
    }
  }
  kit.box(
    "glow",
    [2.7, 0.05, 0.05],
    [x, 2.72, z + 0.47],
    PALETTE.cyan,
    undefined,
    1.4,
  )
  // cable spaghetti
  for (let i = 0; i < 6; i++) {
    kit.limb(
      "matte",
      [x - 1 + i * 0.4, 2.5, z + 0.5],
      [x - 1.2 + i * 0.45, 0.4, z + 0.62],
      0.03,
      [0x2a4a5a, 0x5a2a4a, 0x4a4a2a][i % 3],
    )
  }
  kit.box("matte", [1.2, 0.9, 0.8], [x + 1.9, 0.45, z + 0.4], 0x202933)
  kit.box(
    "glow",
    [0.8, 0.05, 0.02],
    [x + 1.9, 0.8, z + 0.82],
    PALETTE.violet,
    undefined,
    1,
  )
}

function meetingPod(
  kit: Kit,
  screens: Screen[],
  disposables: { dispose(): void }[],
) {
  const [x, z] = [-6.6, 0.6]
  kit.box("matte", [4.2, 0.04, 3.6], [x, 0.03, z], 0x141b24)
  kit.box("glow", [4.0, 0.01, 3.4], [x, 0.05, z], PALETTE.cyan, undefined, 0.25)
  // glass box with a frame
  const glassW = 3.6
  const glassD = 3
  for (const [dx, dz] of [
    [-glassW / 2, -glassD / 2],
    [glassW / 2, -glassD / 2],
    [-glassW / 2, glassD / 2],
    [glassW / 2, glassD / 2],
  ]) {
    kit.box("metal", [0.1, 2.7, 0.1], [x + dx, 1.35, z + dz], PALETTE.trim)
  }
  kit.box(
    "metal",
    [glassW + 0.1, 0.12, 0.12],
    [x, 2.72, z - glassD / 2],
    PALETTE.trim,
  )
  kit.box(
    "metal",
    [glassW + 0.1, 0.12, 0.12],
    [x, 2.72, z + glassD / 2],
    PALETTE.trim,
  )
  kit.box(
    "metal",
    [0.12, 0.12, glassD],
    [x - glassW / 2, 2.72, z],
    PALETTE.trim,
  )
  kit.box(
    "metal",
    [0.12, 0.12, glassD],
    [x + glassW / 2, 2.72, z],
    PALETTE.trim,
  )
  kit.box("glass", [glassW, 2.7, 0.03], [x, 1.35, z - glassD / 2], 0x7fc8e0)
  kit.box("glass", [glassW, 2.7, 0.03], [x, 1.35, z + glassD / 2], 0x7fc8e0)
  kit.box("glass", [0.03, 2.7, glassD], [x - glassW / 2, 1.35, z], 0x7fc8e0)
  kit.box("glass", [0.03, 2.7, glassD], [x + glassW / 2, 1.35, z], 0x7fc8e0)
  // table + stools
  kit.cyl("matte", 0.9, 0.07, [x, 0.74, z], 0x1b232d)
  kit.cyl("metal", 0.14, 0.7, [x, 0.37, z], PALETTE.metalDark)
  kit.cyl("metal", 0.42, 0.05, [x, 0.04, z], PALETTE.metalDark)
  kit.ring(
    "glow",
    0.9,
    0.04,
    [x, 0.79, z],
    PALETTE.violet,
    [Math.PI / 2, 0, 0],
    1,
  )
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4
    kit.cyl(
      "matte",
      0.2,
      0.1,
      [x + Math.sin(angle) * 1.4, 0.44, z + Math.cos(angle) * 1.4],
      PALETTE.fabric,
    )
    kit.cyl(
      "metal",
      0.05,
      0.42,
      [x + Math.sin(angle) * 1.4, 0.21, z + Math.cos(angle) * 1.4],
      PALETTE.metal,
    )
  }
  const podScreen = new Screen("chat", "standup / sync", PALETTE.cyan, 448, 252)
  screens.push(podScreen)
  const pod = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.18),
    new THREE.MeshBasicMaterial({ map: podScreen.texture, toneMapped: false }),
  )
  pod.position.set(x, 1.8, z - glassD / 2 + 0.06)
  disposables.push(pod.geometry, pod.material)
  return { table: [x, 0, z + 1.9] as V3 }
}

/** Foreground framing: a low planter island at the entry so the shot has a
 *  near layer, with a holographic studio mark floating above it. */
function entryIsland(kit: Kit) {
  const [x, z] = [0, 4.9]
  kit.box("matte", [3.2, 0.5, 1], [x, 0.25, z], 0x222c37)
  kit.box("metal", [3.3, 0.08, 1.1], [x, 0.52, z], 0x36414d)
  kit.box(
    "glow",
    [3.1, 0.02, 0.05],
    [x, 0.5, z - 0.52],
    PALETTE.cyan,
    undefined,
    0.8,
  )
  kit.box("matte", [3, 0.08, 0.8], [x, 0.55, z], 0x1b2a26)
  let seed = 3
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let i = 0; i < 14; i++) {
    const px = x - 1.4 + random() * 2.8
    const pz = z - 0.3 + random() * 0.6
    const height = 0.5 + random() * 0.7
    kit.cyl("matte", 0.03, height, [px, 0.58 + height / 2, pz], 0x2f5a46, [
      (random() - 0.5) * 0.3,
      0,
      (random() - 0.5) * 0.3,
    ])
    for (let k = 0; k < 3; k++) {
      const angle = random() * Math.PI * 2
      kit.box(
        "matte",
        [0.16, 0.06, 0.1],
        [
          px + Math.cos(angle) * 0.12,
          0.6 + height * (0.4 + k * 0.2),
          pz + Math.sin(angle) * 0.12,
        ],
        [0x3f7f62, 0x2f6b55, 0x4f8f6a][k],
        [random(), angle, random()],
      )
    }
  }
  kit.ball("glow", 0.06, [x - 1.2, 1.4, z], PALETTE.lime, 1.2)
  kit.ball("glow", 0.06, [x + 1.1, 1.25, z + 0.1], PALETTE.lime, 1.2)
  kit.spill([x, 0.02, z], 3.4, hex(PALETTE.lime), 0.07)
  return { island: [x, 0.9, z] as V3 }
}

/** A low, sculpted coupe parked just outside Sector 07. */
function sectorSportsCar(kit: Kit) {
  kit.at([-8.8, 0, 3.7], Math.PI / 2)
  const paint = 0x9e1835
  const shadowPaint = 0x641226
  // Low, wide grand-tourer body with a tapered nose and rear haunches.
  kit.round("matte", [4.35, 0.13, 1.9], [0, 0.12, 0], 0x03070b)
  kit.round("metal", [4.05, 0.46, 1.72], [0, 0.43, 0], shadowPaint)
  kit.round("metal", [1.56, 0.3, 1.62], [1.06, 0.75, 0], paint)
  kit.round("metal", [1.02, 0.24, 1.64], [-1.43, 0.69, 0], paint)
  kit.round("metal", [1.52, 0.34, 1.48], [-0.1, 0.91, 0], 0x091b26, [0, 0, -0.1], 0.94)
  kit.round("metal", [0.92, 0.12, 1.58], [-0.16, 1.15, 0], 0x7e152c)
  // Glass canopy and visible pillars give the silhouette a fastback profile.
  kit.round("glass", [1.38, 0.42, 1.28], [-0.12, 0.98, 0], 0x12313c, [0, 0, -0.1], 0.82)
  kit.limb("metal", [0.72, 0.68, -0.62], [0.22, 1.17, -0.59], 0.045, 0x9aa9b6)
  kit.limb("metal", [0.72, 0.68, 0.62], [0.22, 1.17, 0.59], 0.045, 0x9aa9b6)
  kit.limb("metal", [-0.78, 0.68, -0.62], [-0.42, 1.17, -0.59], 0.045, 0x9aa9b6)
  kit.limb("metal", [-0.78, 0.68, 0.62], [-0.42, 1.17, 0.59], 0.045, 0x9aa9b6)
  kit.box("metal", [1.22, 0.035, 0.04], [-0.1, 1.23, -0.58], 0xf2a7b5, undefined, 0.9)
  kit.box("metal", [1.22, 0.035, 0.04], [-0.1, 1.23, 0.58], 0xf2a7b5, undefined, 0.9)
  // Four wide tires and machined hubs (cylinders are rotated onto the axle).
  for (const x of [-1.26, 1.22]) {
    for (const z of [-0.91, 0.91]) {
      kit.cyl("matte", 0.37, 0.25, [x, 0.39, z], 0x080d12, [Math.PI / 2, 0, 0])
      kit.cyl("metal", 0.22, 0.26, [x, 0.39, z * 1.04], 0x9eacb5, [Math.PI / 2, 0, 0])
      kit.cyl("matte", 0.145, 0.275, [x, 0.39, z * 1.055], 0x202d38, [Math.PI / 2, 0, 0])
      kit.cyl("glow", 0.055, 0.29, [x, 0.39, z * 1.07], 0xf2a7b5, [Math.PI / 2, 0, 0], 0.85)
      for (let spoke = 0; spoke < 5; spoke++) {
        const angle = (spoke * Math.PI * 2) / 5
        kit.box("metal", [0.19, 0.035, 0.025], [x + Math.cos(angle) * 0.075, 0.39 + Math.sin(angle) * 0.075, z * 1.085], 0xbac4cc, [0, 0, angle])
      }
    }
  }
  // Narrow LED lamps, dark grille, sculpted side intakes, mirrors and diffuser.
  for (const z of [-0.57, 0.57]) {
    kit.box("glow", [0.12, 0.06, 0.48], [1.91, 0.61, z], 0xf4f7ff, undefined, 2.1)
    kit.box("metal", [0.08, 0.2, 0.44], [1.96, 0.39, z], 0x101820)
    kit.box("metal", [1.7, 0.05, 0.06], [-0.05, 0.44, z * 1.37], 0x1b2630)
    kit.box("metal", [0.23, 0.12, 0.18], [0.54, 0.93, z * 1.18], paint)
    kit.box("glass", [0.12, 0.07, 0.14], [0.54, 1.01, z * 1.23], 0x172d3a)
  }
  kit.box("metal", [0.12, 0.11, 0.9], [1.98, 0.43, 0], 0x131d27)
  kit.box("glow", [0.09, 0.065, 1.25], [-1.94, 0.61, 0], 0xff254f, undefined, 2.1)
  kit.box("metal", [0.18, 0.065, 1.72], [-1.83, 1.06, 0], 0x293541)
  kit.box("metal", [0.1, 0.23, 0.12], [-1.73, 0.93, -0.66], 0x293541)
  kit.box("metal", [0.1, 0.23, 0.12], [-1.73, 0.93, 0.66], 0x293541)
  kit.box("glow", [0.1, 0.035, 1.1], [1.62, 0.35, 0], 0x7ce8ff, undefined, 0.8)
  kit.spill([1.65, 0.3, 0], 1.4, 0x93dfff, 0.22)
  kit.spill([-1.45, 0.24, 0], 1.2, 0xff3359, 0.14)
  kit.world()
}

interface SiteWallOptions {
  id: string
  url: string
  label: string
  kind: ScreenKind
  accent: number
  position: V3
  rotation: number
  size: [number, number]
}

/** A wall display showing the studio's own site, plus the holographic link
 *  that unfolds when the pointer lands on it. */
function siteWall(
  group: THREE.Group,
  kit: Kit,
  screens: Screen[],
  disposables: { dispose(): void }[],
  options: SiteWallOptions,
): Hotspot {
  const { position, rotation, size, accent, url, label, kind } = options
  const screen = new Screen(kind, label, accent, 768, 460)
  screens.push(screen)

  // recessed frame + underlight
  kit.box(
    "metal",
    [size[0] + 0.3, size[1] + 0.3, 0.14],
    [position[0], position[1], position[2]],
    0x2c3641,
  )
  kit.at([position[0], position[1], position[2]], rotation)
  kit.box("metal", [size[0] + 0.3, size[1] + 0.3, 0.12], [0, 0, 0], 0x2c3641)
  kit.box(
    "glow",
    [size[0] + 0.34, 0.04, 0.03],
    [0, -size[1] / 2 - 0.16, 0.08],
    accent,
    undefined,
    1.2,
  )
  kit.box(
    "glow",
    [0.04, size[1] + 0.34, 0.03],
    [size[0] / 2 + 0.17, 0, 0.08],
    accent,
    undefined,
    0.8,
  )
  kit.world()

  const facing = rotation
  const offset = (depth: number, up: number): V3 => [
    position[0] + Math.sin(facing) * depth,
    position[1] + up,
    position[2] + Math.cos(facing) * depth,
  ]

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }),
  )
  surface.position.set(...offset(0.08, 0))
  surface.rotation.set(0, rotation, 0)
  group.add(surface)
  disposables.push(surface.geometry, surface.material)

  // the call-to-action lives inside the bottom of the display, so it always
  // lands where the pointer already is instead of drifting behind the HUD
  const card = new THREE.Group()
  card.position.set(...offset(0.17, -size[1] / 2 + 0.34))
  card.rotation.set(0, rotation, 0)
  card.visible = false
  group.add(card)
  const cardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(2.7, size[0] * 0.74), 0.66),
    new THREE.MeshBasicMaterial({
      map: linkCardTexture(label, accent),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
    }),
  )
  card.add(cardMesh)
  disposables.push(cardMesh.geometry, cardMesh.material)

  const target = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0] * 1.04, size[1] * 1.1),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  )
  target.position.set(...offset(0.3, 0))
  target.rotation.set(0, rotation, 0)
  target.userData = { type: "link", url, label }
  group.add(target)
  disposables.push(target.geometry, target.material)

  return {
    id: options.id,
    url,
    label,
    accent,
    target,
    card,
    hover: 0,
    hoverTarget: false,
    opened: false,
  }
}

function planters(kit: Kit) {
  const spots: [number, number, number][] = [
    [-8.2, -5.4, 1.3],
    [8.2, 2.4, 1.1],
    [-8.4, 3.2, 1],
    [4.6, 5.6, 1.2],
    [-2.6, -5.6, 0.9],
  ]
  for (const [x, z, scale] of spots) {
    kit.cyl("matte", 0.34, 0.5, [x, 0.25, z], 0x232d38)
    kit.cyl("glow", 0.36, 0.04, [x, 0.51, z], PALETTE.lime, undefined, 0.5)
    kit.cyl("matte", 0.06, 0.7, [x, 0.7, z], 0x2f4a3c)
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.399
      const radius = 0.16 + (i % 3) * 0.12
      kit.box(
        "matte",
        [0.1, 0.5 + (i % 3) * 0.16, 0.12],
        [
          x + Math.cos(angle) * radius,
          0.9 + (i % 4) * 0.12,
          z + Math.sin(angle) * radius,
        ],
        [0x2b5a48, 0x37705a, 0x24604a][i % 3],
        [Math.cos(angle) * 0.3, angle, Math.sin(angle) * 0.3],
      )
    }
    kit.ball("glow", 0.07, [x, 1.35, z], PALETTE.lime, 1.4)
    kit.spill([x, 0.02, z], 2 * scale, hex(PALETTE.lime), 0.1)
  }
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export function buildOffice(
  kit: Kit,
  group: THREE.Group,
  quality: number,
): Office {
  const disposables: { dispose(): void }[] = []
  const screens: Screen[] = []
  const stations: Station[] = []
  const desks: {
    x: number
    z: number
    yaw: number
    accent: number
    room: StudioFocus
  }[] = []
  const screenClock = [0, 1, 0, 1, 0, 1]

  floorPlate(kit)
  shell(kit, quality)
  upperLevel(kit)
  parapet(kit)

  const place = (options: {
    x: number
    z: number
    yaw: number
    accent: number
    kind: ScreenKind
    title: string
    room: StudioFocus
  }) => {
    const built = workstation(
      kit,
      group,
      screens,
      disposables,
      quality,
      options,
    )
    stations.push(built.station)
    desks.push({
      x: options.x,
      z: options.z,
      yaw: options.yaw,
      accent: options.accent,
      room: options.room,
    })
  }

  // RADARPRO — mobility lab along the west wall
  const radar = [
    { x: -5.6, z: -4.2, kind: "radar" as ScreenKind, title: "radar / traffic" },
    { x: -5.6, z: -2.4, kind: "map" as ScreenKind, title: "city mesh" },
    { x: -5.6, z: -0.6, kind: "chart" as ScreenKind, title: "flow metrics" },
  ]
  radar.forEach((d) =>
    place({ ...d, yaw: Math.PI / 2, accent: PALETTE.lime, room: "radar" }),
  )

  // VEKTR — creative pod facing the back window
  const vektr = [
    { x: -1.9, z: -4.6, kind: "render" as ScreenKind, title: "muse / draft" },
    { x: 0.5, z: -4.6, kind: "render" as ScreenKind, title: "palette" },
    { x: -1.9, z: -3.1, kind: "chat" as ScreenKind, title: "critique" },
    { x: 0.5, z: -3.1, kind: "chart" as ScreenKind, title: "reach" },
  ]
  vektr.forEach((d) =>
    place({ ...d, yaw: 0, accent: PALETTE.magenta, room: "vektr" }),
  )

  // LAB — experimental bench along the east wall
  const lab = [
    { x: 5.4, z: -4.2, kind: "code" as ScreenKind, title: "shader / build" },
    { x: 5.4, z: -2.4, kind: "terminal" as ScreenKind, title: "agents / run" },
    { x: 5.4, z: -0.6, kind: "wave" as ScreenKind, title: "signal" },
  ]
  lab.forEach((d) =>
    place({ ...d, yaw: -Math.PI / 2, accent: PALETTE.violet, room: "lab" }),
  )

  const { core, rings, orb, cage } = coreColumn(kit, group, disposables)
  const loungeSeat = lounge(kit, screens, disposables)
  const kitchenSpot = kitchen(kit)
  serverCorner(kit)
  const podSpot = meetingPod(kit, screens, disposables)
  planters(kit)
  sectorSportsCar(kit)
  entryIsland(kit)

  // the studio's own sites, live on the walls of their sectors
  const hotspots: Hotspot[] = [
    siteWall(group, kit, screens, disposables, {
      id: "radarpro",
      url: "https://radarpro.online",
      label: "radarpro.online",
      kind: "site-radar",
      accent: PALETTE.lime,
      position: [-PLATE.w / 2 + 0.42, 1.6, -2.4],
      rotation: Math.PI / 2,
      size: [3.7, 2.0],
    }),
    siteWall(group, kit, screens, disposables, {
      id: "vektr",
      url: "https://vektr.design",
      label: "vektr.design",
      kind: "site-vektr",
      accent: PALETTE.magenta,
      position: [-1.1, 2.4, -6.55],
      rotation: 0,
      size: [4.2, 2.0],
    }),
  ]

  // Drone on a landing pad above the lab bench
  const padX = 7.6
  const padZ = -1.2
  kit.cyl("metal", 0.7, 0.08, [padX, 1.02, padZ], PALETTE.metalDark)
  kit.ring(
    "glow",
    0.66,
    0.04,
    [padX, 1.07, padZ],
    PALETTE.violet,
    [Math.PI / 2, 0, 0],
    1.2,
  )
  kit.cyl("metal", 0.1, 0.4, [padX, 0.6, padZ], PALETTE.trim)
  kit.cyl("metal", 0.36, 0.06, [padX, 0.3, padZ], PALETTE.metalDark)
  kit.spill([padX, 1.09, padZ], 2.2, hex(PALETTE.violet), 0.16)

  const drone = new THREE.Group()
  drone.position.set(padX, 1.42, padZ)
  group.add(drone)
  const droneMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b3440,
    metalness: 0.8,
    roughness: 0.3,
  })
  const droneBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 14, 10),
    droneMaterial,
  )
  droneBody.scale.set(1, 0.6, 1)
  drone.add(droneBody)
  disposables.push(droneBody.geometry, droneMaterial)
  const rotorMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.cyan,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,
  })
  const rotorGeometry = new THREE.CircleGeometry(0.3, 48)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial)
    rotor.position.set(Math.cos(angle) * 0.3, 0.04, Math.sin(angle) * 0.3)
    rotor.rotation.x = -Math.PI / 2
    rotor.userData.spin = 1
    drone.add(rotor)
  }
  disposables.push(rotorGeometry, rotorMaterial)
  const droneLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshBasicMaterial({ color: PALETTE.magenta, toneMapped: false }),
  )
  droneLamp.position.set(0, -0.12, 0.12)
  drone.add(droneLamp)
  disposables.push(droneLamp.geometry, droneLamp.material)

  // Wall displays and signage
  const marquee = panel(
    group,
    marqueeTexture(),
    [5.8, 1.5],
    [4.9, 3.05, -PLATE.d / 2 + 0.16],
    [0, 0, 0],
    disposables,
  )
  marquee.material.transparent = true
  marquee.material.opacity = 0.96

  panel(
    group,
    signTexture(ROOMS.radar.label, {
      accent: PALETTE.lime,
      sub: ROOMS.radar.sub,
      style: "outline",
    }),
    [3.6, 0.9],
    [-(PLATE.w / 2 - 0.9), 3.32, -2.4],
    [0, Math.PI / 2, 0],
    disposables,
  )
  panel(
    group,
    signTexture(ROOMS.lab.label, {
      accent: PALETTE.violet,
      sub: ROOMS.lab.sub,
      style: "outline",
    }),
    [3.2, 0.8],
    [PLATE.w / 2 - 0.9, 2.6, -2.4],
    [0, -Math.PI / 2, 0],
    disposables,
  )
  panel(
    group,
    signTexture(ROOMS.vektr.label, {
      accent: PALETTE.magenta,
      sub: ROOMS.vektr.sub,
      style: "outline",
    }),
    [3, 0.8],
    [-5.6, 3.05, -PLATE.d / 2 + 0.16],
    [0, 0, 0],
    disposables,
  )
  panel(
    group,
    signTexture("SECTOR 07", {
      accent: PALETTE.cyan,
      sub: "agents on shift",
      style: "boxed",
    }),
    [4.2, 1.05],
    [-(PLATE.w / 2 - 0.9), 3.1, 3.4],
    [0, Math.PI / 2, 0],
    disposables,
  )

  // hanging banners over each cluster
  for (const [x, z, label, accent] of [
    [-5.2, -2.4, "MOBILITY", PALETTE.lime],
    [0, -3.4, "CREATIVE", PALETTE.magenta],
    [5.2, -2.4, "LAB", PALETTE.violet],
  ] as [number, number, string, number][]) {
    panel(
      group,
      signTexture(label, { accent, style: "solid", width: 512, height: 128 }),
      [2.2, 0.55],
      [x, 2.95, z],
      [0, 0, 0],
      disposables,
    )
    kit.box("metal", [0.02, 0.5, 0.02], [x - 0.9, 3.5, z], PALETTE.trim)
    kit.box("metal", [0.02, 0.5, 0.02], [x + 0.9, 3.5, z], PALETTE.trim)
  }

  // floor stencils
  const stencil = floorStencil("SECTOR 07", PALETTE.cyan)
  const stencilMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.85),
    new THREE.MeshBasicMaterial({
      map: stencil,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  stencilMesh.position.set(1.8, 0.045, 4.6)
  stencilMesh.rotation.set(-Math.PI / 2, 0, 0)
  group.add(stencilMesh)
  disposables.push(stencilMesh.geometry, stencilMesh.material, stencil)

  const stencil2 = floorStencil("CORE", PALETTE.violet)
  const stencilMesh2 = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.55),
    new THREE.MeshBasicMaterial({
      map: stencil2,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  stencilMesh2.position.set(0.3, 0.045, 3.3)
  stencilMesh2.rotation.set(-Math.PI / 2, 0, 0)
  group.add(stencilMesh2)
  disposables.push(stencilMesh2.geometry, stencilMesh2.material, stencil2)

  // volumetric shafts from the ceiling strips
  const hazeGroup = new THREE.Group()
  for (const [x, z, accent] of [
    [-5.2, -2.4, PALETTE.lime],
    [0, -3.4, PALETTE.magenta],
    [5.2, -2.4, PALETTE.violet],
    [0, 2.2, PALETTE.cyan],
  ] as [number, number, number][]) {
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 3.5, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    )
    shaft.position.set(x, 1.95, z)
    shaft.rotation.x = Math.PI
    hazeGroup.add(shaft)
    disposables.push(shaft.geometry, shaft.material)
  }
  group.add(hazeGroup)

  // plants + props on the plate edges
  kit.world()

  // waypoints shared with the agents so walking routes land on real furniture
  const waypoints = {
    loungeSeat: loungeSeat.seat,
    loungeFront: [loungeSeat.sofa[0] + 0.2, 0, loungeSeat.sofa[2] + 1.7] as V3,
    kitchen: kitchenSpot.standing,
    pod: podSpot.table,
    core: [0.3, 0, 2.9] as V3,
  }

  // cards sit a little under their display and lift as they open
  const cardBase = hotspots.map((hotspot) => hotspot.card.position.y)

  return {
    group,
    stations,
    screens,
    desks,
    core,
    drone,
    hotspots,
    waypoints,
    bounds: { halfWidth: PLATE.w / 2 - 0.6, halfDepth: PLATE.d / 2 - 0.6 },
    update(time: number, vibe: number) {
      screens.forEach((screen, index) => {
        screenClock[index % screenClock.length] += 1
        if (screenClock[index % screenClock.length] >= 2) {
          screenClock[index % screenClock.length] = 0
          screen.update(1 / 12)
        }
      })
      // hover links slide open as a drawer under the display content
      for (let i = 0; i < hotspots.length; i++) {
        const hotspot = hotspots[i]
        const wanted = hotspot.hoverTarget ? 1 : 0
        hotspot.hover += (wanted - hotspot.hover) * 0.18
        const card = hotspot.card
        const pop = Math.min(1, hotspot.hover)
        const visible = hotspot.hover > 0.004
        card.visible = visible
        if (!visible) continue
        // a touch of overshoot as the drawer snaps shut / open
        const snap = 1 + Math.sin(pop * Math.PI) * (1 - pop) * 0.5
        const open = Math.max(0, pop * 1.06 - 0.06) * snap
        card.scale.set(0.62 + open * 0.38, Math.max(0.001, open), 1)
        card.position.y = cardBase[i] + 0.26 * (1 - open)
        const material = (card.children[0] as THREE.Mesh)
          .material as THREE.MeshBasicMaterial
        material.opacity = Math.min(1, hotspot.hover * 2.2)
        card.rotation.z = Math.sin(time * 1.7 + i) * 0.004 * open
      }
      rings.forEach((ring) => {
        ring.rotation.z += ring.userData.speed * 0.008
        ring.rotation.y += ring.userData.speed * 0.004
      })
      orb.rotation.y += 0.01
      orb.rotation.x += 0.004
      const pulse = 1 + Math.sin(time * (2 + vibe * 0.4)) * 0.06 + vibe * 0.01
      orb.scale.setScalar(pulse)
      cage.rotation.y -= 0.006
      cage.rotation.z += 0.004
      core.position.y = 2.72 + Math.sin(time * 0.8) * 0.05
      drone.position.y = 1.42 + Math.sin(time * 1.6) * 0.05
      drone.rotation.y += 0.01
      drone.children.forEach((child) => {
        if (child.userData.spin) child.rotation.z += 0.5
      })
    },
    dispose() {
      disposables.forEach((item) => item.dispose())
    },
  }
}
