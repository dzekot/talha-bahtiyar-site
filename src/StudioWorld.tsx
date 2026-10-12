import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { Kit, createMaterials, type StudioMaterials } from "./scene/kit"
import { buildCity, type Atmosphere } from "./scene/city"
import { buildOffice, type Hotspot, type Office } from "./scene/office"
import { buildCrew, type Crew } from "./scene/agents"
import { PALETTE, type StudioActivity, type StudioFocus } from "./scene/types"
import { facadeTexture, setTextureQuality } from "./scene/textures"
import type { SceneCue } from "./hooks/useAmbientSound"

export type { StudioActivity, StudioFocus }

type Props = {
  focus: StudioFocus
  onFocus: (focus: StudioFocus) => void
  onAgentSelect: (name: string) => void
  paused?: boolean
  resetToken?: number
  onReady?: () => void
  onError?: (message: string) => void
  onActivity?: (activity: StudioActivity[]) => void
  onVibe?: (vibe: number, shout: string) => void
  onMode?: (mode: ViewMode, agent: string | null) => void
  onCue?: (cue: SceneCue) => void
  onLink?: (url: string, label: string) => void
  apiRef?: { current: WorldApi | null }
}

export interface WorldApi {
  celebrate: (name: string) => void
  /** celebrate + drop the camera into that agent's first-person view */
  follow: (name: string) => void
  /** leave the agent view and walk the floor from the entry */
  explore: () => void
  /** back to the orbit camera */
  release: () => void
  pulse: () => void
}

export type ViewMode = "orbit" | "walk" | "agent" | "flight"

interface LinkData {
  url: string
  label: string
}

/** A scripted move between camera poses: entrance glides and sector flights. */
interface Glide {
  start: number
  seconds: number
  from: THREE.Vector3
  to: THREE.Vector3
  fromYaw: number
  toYaw: number
}

type V3 = [number, number, number]

/** Camera poses: the whole plate from outside, then each sector up close. */
interface Shot {
  target: V3
  offset: V3
}

const SHOTS: Record<StudioFocus, Shot> = {
  // A measured exterior view keeps both floors visible without the
  // exaggerated overhead angle of the arcade-oriented framing.
  studio: { target: [-0.4, 90.5, -3.6], offset: [1.1, 10.5, 15.5] },
  radar: { target: [-6.3, 91.5, -2.2], offset: [4.8, 1.7, 7.9] },
  vektr: { target: [-1, 91.35, -3.6], offset: [4.6, 1.7, 7.3] },
  lab: { target: [5.5, 91.45, -2.2], offset: [-4.8, 1.7, 7.9] },
}

const STUDIO_ALTITUDE = 90

/** Final grade: vignette, chromatic fringe, grain and a neon scan sweep. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAmount: { value: 1 },
    uFlash: { value: 0 },
  },
  vertexShader:
    "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; uniform float uFlash;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){ vec2 uv = vUv;
      vec2 centred = uv - 0.5;
      float dist = dot(centred, centred);
      float fringe = 0.0016 * uAmount * dist * 4.0;
      vec3 color;
      color.r = texture2D(tDiffuse, uv + centred * fringe).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - centred * fringe).b;
      // soft vignette
      float vignette = smoothstep(0.95, 0.22, dist * 1.55);
      color *= mix(1.0, vignette, 0.85 * uAmount);
      // filmic contrast + a touch of saturation so neon keeps its bite
      color = (color - 0.5) * 1.14 + 0.5;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, 1.16);
      // drifting scanline sweep
      float sweep = smoothstep(0.0, 1.0, sin(uv.y * 420.0 + uTime * 2.2) * 0.5 + 0.5);
      color += sweep * 0.014 * uAmount * vec3(0.4, 0.85, 1.0);
      // film grain
      float grain = hash(uv * 900.0 + fract(uTime) * 100.0) - 0.5;
      color += grain * 0.035 * uAmount;
      color += vec3(0.45, 0.85, 1.0) * uFlash * 0.5;
      gl_FragColor = vec4(color, 1.0); }`,
}

export default function StudioWorld(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const disposables: { dispose(): void }[] = []

    let renderer: THREE.WebGLRenderer
    try {
      // Native device antialiasing is the baseline. The post-processing target
      // adds multisampling on capable GPUs without delaying the opening frame.
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      })
    } catch {
      propsRef.current.onError?.(
        "The 3D studio could not start. Your browser may not support WebGL.",
      )
      return
    }

    // Software rasterisers (CI, remote desktops) get a lighter pipeline.
    const context = renderer.getContext()
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info")
    const adapter = debugInfo
      ? String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : ""
    const lowPower =
      /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(
        adapter,
      )
    renderer.shadowMap.enabled = !lowPower
    renderer.shadowMap.type = THREE.PCFShadowMap
    if (lowPower) {
      // Start at the final software quality immediately; ramping from 1.25x
      // made the first wide shot visibly soft before it sharpened later.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
      renderer.domElement.addEventListener(
        "webglcontextlost",
        (event) => event.preventDefault(),
        { once: true },
      )
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x04070d)
    scene.fog = new THREE.FogExp2(0x0a1020, 0.0095)
    const fog = scene.fog as THREE.FogExp2
    const nightFog = new THREE.Color(0x0a1020)
    const dayFog = new THREE.Color(0x8499a8)
    const nightHemisphere = new THREE.Color(0x9fd0ff)
    const dayHemisphere = new THREE.Color(0xffe4c1)
    const nightGround = new THREE.Color(0x33204f)
    const dayGround = new THREE.Color(0x76634d)
    const nightKey = new THREE.Color(0xcfe4ff)
    const dayKey = new THREE.Color(0xffd6a0)
    const BASE_FOV = 50
    const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 400)
    // yaw first, then pitch: the order a first-person view needs
    camera.rotation.order = "YXZ"

    if (!lowPower)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.22

    const canvas = renderer.domElement
    canvas.tabIndex = 0
    canvas.setAttribute(
      "aria-label",
      "Interactive studio. Move the mouse to look around; use WASD to fly and arrow keys to steer. Scroll to zoom. Select rooms and agents with the controls below.",
    )
    canvas.style.touchAction = "none"
    container.appendChild(canvas)

    const materials: StudioMaterials = createMaterials(false)
    setTextureQuality(
      Math.min(renderer.capabilities.getMaxAnisotropy(), lowPower ? 4 : 16),
    )
    const facadeMap = facadeTexture(7)
    materials.facade.map = facadeMap
    materials.facade.needsUpdate = true
    disposables.push(facadeMap)

    // Reflection probe: a tiny neon room baked once into an environment map.
    let environment: THREE.Texture | null = null
    if (!lowPower) {
      const pmrem = new THREE.PMREMGenerator(renderer)
      const probeScene = new THREE.Scene()
      probeScene.background = new THREE.Color(0x05070e)
      const probeBox = new THREE.BoxGeometry(1, 1, 1)
      const probeFaces: [number, V3, number][] = [
        [0x1a2a44, [0, 0, -6], 18],
        [0x2a1330, [0, 0, 6], 18],
        [0x12303a, [-6, 0, 0], 12],
        [0x301326, [6, 0, 0], 12],
        [0x0d1a2c, [0, 6, 0], 26],
        [0x080a10, [0, -6, 0], 26],
      ]
      probeFaces.forEach(([color, position, size]) => {
        const mesh = new THREE.Mesh(
          probeBox,
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
        )
        mesh.position.set(position[0], position[1], position[2])
        mesh.scale.setScalar(size)
        probeScene.add(mesh)
      })
      for (const [color, position, size] of [
        [PALETTE.cyan, [-3, 2, -5], [0.4, 5, 0.2]],
        [PALETTE.magenta, [3, 1.4, -5], [0.4, 4, 0.2]],
        [PALETTE.amber, [0, -2, 4], [5, 0.4, 0.2]],
      ] as [number, V3, V3][]) {
        const mesh = new THREE.Mesh(
          probeBox,
          new THREE.MeshBasicMaterial({ color }),
        )
        mesh.position.set(position[0], position[1], position[2])
        mesh.scale.set(size[0], size[1], size[2])
        probeScene.add(mesh)
      }
      environment = pmrem.fromScene(probeScene, 0.04).texture
      scene.environment = environment
      scene.environmentIntensity = 0.55
      pmrem.dispose()
      probeScene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          ;(object.material as THREE.Material).dispose()
        }
      })
    }
    if (environment) disposables.push(environment)

    // lighting rig — cool key, magenta rim, warm fill and practical neons
    const hemisphere = new THREE.HemisphereLight(
      0x9fd0ff,
      0x33204f,
      lowPower ? 1.15 : 1.05,
    )
    scene.add(hemisphere)
    const key = new THREE.DirectionalLight(0xcfe4ff, 1.75)
    // light enters through the open front of the plate, not through the roof
    key.position.set(-7, STUDIO_ALTITUDE + 12, 19)
    key.target.position.set(0, STUDIO_ALTITUDE, 0)
    scene.add(key.target)
    key.castShadow = !lowPower
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 60
    key.shadow.camera.left = -16
    key.shadow.camera.right = 16
    key.shadow.camera.top = 16
    key.shadow.camera.bottom = -16
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.03
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xff7ab8, 0.95)
    rim.position.set(13, STUDIO_ALTITUDE + 6, -9)
    scene.add(rim)
    if (!lowPower) {
      const fill = new THREE.DirectionalLight(0x38e8ff, 0.75)
      fill.position.set(6, STUDIO_ALTITUDE + 4, 14)
      scene.add(fill)
    }
    const practicalSpots: [number, V3][] = [
      [PALETTE.cyan, [-5.2, STUDIO_ALTITUDE + 2.6, -2.4]],
      [PALETTE.magenta, [0, STUDIO_ALTITUDE + 2.6, -3.4]],
      [PALETTE.violet, [5.2, STUDIO_ALTITUDE + 2.6, -2.4]],
      [PALETTE.amber, [6.4, STUDIO_ALTITUDE + 2, 4.2]],
      [PALETTE.lime, [-6.6, STUDIO_ALTITUDE + 2.2, 0.6]],
    ]
    const practicals: THREE.PointLight[] = practicalSpots.map(
      ([color, position]) => {
        const light = new THREE.PointLight(color, 34, 12, 2)
        light.position.set(position[0], position[1], position[2])
        scene.add(light)
        return light
      },
    )
    const lightCount = 4 + practicals.length

    // world — the interior is built and shown first, the district behind the
    // glass streams in on the next frame so slow devices get pixels quickly
    const studio = new THREE.Group()
    studio.position.y = STUDIO_ALTITUDE
    scene.add(studio)
    const kit = new Kit()
    kit.hazeEnabled = !lowPower
    const office: Office = buildOffice(kit, studio, 1)
    const batches = kit.commit(studio, materials)

    const crew: Crew = buildCrew(office, materials)
    crew.agents.forEach((agent) => studio.add(agent.root))
    let atmosphere: Atmosphere | null = null

    // collaboration link between two agents standing together
    const linkMaterial = new THREE.LineBasicMaterial({
      color: PALETTE.cyan,
      transparent: true,
      opacity: 0,
    })
    const linkGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const link = new THREE.Line(linkGeometry, linkMaterial)
    link.frustumCulled = false
    studio.add(link)

    // shockwave rings reused by every celebration
    const waves = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.62, 64),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      mesh.renderOrder = 5
      studio.add(mesh)
      disposables.push(mesh.geometry, mesh.material)
      return { mesh, life: 0 }
    })
    let waveCursor = 0

    // Build post-processing before the first paint so the opening shot uses
    // the same antialiasing quality as the rest of the experience.
    const buildComposer = () => {
      if (composer) return
      const size = renderer.getSize(new THREE.Vector2())
      const target = new THREE.WebGLRenderTarget(
        Math.max(1, size.x),
        Math.max(1, size.y),
        {
          type: THREE.HalfFloatType,
          samples: !lowPower && renderer.capabilities.isWebGL2 ? 4 : 0,
        },
      )
      composer = new EffectComposer(renderer, target)
      composer.addPass(new RenderPass(scene, camera))
      if (!lowPower) {
        bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.62, 0.82)
        composer.addPass(bloom)
      }
      composer.addPass(new OutputPass())
      grade = new ShaderPass(GradeShader)
      grade.uniforms.uAmount.value = 0
      grade.renderToScreen = true
      composer.addPass(grade)
      if (!lowPower) renderer.shadowMap.enabled = true
    }
    let composer: EffectComposer | null = null
    let bloom: UnrealBloomPass | null = null
    let grade: ShaderPass | null = null

    if (!lowPower) buildComposer()

    let sceneCalls = 0
    let sceneTriangles = 0
    let gradeMix = 0
    scene.onAfterRender = () => {
      sceneCalls = renderer.info.render.calls
      sceneTriangles = renderer.info.render.triangles
    }

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = true
    controls.panSpeed = 0.6
    controls.rotateSpeed = 0.55
    controls.zoomSpeed = 0.75
    controls.minDistance = 3.4
    controls.maxDistance = 34
    controls.minPolarAngle = 0.28
    controls.maxPolarAngle = 1.46
    controls.target.set(...SHOTS.studio.target)

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reduced = reducedQuery.matches
    const onMotion = () => {
      reduced = reducedQuery.matches
    }
    reducedQuery.addEventListener("change", onMotion)

    let lastFocus = propsRef.current.focus
    let lastReset = propsRef.current.resetToken ?? 0

    // ---- first person walk / agent view --------------------------------
    let mode: ViewMode = "orbit"
    let followed: string | null = null
    const EYE = 1.62
    let eyeHeight = EYE
    const look = { yaw: 0, pitch: 0 }
    const keys = new Set<string>()
    const lastPointer = new THREE.Vector2()
    let hasLastPointer = false
    let stepPhase = 0
    let bob = 0
    let transition = 0
    let transitionStart = 0
    let settled = false
    let shake = 0
    let flash = 0
    let vibe = 0
    const destinationTarget = new THREE.Vector3()
    const destinationCamera = new THREE.Vector3()
    const startTarget = new THREE.Vector3()
    const startCamera = new THREE.Vector3()
    const clampToPlate = (point: THREE.Vector3) => {
      point.x = THREE.MathUtils.clamp(point.x, -office.bounds.halfWidth, office.bounds.halfWidth)
      point.z = THREE.MathUtils.clamp(point.z, -office.bounds.halfDepth, office.bounds.halfDepth)
      const coreX = 0
      const coreZ = -2.6
      const dx = point.x - coreX
      const dz = point.z - coreZ
      const distance = Math.hypot(dx, dz)
      if (distance < 1.75 && distance > 0.001) {
        point.x = coreX + (dx / distance) * 1.75
        point.z = coreZ + (dz / distance) * 1.75
      }
      return point
    }

    const setMode = (next: ViewMode, agent: string | null = null) => {
      mode = next
      followed = agent
      propsRef.current.onMode?.(next, agent)
      if (next === "orbit") {
        keys.clear()
        controls.enabled = true
        home()
      } else {
        controls.enabled = false
        settled = false
        transition = 0
      }
    }

    const home = (immediate = false) => {
      const shot = SHOTS[propsRef.current.focus]
      destinationTarget.set(...shot.target)
      const narrow =
        container.clientWidth / Math.max(1, container.clientHeight) < 0.95
      // Give the full-screen overview more breathing room; focused workspaces
      // keep their closer framing when selected.
      const pullback = shot === SHOTS.studio ? (narrow ? 1.55 : 1.8) : (narrow ? 1.45 : 1)
      destinationCamera.set(
        shot.target[0] + shot.offset[0] * pullback,
        shot.target[1] + shot.offset[1] * pullback,
        shot.target[2] + shot.offset[2] * pullback,
      )
      if (immediate || reduced) {
        camera.position.copy(destinationCamera)
        controls.target.copy(destinationTarget)
        camera.lookAt(controls.target)
        transition = 0
        settled = true
        controls.enableDamping = true
      } else {
        settled = false
        // drop any orbit inertia so the scripted move is the only thing moving
        controls.enableDamping = false
        startCamera.copy(camera.position)
        startTarget.copy(controls.target)
        transitionStart = performance.now()
        transition = 1
      }
      lastFocus = propsRef.current.focus
      lastReset = propsRef.current.resetToken ?? 0
    }

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width < 1 || height < 1) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      composer?.setSize(width, height)
      bloom?.setSize(width, height)
      if (grade) grade.uniforms.uAmount.value = width > 640 ? 1 : 0.6
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    home(true)

    // picking
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const down = new THREE.Vector2()
    let dragged = false
    let held = false
    let downTime = 0
    let hoveredLink: Hotspot | null = null
    const pickTargets = crew.agents.map((agent) => agent.root)
    const linkTargets = office.hotspots.map((hotspot) => hotspot.target)

    const aim = (event: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
    }

    const pick = (event: PointerEvent | MouseEvent) => {
      aim(event)
      return raycaster.intersectObjects(pickTargets, true)[0]
    }
    const pickLink = (event: PointerEvent | MouseEvent) => {
      aim(event)
      return raycaster.intersectObjects(linkTargets, true)[0]
    }
    const onDown = (event: PointerEvent) => {
      held = true
      dragged = false
      downTime = performance.now()
      down.set(event.clientX, event.clientY)
      if (mode !== "orbit") return
      transition = 0
      settled = false
      controls.enableDamping = true
    }
    const onMove = (event: PointerEvent) => {
      const x = event.clientX
      const y = event.clientY
      if (hasLastPointer && (!held || mode !== "orbit")) {
        const dx = x - lastPointer.x
        const dy = y - lastPointer.y
        if (mode === "orbit" && (dx !== 0 || dy !== 0)) {
          // Orbit follows mouse movement directly; the first movement only
          // establishes a baseline, so entering the canvas never jumps.
          const spherical = new THREE.Spherical().setFromVector3(
            camera.position.clone().sub(controls.target),
          )
          spherical.theta -= dx * 0.005
          spherical.phi = THREE.MathUtils.clamp(
            spherical.phi + dy * 0.005,
            controls.minPolarAngle,
            controls.maxPolarAngle,
          )
          camera.position
            .copy(controls.target)
            .add(new THREE.Vector3().setFromSpherical(spherical))
          camera.lookAt(controls.target)
          controls.enableDamping = false
          transition = 0
          settled = false
        } else if (mode !== "orbit") {
          look.yaw -= dx * 0.0052
          look.pitch = THREE.MathUtils.clamp(
            look.pitch - dy * 0.0045,
            -1.35,
            1.35,
          )
        }
      }
      lastPointer.set(x, y)
      hasLastPointer = true
      if (
        held &&
        Math.hypot(x - down.x, y - down.y) > 6
      ) {
        dragged = true
        down.set(x, y)
      }
      if (!held) {
        const link = pickLink(event)
        hoveredLink = link
          ? (office.hotspots.find((item) => item.target === link.object) ??
            null)
          : null
        if (hoveredLink) {
          canvas.style.cursor = "pointer"
          canvas.dataset.link = hoveredLink.label
        } else {
          delete canvas.dataset.link
          const hit = pick(event)
          canvas.style.cursor = hit
            ? "pointer"
              : mode === "orbit"
              ? "move"
              : "crosshair"
        }
      }
    }
    const onLeave = () => {
      hasLastPointer = false
    }
    const onUp = () => {
      held = false
    }
    const onClick = (event: MouseEvent) => {
      if (dragged || performance.now() - downTime > 450) return
      const link = pickLink(event)
      if (link) {
        const data = link.object.userData as LinkData
        propsRef.current.onLink?.(data.url, data.label)
        propsRef.current.onCue?.("click")
        const hotspot = office.hotspots.find((item) => item.url === data.url)
        if (hotspot) hotspot.opened = true
        window.open(data.url, "_blank", "noopener,noreferrer")
        return
      }
      const hit = pick(event)
      const name = hit?.object.userData?.name as string | undefined
      if (!name) return
      follow(name)
    }
    const dialogRefOpen = () => {
      const dialog = container.closest("body")?.querySelector("dialog")
      return Boolean(dialog?.open)
    }
    const isTyping = () => {
      const active = document.activeElement as HTMLElement | null
      if (!active) return false
      if (dialogRefOpen()) return true
      return ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
    }
    const startFlight = () => {
      const direction = camera.getWorldDirection(new THREE.Vector3())
      look.yaw = Math.atan2(-direction.x, -direction.z)
      look.pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))
      eyeHeight = camera.position.y
      transition = 0
      settled = false
      controls.enabled = false
      setMode("flight")
    }
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const flyKeys = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]
      if (mode === "orbit" && flyKeys.includes(key) && !isTyping()) {
        event.preventDefault()
        startFlight()
        keys.add(key)
        return
      }
      // No click or pointer lock is needed to enter the free-flight controls.
      const movement = [
        "w",
        "a",
        "s",
        "d",
        "shift",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
        "control",
      ]
      if (mode !== "orbit" && movement.includes(key)) {
        if (!isTyping()) {
          event.preventDefault()
          keys.add(event.key.toLowerCase())
        }
        return
      }
      if (event.key === "Escape" && mode !== "orbit") {
        release()
        return
      }
      if (mode !== "orbit") return
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "=",
          "-",
          "Home",
        ].includes(event.key)
      )
        return
      event.preventDefault()
      transition = 0
      settled = false
      controls.enableDamping = true
      if (event.key === "Home") {
        home()
        return
      }
      const spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target),
      )
      if (event.key === "ArrowLeft") spherical.theta -= 0.1
      if (event.key === "ArrowRight") spherical.theta += 0.1
      if (event.key === "ArrowUp") spherical.phi -= 0.08
      if (event.key === "ArrowDown") spherical.phi += 0.08
      if (event.key === "+" || event.key === "=") spherical.radius *= 0.9
      if (event.key === "-") spherical.radius *= 1.1
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi,
        controls.minPolarAngle,
        controls.maxPolarAngle,
      )
      spherical.radius = THREE.MathUtils.clamp(
        spherical.radius,
        controls.minDistance,
        controls.maxDistance,
      )
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3().setFromSpherical(spherical))
      controls.update()
    }
    const onLost = (event: Event) => {
      event.preventDefault()
      propsRef.current.onError?.(
        "The graphics connection was interrupted. Reload to reopen the studio.",
      )
    }
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)
    canvas.addEventListener(
      "wheel",
      () => {
        settled = false
      },
      { passive: true },
    )
    window.addEventListener("pointerup", onUp)
    canvas.addEventListener("click", onClick)
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    const onBlur = () => keys.clear()
    window.addEventListener("blur", onBlur)
    canvas.addEventListener("webglcontextlost", onLost)

    function celebrate(name: string) {
      const agent = crew.byName(name)
      if (!agent) return
      agent.react()
      vibe = Math.min(100, vibe + 6)
      shake = Math.min(0.35, shake + 0.16)
      flash = Math.min(0.5, flash + 0.3)
      const wave = waves[waveCursor++ % waves.length]
      wave.mesh.visible = true
      wave.mesh.position.set(agent.root.position.x, 0.05, agent.root.position.z)
      ;(wave.mesh.material as THREE.MeshBasicMaterial).color.set(agent.accent)
      wave.life = 1
      propsRef.current.onCue?.("cheer")
      propsRef.current.onVibe?.(vibe, `${agent.name} — ${agent.lastLine}`)
    }

    /** Celebrate, then drop the camera into that agent's eyes. */
    function follow(name: string) {
      const agent = crew.byName(name)
      if (!agent) return
      celebrate(name)
      crew.agents.forEach((member) => (member.held = false))
      agent.hold()
      setMode("agent", name)
      const head = new THREE.Vector3()
      agent.root.getWorldPosition(head)
      // over the shoulder at head height — their point of view, not their scalp
      const back = 3.8
      const headY = (agent.sitting ? 1.5 : 1.68) + 0.3
      const eyeY = STUDIO_ALTITUDE + agent.root.position.y + headY
      eyeHeight = eyeY
      glideTo(
        [
          head.x + Math.sin(agent.root.rotation.y) * back,
          eyeY,
          head.z + Math.cos(agent.root.rotation.y) * back,
        ],
        agent.root.rotation.y,
        1.2,
      )
      look.pitch = -0.08
    }

    /** Step out into the office and walk it. */
    function explore() {
      setMode("walk", null)
      glideTo([1.4, STUDIO_ALTITUDE + EYE, 5.6], 0, 1.1)
      eyeHeight = STUDIO_ALTITUDE + EYE
      propsRef.current.onCue?.("enter")
    }

    /** Drop back to the orbit camera. */
    function release() {
      crew.agents.forEach((member) => (member.held = false))
      setMode("orbit")
      propsRef.current.onCue?.("exit")
    }

    let glide: Glide | null = null

    function glideTo(position: V3, yaw: number, seconds: number) {
      const from = camera.position.clone()
      const fromYaw = look.yaw
      let difference = (yaw - fromYaw) % (Math.PI * 2)
      if (difference > Math.PI) difference -= Math.PI * 2
      if (difference < -Math.PI) difference += Math.PI * 2
      glide = {
        start: performance.now(),
        seconds,
        from,
        to: new THREE.Vector3(position[0], position[1], position[2]),
        fromYaw,
        toYaw: fromYaw + difference,
      }
    }

    const forwardVector = new THREE.Vector3()
    const rightVector = new THREE.Vector3()
    const moveVector = new THREE.Vector3()

    const updateWalk = (delta: number) => {
      if (mode === "flight") {
        const turn = 1.8 * delta
        if (keys.has("arrowleft")) look.yaw += turn
        if (keys.has("arrowright")) look.yaw -= turn
        if (keys.has("arrowup")) look.pitch = Math.min(1.35, look.pitch + turn)
        if (keys.has("arrowdown")) look.pitch = Math.max(-1.35, look.pitch - turn)
        forwardVector.set(
          -Math.sin(look.yaw) * Math.cos(look.pitch),
          Math.sin(look.pitch),
          -Math.cos(look.yaw) * Math.cos(look.pitch),
        )
        rightVector.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw))
        moveVector.set(0, 0, 0)
        if (keys.has("w")) moveVector.add(forwardVector)
        if (keys.has("s")) moveVector.sub(forwardVector)
        if (keys.has("d")) moveVector.add(rightVector)
        if (keys.has("a")) moveVector.sub(rightVector)
        if (keys.has(" ")) moveVector.y += 1
        if (keys.has("control")) moveVector.y -= 1
        if (moveVector.lengthSq() > 0) {
          moveVector.normalize()
          camera.position.addScaledVector(
            moveVector,
            (keys.has("shift") ? 24 : 10) * delta,
          )
        }
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -100, 100)
        camera.position.y = THREE.MathUtils.clamp(
          camera.position.y,
          STUDIO_ALTITUDE - 20,
          STUDIO_ALTITUDE + 110,
        )
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -100, 100)
        camera.rotation.set(look.pitch, look.yaw, 0)
        controls.target.copy(camera.position)
        return
      }
      if (glide) {
        const t = Math.min(
          1,
          (performance.now() - glide.start) / (glide.seconds * 1000),
        )
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        camera.position.lerpVectors(glide.from, glide.to, eased)
        look.yaw = glide.fromYaw + (glide.toYaw - glide.fromYaw) * eased
        look.pitch *= 1 - eased
        if (t >= 1) glide = null
      } else {
        forwardVector.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
        rightVector.set(-forwardVector.z, 0, forwardVector.x)
        moveVector.set(0, 0, 0)
        if (keys.has("w") || keys.has("arrowup")) moveVector.add(forwardVector)
        if (keys.has("s") || keys.has("arrowdown"))
          moveVector.sub(forwardVector)
        if (keys.has("d") || keys.has("arrowright")) moveVector.add(rightVector)
        if (keys.has("a") || keys.has("arrowleft")) moveVector.sub(rightVector)
        const running = keys.has("shift")
        if (moveVector.lengthSq() > 0) {
          moveVector.normalize()
          camera.position.addScaledVector(
            moveVector,
            (running ? 4.1 : 2.1) * delta,
          )
          stepPhase += delta * (running ? 11 : 6.4)
          if (stepPhase > Math.PI) {
            stepPhase -= Math.PI
            propsRef.current.onCue?.(running ? "run" : "step")
          }
          bob = Math.sin(stepPhase * 2) * 0.022
        } else {
          bob *= 0.86
        }
        clampToPlate(camera.position)
      }
      camera.position.y = eyeHeight + bob
      camera.rotation.set(look.pitch, look.yaw, 0)
      controls.target.copy(camera.position)
    }

    const api: WorldApi = {
      celebrate,
      follow,
      explore,
      release,
      pulse: () => {
        flash = 0.5
        practicals.forEach((light) => (light.intensity = 70))
      },
    }
    if (propsRef.current.apiRef) propsRef.current.apiRef.current = api

    let frame = 0
    let last = performance.now()
    let elapsed = 0
    let report = -10
    let diagnostics = -1000
    let ready = false
    let paused = false
    let disposed = false

    const publish = () =>
      propsRef.current.onActivity?.(
        crew.agents.map((agent) => ({
          name: agent.name,
          activity: agent.activity,
          room: agent.room,
        })),
      )

    const animate = (now: number) => {
      if (disposed) return
      frame = requestAnimationFrame(animate)
      // software renderers get a capped frame rate so the page stays responsive
      if (lowPower && now - last < 90) return
      const delta = Math.max(0, Math.min((now - last) / 1000, 0.1))
      last = now
      if (document.hidden) return

      const running = !propsRef.current.paused && !reduced
      paused = !running
      if (
        lastFocus !== propsRef.current.focus ||
        lastReset !== (propsRef.current.resetToken ?? 0)
      )
        home()

      if (running) {
        elapsed += delta
        // A slow 140-second day/night cycle and a 64-second rain/clear cycle.
        const daylight = 0.5 - Math.cos((elapsed * Math.PI * 2) / 140) * 0.5
        const weatherWave = 0.5 + Math.cos((elapsed * Math.PI * 2) / 64) * 0.5
        const rainAmount = THREE.MathUtils.smoothstep(weatherWave, 0.18, 0.82)
        atmosphere?.update(elapsed, daylight, rainAmount)
        hemisphere.color.lerpColors(nightHemisphere, dayHemisphere, daylight)
        hemisphere.groundColor.lerpColors(nightGround, dayGround, daylight)
        hemisphere.intensity = (lowPower ? 1.05 : 0.9) + daylight * 0.38
        key.color.lerpColors(nightKey, dayKey, daylight)
        key.intensity = 0.32 + daylight * 1.62
        rim.intensity = 0.95 - daylight * 0.36
        fog.color.copy(nightFog).lerp(dayFog, daylight * 0.82)
        fog.density = 0.0085 + rainAmount * 0.004
        office.update(elapsed, vibe / 100)
        office.hotspots.forEach((hotspot) => {
          hotspot.hoverTarget = hotspot === hoveredLink
        })
        crew.update(delta, elapsed)
        if (mode !== "orbit") updateWalk(delta)
        practicals.forEach((light, index) => {
          light.intensity =
            34 + Math.sin(elapsed * (1.6 + index * 0.3)) * 5 + vibe * 1.1
        })
        if (grade) grade.uniforms.uTime.value = elapsed

        // collaboration beams
        let pair: [typeof crew.agents[number], typeof crew.agents[number]] | null =
          null
        for (let i = 0; i < crew.agents.length && !pair; i++) {
          for (let j = i + 1; j < crew.agents.length; j++) {
            const a = crew.agents[i]
            const b = crew.agents[j]
            if (a.moving || b.moving || a.cheering || b.cheering) continue
            if (a.root.position.distanceTo(b.root.position) < 2.4) {
              pair = [a, b]
              break
            }
          }
        }
        if (pair) {
          const positions = linkGeometry.attributes
            .position as THREE.BufferAttribute
          pair.forEach((agent, index) =>
            positions.setXYZ(
              index,
              agent.root.position.x,
              agent.root.position.y + 1.15,
              agent.root.position.z,
            ),
          )
          positions.needsUpdate = true
          linkMaterial.opacity = 0.35 + Math.sin(elapsed * 4) * 0.12
        } else
          linkMaterial.opacity = Math.max(0, linkMaterial.opacity - delta * 2)

        // shockwaves
        for (const wave of waves) {
          if (wave.life <= 0) continue
          wave.life -= delta * 1.5
          const material = wave.mesh.material as THREE.MeshBasicMaterial
          material.opacity = Math.max(0, wave.life) * 0.8
          wave.mesh.scale.setScalar(1 + (1 - wave.life) * 7)
          if (wave.life <= 0) wave.mesh.visible = false
        }
        shake = Math.max(0, shake - delta * 1.4)
        flash = Math.max(0, flash - delta * 2.2)
      }

      grade?.uniforms && (grade.uniforms.uFlash.value = flash)

      if (elapsed - report > 1 || !ready) {
        publish()
        report = elapsed
      }
      // user input and damping first, then the scripted move wins the frame so a
      // reset always lands on exactly the same pose
      if (mode === "orbit" && !settled) controls.update()
      if (transition) {
        // wall-clock easing: the move always lands in the same place and always
        // completes, however slow the device renders
        const t = Math.min(1, (now - transitionStart) / 900)
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        camera.position.lerpVectors(startCamera, destinationCamera, eased)
        controls.target.lerpVectors(startTarget, destinationTarget, eased)
        if (t >= 1) {
          // land exactly on the saved pose, then freeze until the next input
          camera.position.copy(destinationCamera)
          controls.target.copy(destinationTarget)
          camera.lookAt(controls.target)
          transition = 0
          settled = true
          controls.enableDamping = true
        }
      }
      // live, unthrottled: a scripted move is only "settled" once it has landed
      container.dataset.settled = String(!transition && mode === "orbit")
      if (composer && gradeMix < 1) {
        gradeMix = Math.min(1, gradeMix + delta * 0.9)
        if (bloom) bloom.strength = 0.2 * gradeMix
        if (grade) grade.uniforms.uAmount.value = 0.18 * gradeMix
      }
      if (shake > 0 && !transition) {
        const viewDirection = camera.position
          .clone()
          .sub(controls.target)
          .normalize()
        const right = new THREE.Vector3()
          .crossVectors(viewDirection, new THREE.Vector3(0, 1, 0))
          .normalize()
        camera.position.addScaledVector(
          right,
          Math.sin(elapsed * 48) * shake * 0.12,
        )
        camera.position.y += Math.sin(elapsed * 37) * shake * 0.1
      }

      if (composer) composer.render()
      else renderer.render(scene, camera)

      if (!transition && (now - diagnostics > 500 || !ready)) {
        container.dataset.ready = "true"
        container.dataset.camera = JSON.stringify({
          position: camera.position.toArray(),
          target: controls.target.toArray(),
        })
        container.dataset.agentPositions = JSON.stringify(
          crew.agents.map((agent) => ({
            name: agent.name,
            position: agent.root.position.toArray(),
            activity: agent.activity,
          })),
        )
        container.dataset.renderCalls = String(sceneCalls)
        container.dataset.renderTriangles = String(sceneTriangles)
        container.dataset.lightCount = String(lightCount)
        container.dataset.paused = String(paused)
        // where the wall links land on screen, so the walkthrough is testable
        container.dataset.links = JSON.stringify(
          office.hotspots.map((spot) => {
            const point = spot.target
              .getWorldPosition(new THREE.Vector3())
              .project(camera)
            return {
              label: spot.label,
              x: Math.round((point.x * 0.5 + 0.5) * container.clientWidth),
              y: Math.round((-point.y * 0.5 + 0.5) * container.clientHeight),
            }
          }),
        )
        const openCard = office.hotspots.find((spot) => spot.hover > 0.5)
        if (openCard) {
          const spot = openCard.card
            .getWorldPosition(new THREE.Vector3())
            .project(camera)
          container.dataset.linkCard = `${openCard.label} ${Math.round((spot.x * 0.5 + 0.5) * container.clientWidth)},${Math.round((-spot.y * 0.5 + 0.5) * container.clientHeight)}`
        } else delete container.dataset.linkCard
        diagnostics = now
      }
      if (!ready) {
        ready = true
        propsRef.current.onReady?.()
      }
      if (!atmosphere) {
        // the district is built once the interior is on screen
        const cityKit = new Kit()
        cityKit.hazeEnabled = !lowPower
        const cityRoot = new THREE.Group()
        cityRoot.name = "elevated-studio-city"
        scene.add(cityRoot)
        atmosphere = buildCity(cityKit, cityRoot, 1, facadeMap)
        batches.push(...cityKit.commit(cityRoot, materials))
      }
    }
    frame = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      reducedQuery.removeEventListener("change", onMotion)
      controls.dispose()
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("click", onClick)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
      canvas.removeEventListener("webglcontextlost", onLost)
      if (propsRef.current.apiRef) propsRef.current.apiRef.current = null
      crew.dispose()
      office.dispose()
      atmosphere?.dispose()
      disposables.forEach((item) => item.dispose())
      batches.forEach((batch) => {
        batch.geometry.dispose()
        ;(batch.material as THREE.Material).dispose()
      })
      linkGeometry.dispose()
      linkMaterial.dispose()
      composer?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  return (
    <div
      className="studio-world"
      ref={containerRef}
      aria-label="Interactive night-shift studio"
    />
  )
}
