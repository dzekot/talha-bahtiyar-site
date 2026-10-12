import * as THREE from "three"
import { Kit, NEON, type V3 } from "./kit"
import { billboardTexture, radialTexture } from "./textures"

export interface Atmosphere {
  group: THREE.Group
  update: (time: number, daylight?: number, rain?: number) => void
  dispose: () => void
}

const SKY = 0x05070f
const SKY_NIGHT = {
  top: new THREE.Color(0x03050c),
  mid: new THREE.Color(0x0d1430),
  bottom: new THREE.Color(0x2a1038),
}
const SKY_DAY = {
  top: new THREE.Color(0x3777ba),
  mid: new THREE.Color(0x82b8dc),
  bottom: new THREE.Color(0xc6a5a0),
}

/** Layered skyline, weather and distant traffic seen past the studio glass. */
export function buildCity(
  kit: Kit,
  panels: THREE.Group,
  quality: number,
  facadeMap: THREE.Texture,
): Atmosphere {
  const group = new THREE.Group()
  group.name = "city"
  const disposables: { dispose(): void }[] = []
  const animated: {
    object: THREE.Object3D
    spin?: number
    bob?: number
    phase: number
  }[] = []
  const facade = facadeMap

  let seed = 99
  const random = () =>
    (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648

  // A single supertall supports the studio's roof deck. The surrounding
  // skyline stays lower so the office owns the horizon instead of sinking
  // among the neighboring towers.
  const towerHeight = 90
  kit.at([0, 0, 0])
  kit.box("matte", [20, towerHeight, 14], [0, towerHeight / 2, -1.4], 0x101827)
  kit.box("metal", [20.8, 0.8, 14.8], [0, towerHeight - 0.4, -1.4], 0x28384a)
  kit.quad("facade", 19.6, towerHeight - 2, [0, towerHeight / 2, 5.63], [0, 0, 0], 0x849ab4, [3.2, 6.3])
  kit.quad("facade", 19.6, towerHeight - 2, [0, towerHeight / 2, -8.43], [0, Math.PI, 0], 0x7489a8, [3.2, 6.3])
  kit.quad("facade", 13.6, towerHeight - 2, [10.03, towerHeight / 2, -1.4], [0, Math.PI / 2, 0], 0x7185a0, [2.4, 6.3])
  kit.quad("facade", 13.6, towerHeight - 2, [-10.03, towerHeight / 2, -1.4], [0, -Math.PI / 2, 0], 0x7185a0, [2.4, 6.3])
  for (const y of [14, 32, 50, 68, 86]) {
    kit.box("glow", [20.2, 0.08, 0.08], [0, y, 5.72], y === 86 ? 0x8dffb0 : 0x59f2ff, undefined, 0.85)
    kit.box("metal", [20.4, 0.16, 0.16], [0, y - 0.14, 5.72], 0x25384b)
  }
  for (const x of [-9.75, 9.75])
    kit.box("metal", [0.28, towerHeight - 1, 0.36], [x, towerHeight / 2, 5.72], 0x2b3b4f)
  kit.world()

  // Deep gradient dome so the horizon never reads as flat black.
  const skyUniforms = {
    top: { value: new THREE.Color(0x03050c) },
    mid: { value: new THREE.Color(0x0d1430) },
    bottom: { value: new THREE.Color(0x2a1038) },
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(150, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader:
        "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying float h; void main(){ float t = clamp(h*0.5+0.5,0.0,1.0); vec3 c = mix(bottom, mid, smoothstep(0.32,0.55,t)); c = mix(c, top, smoothstep(0.55,0.95,t)); gl_FragColor = vec4(c,1.0); }",
    }),
  )
  dome.material.depthWrite = false
  group.add(dome)

  // Skyline: a ring of towers around the plate, far enough back that the studio
  // always reads in front of the district
  const towers = 34
  for (let i = 0; i < towers; i++) {
    const band = i % 3
    const distance = 40 + band * 18 + random() * 22
    const angle = (i / towers) * Math.PI * 2 + (random() - 0.5) * 0.24
    const width = 8 + random() * 12
    const depth = 8 + random() * 10
    const height = 30 + random() * (26 + band * 14)
    const x = Math.sin(angle) * distance
    const z = -Math.cos(angle) * distance
    kit.at([x, 0, z])
    kit.box(
      "matte",
      [width, height, depth],
      [0, height / 2, 0],
      band === 0 ? 0x0b1120 : 0x080d18,
    )
    kit.box(
      "matte",
      [width * 0.5, 1.2, depth * 0.5],
      [0, height + 0.6, 0],
      0x070b14,
    )
    // lit facades on the four faces, uv-scaled so windows keep a constant size
    const tiles: [number, number] = [
      Math.max(1, Math.round(width / 6)),
      Math.max(2, Math.round(height / 14)),
    ]
    const tint = band === 2 ? 0x5a6c85 : 0xd8e6f2
    kit.quad(
      "facade",
      width,
      height,
      [0, height / 2, depth / 2 + 0.02],
      [0, 0, 0],
      tint,
      tiles,
    )
    kit.quad(
      "facade",
      width,
      height,
      [0, height / 2, -depth / 2 - 0.02],
      [0, Math.PI, 0],
      tint,
      tiles,
    )
    kit.quad(
      "facade",
      depth,
      height,
      [width / 2 + 0.02, height / 2, 0],
      [0, Math.PI / 2, 0],
      tint,
      [tiles[0], tiles[1]],
    )
    // Tall, restrained edge lights let the skyline read through the windows
    // even when its lower streets sit well below the rooftop studio.
    for (const side of [-1, 1]) {
      kit.box(
        "glow",
        [0.055, height * 0.74, 0.06],
        [side * width * 0.43, height * 0.45, depth / 2 + 0.055],
        side < 0 ? 0x59f2ff : 0xff5fa8,
        undefined,
        0.42,
      )
    }
    kit.box(
      "glow",
      [width * 0.62, 0.045, 0.06],
      [0, height * 0.72, depth / 2 + 0.06],
      0x59f2ff,
      undefined,
      0.32,
    )
    kit.quad(
      "facade",
      depth,
      height,
      [-width / 2 - 0.02, height / 2, 0],
      [0, -Math.PI / 2, 0],
      tint,
      [tiles[0], tiles[1]],
    )
    // roof beacon
    if (random() > 0.62) {
      kit.ball(
        "glow",
        0.16,
        [0, height + 1.2, 0],
        random() > 0.5 ? 0xff5f8a : 0x59f2ff,
        2.4,
      )
      kit.cyl("metal", 0.05, 1.4, [0, height + 0.7, 0], 0x2b3542)
    }
    kit.world()
  }

  // Rooftop holographic ring above the district.
  const holoMaterial = new THREE.MeshBasicMaterial({
    color: 0x59f2ff,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const holo = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.35, 8, 60),
    holoMaterial,
  )
  holo.position.set(-6, 46, -64)
  holo.rotation.x = Math.PI / 2.6
  group.add(holo)
  animated.push({ object: holo, spin: 0.08, phase: 0 })

  const holoInner = new THREE.Mesh(
    new THREE.TorusGeometry(6, 0.18, 8, 48),
    holoMaterial.clone(),
  )
  holoInner.material.color = new THREE.Color(0xff5fa8)
  holoInner.position.copy(holo.position)
  holoInner.rotation.set(Math.PI / 2.2, 0.4, 0)
  group.add(holoInner)
  animated.push({ object: holoInner, spin: -0.12, phase: 1.4 })

  // Search lights sweeping the haze.
  for (let i = 0; i < (quality > 0.5 ? 2 : 1); i++) {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 60, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: i ? 0x59f2ff : 0xff5fa8,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    )
    beam.position.set(i ? 34 : -30, 28, -50)
    beam.rotation.z = i ? 0.5 : -0.5
    group.add(beam)
    animated.push({ object: beam, spin: 0.05, phase: i * 2 })
  }

  // Traffic: streaks of light crossing the district on a loop.
  const traffic = new THREE.Group()
  const trafficColors = [0x59f2ff, 0xff5fa8, 0xffd36b, 0xb18bff]
  for (let i = 0; i < (quality > 0.5 ? 9 : 5); i++) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.16),
      new THREE.MeshBasicMaterial({
        color: trafficColors[i % trafficColors.length],
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    const lane = random()
    streak.userData = {
      speed: 9 + random() * 16,
      y: 9 + lane * 34,
      phase: random(),
      z: -22 - lane * 44,
      direction: i % 2 ? 1 : -1,
    }
    traffic.add(streak)
    disposables.push(streak.geometry, streak.material)
  }
  group.add(traffic)

  // Giant rooftop billboards facing the studio.
  for (let i = 0; i < (quality > 0.5 ? 5 : 3); i++) {
    const texture = billboardTexture(
      i,
      [0x59f2ff, 0xff5fa8, 0x8f7bff, 0x3fe0ff, 0xffb347][i],
    )
    disposables.push(texture)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      transparent: true,
      opacity: 0.95,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), material)
    mesh.position.set(
      -32 + i * 16 + random() * 4,
      15 + random() * 20,
      -46 - random() * 14,
    )
    mesh.rotation.y = Math.PI + (random() - 0.5) * 0.5
    group.add(mesh)
    disposables.push(mesh.geometry)
  }

  // Horizon haze + wet-street sheen under the district.
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 60),
    new THREE.MeshBasicMaterial({
      map: radialTexture("#5a2f8f", 0.35),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  haze.position.set(0, 16, -78)
  group.add(haze)
  disposables.push(haze.geometry, haze.material)

  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({ color: 0x05070f, toneMapped: false }),
  )
  street.rotation.x = -Math.PI / 2
  street.position.y = -0.6
  group.add(street)
  disposables.push(street.geometry, street.material)

  // Rain: one Points draw call, animated entirely on the GPU.
  const drops = quality > 0.5 ? 3600 : 1400
  const positions = new Float32Array(drops * 3)
  const speeds = new Float32Array(drops)
  const sizes = new Float32Array(drops)
  for (let i = 0; i < drops; i++) {
    positions[i * 3] = (random() - 0.5) * 78
    positions[i * 3 + 1] = random() * 34
    positions[i * 3 + 2] = (random() - 0.5) * 64 - 4
    speeds[i] = 7 + random() * 12
    sizes[i] = 0.5 + random() * 1.4
  }
  const rainGeometry = new THREE.BufferGeometry()
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  rainGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1))
  rainGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))
  const rainMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: 34 },
      uSize: { value: 26 },
      uWeather: { value: 1 },
    },
    vertexShader: `
      attribute float aSpeed; attribute float aSize;
      uniform float uTime; uniform float uHeight; uniform float uSize;
      varying float vAlpha;
      void main() { vec3 p = position;
        p.y = mod(p.y - uTime * aSpeed, uHeight) - 2.0;
        p.x += sin(uTime * 0.35 + position.z * 0.4) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aSize * (10.0 / max(1.0, -mv.z));
        vAlpha = clamp(1.0 - (-mv.z) / 90.0, 0.0, 1.0); }`,
    fragmentShader: `
      uniform float uWeather; varying float vAlpha;
      void main() { vec2 uv = gl_PointCoord - 0.5;
        float streak = smoothstep(0.5, 0.0, abs(uv.x) * 6.0) * smoothstep(0.5, 0.05, abs(uv.y));
        gl_FragColor = vec4(vec3(0.72, 0.86, 1.0), streak * vAlpha * 0.42 * uWeather); }`,
  })
  const rain = new THREE.Points(rainGeometry, rainMaterial)
  rain.frustumCulled = false
  group.add(rain)
  disposables.push(rainGeometry, rainMaterial)

  panels.add(group)

  return {
    group,
    update(time: number, daylight = 0, rainAmount = 1) {
      rainMaterial.uniforms.uTime.value = time
      rainMaterial.uniforms.uWeather.value = rainAmount
      skyUniforms.top.value.lerpColors(SKY_NIGHT.top, SKY_DAY.top, daylight)
      skyUniforms.mid.value.lerpColors(SKY_NIGHT.mid, SKY_DAY.mid, daylight)
      skyUniforms.bottom.value.lerpColors(SKY_NIGHT.bottom, SKY_DAY.bottom, daylight)
      animated.forEach((item) => {
        item.object.rotation.y += (item.spin ?? 0) * 0.016
        item.object.rotation.z = Math.sin(time * 0.25 + item.phase) * 0.12
      })
      traffic.children.forEach((streak) => {
        const data = streak.userData as {
          speed: number
          y: number
          phase: number
          z: number
          direction: number
        }
        const span = 150
        const x =
          ((time * data.speed * data.direction + data.phase * span) % span) -
          span / 2
        streak.position.set(x, data.y, data.z)
        streak.rotation.z = data.direction > 0 ? 0 : Math.PI
      })
      holoMaterial.opacity = 0.28 + Math.sin(time * 0.6) * 0.06
    },
    dispose() {
      disposables.forEach((item) => item.dispose())
      dome.geometry.dispose()
      ;(dome.material as THREE.Material).dispose()
      holo.geometry.dispose()
      holoInner.geometry.dispose()
      holoInner.material.dispose()
    },
  }
}

export const CITY_FOG = { near: 26, far: 128, color: SKY }
export const CITY_ACCENT = 0x59f2ff
export type { V3 }
export { NEON }
