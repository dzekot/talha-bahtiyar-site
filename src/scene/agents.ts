import * as THREE from "three"
import { Kit, type StudioMaterials, type V3 } from "./kit"
import { PALETTE, type StudioFocus } from "./types"
import { bubbleTexture, sparkTexture, tagTexture } from "./textures"
import type { Office } from "./office"

export interface AgentProfile {
  name: string
  role: string
  accent: number
  jacket: number
  skin: number
  hair: number
  build: number
  lines: string[]
  plan: Step[]
}

export interface Step {
  point: V3
  face: number
  mode: "sit" | "stand" | "walk"
  hold: number
  activity: string
  room: StudioFocus
}

const AMBIENT = ["brb", "kahve?", "aaa", "hmm", "zzz", "!!"]

interface Bones {
  hips: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  foreL: THREE.Group
  foreR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  shinL: THREE.Group
  shinR: THREE.Group
  visor: THREE.Object3D
}

function group(parent: THREE.Object3D, position: V3 = [0, 0, 0]) {
  const node = new THREE.Group()
  node.position.set(position[0], position[1], position[2])
  parent.add(node)
  return node
}

function shaped(
  parent: THREE.Object3D,
  materials: StudioMaterials,
  build: (kit: Kit) => void,
) {
  const kit = new Kit()
  build(kit)
  kit.commit(parent, materials)
}

/** Stylised human rig: hips, torso, head, two arms and two legs, each bone a
 *  single merged mesh so the crew animates without a pile of draw calls. */
function buildRig(profile: AgentProfile, materials: StudioMaterials) {
  const { jacket, skin, hair, accent, build } = profile
  const scale = build

  const root = new THREE.Group()
  const hips = group(root, [0, 0.9 * scale, 0])
  const torso = group(hips)
  const head = group(torso, [0, 0.58 * scale, 0])
  const armL = group(torso, [0.21 * scale, 0.48 * scale, 0])
  const armR = group(torso, [-0.21 * scale, 0.48 * scale, 0])
  const foreL = group(armL, [0, -0.28 * scale, 0])
  const foreR = group(armR, [0, -0.28 * scale, 0])
  const legL = group(hips, [0.1 * scale, -0.02, 0])
  const legR = group(hips, [-0.1 * scale, -0.02, 0])
  const shinL = group(legL, [0, -0.42 * scale, 0])
  const shinR = group(legR, [0, -0.42 * scale, 0])

  // torso: jacket shell, collar, chest rig, small pack
  shaped(torso, materials, (kit) => {
    kit.round(
      "matte",
      [0.42 * scale, 0.5 * scale, 0.25 * scale],
      [0, 0.28 * scale, 0],
      jacket,
    )
    kit.round(
      "matte",
      [0.46 * scale, 0.14 * scale, 0.27 * scale],
      [0, 0.5 * scale, 0],
      jacket,
    )
    kit.round(
      "matte",
      [0.34 * scale, 0.16 * scale, 0.23 * scale],
      [0, 0.02, 0],
      jacket,
    )
    kit.box(
      "matte",
      [0.2 * scale, 0.24 * scale, 0.1 * scale],
      [0, 0.3 * scale, -0.16 * scale],
      0x1b2129,
    )
    kit.box(
      "glow",
      [0.07 * scale, 0.07 * scale, 0.02],
      [0.13 * scale, 0.34 * scale, 0.13 * scale],
      accent,
      undefined,
      1.2,
    )
    kit.box(
      "glow",
      [0.16 * scale, 0.012, 0.012],
      [0, 0.06 * scale, 0.13 * scale],
      accent,
      undefined,
      0.7,
    )
    kit.box(
      "matte",
      [0.44 * scale, 0.04 * scale, 0.26 * scale],
      [0, 0.5 * scale, 0],
      0x151b22,
    )
    if (profile.name === "Talha") {
      // A clean shirt, narrow tie and angled lapels make the founder stand out
      // from the studio's brighter, more utilitarian crew uniforms.
      kit.box("matte", [0.18, 0.4, 0.035], [0, 0.3, 0.145], 0xe9edf2)
      kit.box("glow", [0.052, 0.27, 0.045], [0, 0.27, 0.17], 0x5aa9c4)
      kit.box("matte", [0.105, 0.34, 0.035], [0.105, 0.34, 0.15], 0x26333f, [0, 0, -0.34])
      kit.box("matte", [0.105, 0.34, 0.035], [-0.105, 0.34, 0.15], 0x26333f, [0, 0, 0.34])
      kit.ball("glow", 0.025, [-0.13, 0.16, 0.17], accent, 0.9)
    }
  })

  // head: skull, jaw, hair, ear pods, antenna and a lit visor
  shaped(head, materials, (kit) => {
    kit.round(
      "matte",
      [0.2 * scale, 0.23 * scale, 0.21 * scale],
      [0, 0.11 * scale, 0],
      skin,
    )
    kit.round(
      "matte",
      [0.16 * scale, 0.08 * scale, 0.18 * scale],
      [0, 0.02 * scale, 0.01],
      skin,
    )
    kit.round(
      "matte",
      [0.21 * scale, 0.1 * scale, 0.22 * scale],
      [0, 0.21 * scale, -0.01],
      hair,
    )
    kit.box(
      "matte",
      [0.21 * scale, 0.06 * scale, 0.06 * scale],
      [0, 0.2 * scale, -0.09 * scale],
      hair,
    )
    for (const side of [-1, 1]) {
      kit.cyl(
        "matte",
        0.035 * scale,
        0.03 * scale,
        [side * 0.105 * scale, 0.1 * scale, 0.01],
        0x2a313b,
        [0, 0, Math.PI / 2],
      )
      kit.ball(
        "glow",
        0.014 * scale,
        [side * 0.125 * scale, 0.1 * scale, 0.01],
        accent,
        1.4,
      )
    }
    kit.cyl(
      "matte",
      0.008 * scale,
      0.16 * scale,
      [0.07 * scale, 0.3 * scale, -0.03],
      0x39424d,
      [0.2, 0, -0.3],
    )
    kit.ball(
      "glow",
      0.022 * scale,
      [0.09 * scale, 0.38 * scale, -0.04],
      accent,
      1.6,
    )
    kit.box(
      "matte",
      [0.06 * scale, 0.03 * scale, 0.02],
      [-0.05 * scale, 0.02 * scale, 0.1 * scale],
      0x2a313b,
    )
  })
  // visor sits on its own material so it can flash during a celebration
  const visor = new THREE.Group()
  visor.position.set(0, 0, 0)
  head.add(visor)
  const visorMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    toneMapped: false,
  })
  shaped(visor, materials, (kit) => {
    kit.box(
      "glow",
      [0.19 * scale, 0.075 * scale, 0.03],
      [0, 0.11 * scale, 0.1 * scale],
      accent,
      undefined,
      1.5,
    )
    kit.box(
      "glow",
      [0.05 * scale, 0.02 * scale, 0.02],
      [0.06 * scale, 0.185 * scale, 0.1 * scale],
      0xffffff,
      undefined,
      2.2,
    )
  })
  visor.traverse((object) => {
    if (object instanceof THREE.Mesh) object.material = visorMaterial
  })

  // arms
  for (const [arm, fore, side] of [
    [armL, foreL, 1],
    [armR, foreR, -1],
  ] as [THREE.Group, THREE.Group, number][]) {
    shaped(arm, materials, (kit) => {
      kit.round(
        "matte",
        [0.115 * scale, 0.3 * scale, 0.13 * scale],
        [0, -0.15 * scale, 0],
        jacket,
      )
      kit.ball("matte", 0.075 * scale, [0, 0.01, 0], jacket)
      kit.box(
        "glow",
        [0.03 * scale, 0.03 * scale, 0.12 * scale],
        [side * 0.07 * scale, -0.05 * scale, 0],
        accent,
        undefined,
        0.8,
      )
    })
    shaped(fore, materials, (kit) => {
      kit.round(
        "matte",
        [0.1 * scale, 0.27 * scale, 0.115 * scale],
        [0, -0.14 * scale, 0],
        jacket,
      )
      kit.round(
        "matte",
        [0.09 * scale, 0.11 * scale, 0.1 * scale],
        [0, -0.31 * scale, 0.01],
        skin,
      )
      kit.box(
        "glow",
        [0.085 * scale, 0.015, 0.1 * scale],
        [0, -0.26 * scale, 0],
        accent,
        undefined,
        0.6,
      )
    })
  }

  // legs + boots
  for (const [leg, shin, side] of [
    [legL, shinL, 1],
    [legR, shinR, -1],
  ] as [THREE.Group, THREE.Group, number][]) {
    shaped(leg, materials, (kit) => {
      kit.round(
        "matte",
        [0.15 * scale, 0.44 * scale, 0.17 * scale],
        [0, -0.22 * scale, 0],
        0x3d4756,
      )
      kit.box(
        "glow",
        [0.04 * scale, 0.02, 0.13 * scale],
        [side * 0.08 * scale, -0.3 * scale, 0.01],
        accent,
        undefined,
        0.7,
      )
    })
    shaped(shin, materials, (kit) => {
      kit.round(
        "matte",
        [0.13 * scale, 0.42 * scale, 0.15 * scale],
        [0, -0.21 * scale, 0],
        0x333c48,
      )
      kit.round(
        "matte",
        [0.15 * scale, 0.1 * scale, 0.26 * scale],
        [0, -0.44 * scale, 0.04],
        0x22272e,
      )
      kit.box(
        "glow",
        [0.16 * scale, 0.02, 0.02],
        [0, -0.4 * scale, 0.17],
        accent,
        undefined,
        0.7,
      )
    })
  }

  const bones: Bones = {
    hips,
    torso,
    head,
    armL,
    armR,
    foreL,
    foreR,
    legL,
    legR,
    shinL,
    shinR,
    visor,
  }
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  // forearms and upper arms skip the shadow pass — they are small, they move,
  // and the crew is the largest source of shadow draw calls in the scene
  for (const node of [armL, armR, foreL, foreR]) {
    node.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = false
    })
  }
  return { root, bones }
}

/** One inhabitant of the office: behaviour, animation and reactions. */
export class Agent {
  root: THREE.Group
  readonly group: THREE.Group
  name: string
  activity = "on shift"
  room: StudioFocus = "studio"
  step = 0
  timer = 0
  moving = false
  sitting = true
  /** set while the viewer is standing in this agent's eyes */
  held = false
  private sitBlend = 1
  private stride = 0
  private celebrate = 0
  private celebrateSeed = Math.random()
  private lineIndex = 0
  private bubbleTimer = 6 + Math.random() * 20
  private look = 0
  private readonly bones: Bones
  private readonly tag: THREE.Sprite
  private readonly aura: THREE.Mesh
  private readonly bubble: THREE.Sprite
  private readonly burst: THREE.Sprite
  private owned: THREE.Texture | null = null
  private readonly profile: AgentProfile
  private readonly target = new THREE.Vector3()
  private readonly ambientTextures: THREE.Texture[]

  constructor(
    profile: AgentProfile,
    materials: StudioMaterials,
    ambientTextures: THREE.Texture[],
    spark: THREE.Texture,
  ) {
    this.profile = profile
    this.name = profile.name
    const rig = buildRig(profile, materials)
    this.root = rig.root
    this.group = rig.root
    this.bones = rig.bones
    this.ambientTextures = ambientTextures

    const step = profile.plan[0]
    this.root.position.set(step.point[0], step.point[1], step.point[2])
    this.root.rotation.y = step.face
    this.timer = step.hold
    this.sitting = step.mode === "sit"
    this.sitBlend = this.sitting ? 1 : 0
    this.activity = step.activity
    this.room = step.room

    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 48),
      new THREE.MeshBasicMaterial({
        color: profile.accent,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    this.aura.rotation.x = -Math.PI / 2
    this.aura.position.y = 0.03
    this.root.add(this.aura)

    const tagTextureInstance = tagTexture(
      profile.name,
      profile.role,
      profile.accent,
    )
    this.tag = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tagTextureInstance,
        transparent: true,
        depthWrite: false,
        opacity: 0.78,
      }),
    )
    this.tag.scale.set(0.54, 0.17, 1)
    this.tag.position.set(0, 2.04, 0)
    this.tag.center.set(0.5, 0)
    this.root.add(this.tag)

    this.bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: ambientTextures[0],
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
        toneMapped: false,
      }),
    )
    this.bubble.scale.set(1, 0.5, 1)
    this.bubble.position.set(0, 2.5, 0)
    this.bubble.visible = false
    this.bubble.renderOrder = 20
    this.root.add(this.bubble)

    this.burst = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: spark,
        color: profile.accent,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        toneMapped: false,
      }),
    )
    this.burst.scale.set(0.4, 0.4, 1)
    this.burst.position.set(0, 1.1, 0)
    this.burst.visible = false
    this.burst.renderOrder = 18
    this.root.add(this.burst)

    this.root.traverse((object) => {
      object.userData = { type: "agent", name: profile.name }
    })
  }

  /** Called when the crew member is clicked in the scene or from the roster. */
  react() {
    this.celebrate = 1.9
    this.celebrateSeed = Math.random()
    this.timer = Math.max(this.timer, 1.9)
    const line = this.profile.lines[this.lineIndex % this.profile.lines.length]
    this.lineIndex++
    const material = this.bubble.material as THREE.SpriteMaterial
    const texture = bubbleTexture(line, this.profile.accent)
    this.owned?.dispose()
    this.owned = texture
    material.map = texture
    material.needsUpdate = true
    this.bubble.visible = true
    this.burst.visible = true
  }

  get cheering() {
    return this.celebrate > 0
  }

  /** Freeze in place so the viewer can stand in their eyes. */
  hold() {
    this.held = true
    this.timer = Math.max(this.timer, 2)
    if (this.moving) this.arrive()
  }

  get accent() {
    return this.profile.accent
  }

  get role() {
    return this.profile.role
  }

  get lastLine() {
    const index =
      (this.lineIndex - 1 + this.profile.lines.length) %
      this.profile.lines.length
    return this.profile.lines[index]
  }

  update(delta: number, time: number) {
    const { bones } = this
    const celebrating = this.celebrate > 0
    this.celebrate = Math.max(0, this.celebrate - delta)

    if (!this.moving && !celebrating && !this.held) {
      this.timer -= delta
      if (this.timer <= 0) this.advance()
    }

    // travelling
    if (this.moving) {
      const step = this.profile.plan[this.step]
      this.target.set(step.point[0], step.point[1], step.point[2])
      const offset = this.target.clone().sub(this.root.position)
      offset.y = 0
      const distance = offset.length()
      const speed = 1.25
      if (distance < speed * delta + 0.02) {
        this.arrive()
      } else {
        offset.normalize()
        this.root.position.addScaledVector(offset, speed * delta)
        const desired = Math.atan2(offset.x, offset.z)
        this.root.rotation.y = this.angleTo(desired, delta * 7)
        this.stride += delta * 8
      }
    } else if (!celebrating) {
      const step = this.profile.plan[this.step]
      this.root.rotation.y = this.angleTo(step.face, delta * 3)
    }

    // pose blending
    const sitTarget = this.sitting && !this.moving ? 1 : 0
    this.sitBlend += (sitTarget - this.sitBlend) * Math.min(1, delta * 7)
    const sit = this.sitBlend

    // idle chatter
    if (
      !this.moving &&
      this.bubble.material &&
      (this.bubble.material as THREE.SpriteMaterial).opacity <= 0
    ) {
      this.bubbleTimer -= delta
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 22 + Math.random() * 34
        const texture =
          this.ambientTextures[
            Math.floor(Math.random() * this.ambientTextures.length)
          ]
        const material = this.bubble.material as THREE.SpriteMaterial
        if (texture !== material.map) {
          material.map = texture
          material.needsUpdate = true
        }
        this.bubble.visible = true
      }
    }

    this.animate(delta, time, sit, celebrating)
  }

  private advance() {
    this.step = (this.step + 1) % this.profile.plan.length
    const step = this.profile.plan[this.step]
    const distance = Math.hypot(
      step.point[0] - this.root.position.x,
      step.point[2] - this.root.position.z,
    )
    if (distance > 0.08) this.moving = true
    else this.arrive()
  }

  private arrive() {
    const step = this.profile.plan[this.step]
    this.root.position.set(step.point[0], step.point[1], step.point[2])
    this.moving = false
    this.sitting = step.mode === "sit"
    this.activity = step.activity
    this.room = step.room
    this.timer = step.hold
    this.root.rotation.y = this.angleTo(step.face, 1)
  }

  private angleTo(desired: number, amount: number) {
    let difference = (desired - this.root.rotation.y) % (Math.PI * 2)
    if (difference > Math.PI) difference -= Math.PI * 2
    if (difference < -Math.PI) difference += Math.PI * 2
    return this.root.rotation.y + difference * Math.min(1, amount)
  }

  private animate(
    delta: number,
    time: number,
    sit: number,
    celebrating: boolean,
  ) {
    const { bones } = this
    const phase = this.celebrateSeed * 10
    const cheer = celebrating
      ? Math.min(1, this.celebrate / 0.5) *
        Math.min(1, (1.9 - this.celebrate) * 4 + 0.25)
      : 0
    const bounce = celebrating
      ? Math.max(0, Math.sin((1.9 - this.celebrate) * 9))
      : 0

    // root motion
    this.root.position.y =
      (this.profile.plan[this.step]?.point[1] ?? 0) +
      (this.moving ? Math.abs(Math.sin(this.stride)) * 0.05 * (1 - sit) : 0)
    if (celebrating) {
      this.root.position.y += bounce * 0.42
      this.root.rotation.y += delta * 9 * (this.celebrateSeed > 0.5 ? 1 : -1)
    }
    const squash = celebrating ? 1 + bounce * 0.12 : 1
    this.root.scale.set(2 - squash, squash, 2 - squash)

    // hips / torso
    const breath = Math.sin(time * 1.6 + phase) * 0.012
    bones.hips.position.y =
      (0.9 - sit * 0.36 + breath) * (this.profile.build ?? 1)
    bones.hips.rotation.x = sit * 0.06 - cheer * 0.12
    bones.torso.rotation.x =
      sit * 0.12 + (this.moving ? 0.08 : 0) - cheer * 0.18
    bones.torso.rotation.y = Math.sin(time * 0.7 + phase) * 0.05 * (1 - sit)
    bones.torso.rotation.z = Math.sin(time * 0.9 + phase) * 0.02

    // head: glances around, nods at the screen, looks up when celebrating
    this.look +=
      ((celebrating ? 0 : Math.sin(time * 0.45 + phase) * 0.45) - this.look) *
      Math.min(1, delta * 2)
    bones.head.rotation.y = this.look
    bones.head.rotation.x =
      sit * 0.22 + (this.moving ? -0.05 : 0) - cheer * 0.42
    bones.head.rotation.z = Math.sin(time * 1.3 + phase) * 0.03 + cheer * 0.12

    // arms: typing at the desk, swinging while walking, thrown up on a cheer
    const typing = this.sitting && !this.moving && !celebrating
    const swing = this.moving ? Math.sin(this.stride) * 0.55 * (1 - sit) : 0
    const lift = celebrating ? cheer : 0
    const arms: [THREE.Group, THREE.Group, number][] = [
      [bones.armL, bones.foreL, 1],
      [bones.armR, bones.foreR, -1],
    ]
    for (const [arm, fore, side] of arms) {
      const wave = typing ? Math.sin(time * 9 + phase + side * 1.3) * 0.1 : 0
      const targetZ =
        side * (0.12 + sit * 0.22) - swing * side * 0.9 + lift * side * 2.35
      const targetX = typing
        ? -0.75 - sit * 0.35 + wave
        : swing * side * 0.35 + lift * -0.25
      arm.rotation.z += (targetZ - arm.rotation.z) * Math.min(1, delta * 12)
      arm.rotation.x += (targetX - arm.rotation.x) * Math.min(1, delta * 12)
      const elbowTarget = typing ? 1.15 + wave * 1.6 : lift ? -0.9 : -0.35
      fore.rotation.x +=
        (elbowTarget - fore.rotation.x) * Math.min(1, delta * 12)
      fore.rotation.z +=
        ((typing ? 0.25 : 0.12) * side + lift * side * 0.4 - fore.rotation.z) *
        Math.min(1, delta * 10)
    }

    // legs: stride, seated knees, and a landing bend on the cheer jump
    const stride = this.moving ? Math.sin(this.stride) * 0.62 * (1 - sit) : 0
    const idleBend = this.sitting ? 0 : Math.sin(time * 1.1 + phase) * 0.02
    bones.legL.rotation.x = stride - sit * 1.45 - cheer * 0.5
    bones.legR.rotation.x = -stride - sit * 1.45 - cheer * 0.5
    bones.legL.rotation.z = sit * 0.08
    bones.legR.rotation.z = -sit * 0.08
    bones.shinL.rotation.x =
      sit * 1.5 + Math.max(0, -stride) * 0.7 + cheer * 0.7
    bones.shinR.rotation.x = sit * 1.5 + Math.max(0, stride) * 0.7 + cheer * 0.7
    bones.legL.rotation.x += idleBend
    bones.legR.rotation.x -= idleBend

    // aura + visor
    const auraMaterial = this.aura.material as THREE.MeshBasicMaterial
    auraMaterial.opacity =
      0.24 + Math.sin(time * 2 + phase) * 0.08 + cheer * 0.6
    this.aura.scale.setScalar(
      1 + cheer * 0.9 + Math.sin(time * 2 + phase) * 0.02,
    )
    const visorMaterial = (this.bones.visor.children[0] as THREE.Mesh)
      .material as THREE.MeshBasicMaterial
    if (celebrating) visorMaterial.color.setRGB(1, 1, 1)

    // bubbles + burst
    const bubbleMaterial = this.bubble.material as THREE.SpriteMaterial
    const age = 1 - this.celebrate
    if (celebrating) {
      const pop = Math.max(0, Math.min(1, (1.9 - this.celebrate) * 6))
      const overshoot = 1 + Math.sin(Math.min(1, pop) * Math.PI) * 0.22
      bubbleMaterial.opacity = Math.min(1, this.celebrate * 2.2)
      this.bubble.scale.set(1.5 * pop * overshoot, 0.75 * pop * overshoot, 1)
      this.bubble.position.y = 2.34 + Math.sin(time * 6) * 0.03 + bounce * 0.3
      const burstMaterial = this.burst.material as THREE.SpriteMaterial
      burstMaterial.opacity = Math.max(0, 0.9 - age * 0.8)
      this.burst.scale.setScalar(Math.max(0.01, 1.6 + age * 2.6))
    } else {
      bubbleMaterial.opacity = Math.max(0, bubbleMaterial.opacity - delta * 1.6)
      if (bubbleMaterial.opacity <= 0) this.bubble.visible = false
      const burstMaterial = this.burst.material as THREE.SpriteMaterial
      burstMaterial.opacity = Math.max(0, burstMaterial.opacity - delta * 2)
      if (burstMaterial.opacity <= 0) this.burst.visible = false
      // visor cools back down to the agent's signature colour
      visorMaterial.color.set(celebrating ? 0xffffff : this.profile.accent)
    }
    this.tag.material.opacity = celebrating ? 0.3 : 0.9
    if (!celebrating && bubbleMaterial.opacity > 0) {
      this.bubble.position.y = 2.34
      this.bubble.scale.set(0.82, 0.41, 1)
    }
  }

  dispose() {
    this.owned?.dispose()
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[]
        const items = Array.isArray(material) ? material : [material]
        items.forEach((item) => {
          if (item && !item.userData?.shared) item.dispose()
        })
      }
    })
  }
}

export interface Crew {
  agents: Agent[]
  byName: (name: string) => Agent | undefined
  update: (delta: number, time: number) => void
  dispose: () => void
}

const PROFILES: Omit<AgentProfile, "plan">[] = [
  {
    name: "Talha",
    role: "studio founder",
    accent: PALETTE.cyan,
    jacket: 0x202a35,
    skin: 0xc58b65,
    hair: 0x17191d,
    build: 1.04,
    lines: ["Bir tur daha.", "Şimdi oldu.", "Güzel fikir."],
  },
  {
    name: "Scout",
    role: "signal hunter",
    accent: PALETTE.cyan,
    jacket: 0x3f6d9c,
    skin: 0xa8714a,
    hair: 0x23282e,
    build: 0.97,
    lines: ["BULDUM!", "bişey var!", "haha!"],
  },
  {
    name: "Muse",
    role: "art director",
    accent: PALETTE.magenta,
    jacket: 0x8a4a7c,
    skin: 0xf6d3b0,
    hair: 0x8a4068,
    build: 0.95,
    lines: ["MÜKEMMEL!", "ışık doğru!", "buna bayılırım"],
  },
  {
    name: "Pixel",
    role: "shader cook",
    accent: PALETTE.violet,
    jacket: 0x5a52a8,
    skin: 0xd7a075,
    hair: 0x342a4a,
    build: 1,
    lines: ["SHIP IT!", "bir piksel!", "render bitsin!"],
  },
  {
    name: "Vector",
    role: "systems",
    accent: PALETTE.amber,
    jacket: 0x96762f,
    skin: 0xfbe0c8,
    hair: 0x4a3620,
    build: 1.02,
    lines: ["NOGT?!", "kaydettim ya!", "bir saniye"],
  },
  {
    name: "Nova",
    role: "orchestrator",
    accent: 0xff5fa8,
    jacket: 0x7c4488,
    skin: 0xe8b98c,
    hair: 0x2a2033,
    build: 0.98,
    lines: ["IŞIKLAR!", "ben geliyorum!", "ısıt şunu!"],
  },
  {
    name: "Atlas",
    role: "logistics",
    accent: 0x7fa8ff,
    jacket: 0x4a6ea8,
    skin: 0xb5835c,
    hair: 0x22282f,
    build: 1.06,
    lines: ["KAHVE?!", "mola bitti!", "su getirsene"],
  },
  {
    name: "Relay",
    role: "comms",
    accent: 0x7dffc4,
    jacket: 0x357a72,
    skin: 0xf0c49c,
    hair: 0x1c3230,
    build: 0.96,
    lines: ["ONLINE!", "sinyal güçlü", "bağlandım!"],
  },
]

/** Waypoints + seating shared by every route in the studio. */
function planRoutes(office: Office): AgentProfile["plan"][] {
  const seats = (
    index: number,
    activity: string,
    room: StudioFocus,
    hold: number,
  ): Step => {
    const station = office.stations[index]
    return {
      point: station.seat,
      face: station.face,
      mode: "sit",
      hold,
      activity,
      room,
    }
  }
  const desk = (
    index: number,
    activity: string,
    room: StudioFocus,
    hold: number,
  ): Step => {
    const station = office.stations[index]
    const stand: V3 = [
      station.desk[0] + Math.sin(station.yaw) * 1.9,
      0,
      station.desk[2] + Math.cos(station.yaw) * 1.9,
    ]
    return {
      point: stand,
      face: station.face,
      mode: "stand",
      hold,
      activity,
      room,
    }
  }
  const at = (
    point: V3,
    face: number,
    activity: string,
    room: StudioFocus,
    hold: number,
  ): Step => ({ point, face, mode: "stand", hold, activity, room })
  const walk = (point: V3): Step => ({
    point,
    face: 0,
    mode: "walk",
    hold: 0,
    activity: "on the move",
    room: "studio",
  })
  const { waypoints } = office
  const aisle = (x: number, z: number): V3 => [x, 0, z]

  return [
    [
      seats(0, "reviewing mobility signals", "radar", 17),
      walk(aisle(-3.4, -3.2)),
      at(aisle(-3.4, -0.2), Math.PI, "checking the city view", "studio", 6),
      walk(aisle(-2.6, 1.4)),
      seats(0, "fine-tuning RadarPro", "radar", 13),
    ],
    [
      walk(aisle(-3.2, -1.6)),
      at(waypoints.core, Math.PI * 1.4, "checking the studio core", "studio", 4),
      walk(aisle(-1.6, -0.4)),
      at(waypoints.loungeFront, -0.4, "thinking through a route", "studio", 5),
    ],
    [
      walk(aisle(-0.8, -2.2)),
      at([-2.4, 0, -1.4], -1.2, "pairing with Pixel", "vektr", 5),
      walk(aisle(0.2, -1.6)),
      at([1.4, 0, -1.4], 1.2, "critique pass", "vektr", 5),
    ],
    [
      seats(3, "polishing renders", "vektr", 1),
      walk(aisle(0.6, -1.8)),
      at([-2.6, 0, -1.2], -1.4, "pairing with Muse", "vektr", 6),
      walk(aisle(-0.4, 0.2)),
      at(waypoints.loungeFront, 0.4, "coffee break", "studio", 5),
      walk(aisle(-1.2, -2)),
    ],
    [
      walk(aisle(3.2, -1.8)),
      at(aisle(2.4, 0.6), 1.6, "waiting on the build", "studio", 4),
      walk(aisle(3.4, -3)),
      desk(4, "tuning the noise", "lab", 6),
    ],
    [
      seats(5, "running an agent test", "lab", 19),
      walk(aisle(2.6, -0.4)),
      at(waypoints.kitchen, Math.PI, "brewing coffee", "studio", 5),
      walk(aisle(1.4, 1.8)),
      at(aisle(0.6, 2.4), 0.2, "stretch break", "studio", 3.5),
      walk(aisle(2.8, -0.6)),
      seats(5, "watching the lab build", "lab", 14),
    ],
    [
      walk(aisle(3.6, 1.2)),
      at(waypoints.pod, 0, "standup sync", "studio", 6),
      walk(aisle(1.8, 0.4)),
      at(waypoints.core, -1.4, "reporting to the core", "studio", 4),
    ],
    [
      walk(aisle(-2.2, 0.8)),
      at(waypoints.loungeFront, -0.6, "on a walk break", "studio", 4),
      walk(aisle(-1.4, -1.6)),
      at(waypoints.core, 0.2, "sharing an update", "studio", 4),
    ],
  ]
}

export function buildCrew(office: Office, materials: StudioMaterials): Crew {
  const routes = planRoutes(office)
  const ambient = AMBIENT.map((text) => bubbleTexture(text, 0x8fe9ff))
  const spark = sparkTexture()
  const agents = PROFILES.map(
    (profile, index) =>
      new Agent({ ...profile, plan: routes[index] }, materials, ambient, spark),
  )

  return {
    agents,
    byName: (name: string) =>
      agents.find((agent) => agent.name.toLowerCase() === name.toLowerCase()),
    update: (delta: number, time: number) => {
      for (const agent of agents) agent.update(delta, time)
    },
    dispose: () => {
      agents.forEach((agent) => agent.dispose())
      ambient.forEach((texture) => texture.dispose())
      spark.dispose()
    },
  }
}

export const ROSTER = PROFILES.map(({ name, role, accent }) => ({
  name,
  role,
  accent,
}))
