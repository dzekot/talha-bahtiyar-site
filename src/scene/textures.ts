import * as THREE from "three"

const DISPLAY =
  '"Avenir Next Condensed", "Helvetica Neue", Inter, system-ui, sans-serif'
const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace'

export const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context)
    throw new Error("This browser cannot create the studio artwork.")
  return { canvas, context }
}

/** Anisotropic filtering is expensive on software rasterisers. */
let anisotropy = 8
export function setTextureQuality(maxAnisotropy: number) {
  anisotropy = maxAnisotropy
}

function toTexture(
  canvas: HTMLCanvasElement,
  repeat: [number, number] = [1, 1],
) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = anisotropy
  return texture
}

/* ------------------------------------------------------------------ */
/* Animated screens                                                    */
/* ------------------------------------------------------------------ */

export type ScreenKind = "code" | "radar" | "chart" | "terminal" | "chat" | "map" | "render" | "wave" | "site-radar" | "site-vektr"

const LINES = [
  "const agent = orchestrate({",
  "  model: 'tb-core-v4',",
  "  tools: ['radar', 'vector'],",
  "  retries: 3, timeout: 8_000,",
  "})",
  "await agent.run({ goal })",
  "if (!ok) { escalate() }",
  "export default pipeline",
]

/** A live screen surface. Redrawn on a budget so dozens of them stay cheap. */
export class Screen {
  texture: THREE.CanvasTexture
  private context: CanvasRenderingContext2D
  private time = Math.random() * 40

  constructor(
    readonly kind: ScreenKind,
    readonly title: string,
    readonly accent: number,
    width = 512,
    height = 288,
  ) {
    const made = surface(width, height)
    this.context = made.context
    this.texture = toTexture(made.canvas)
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping
  }

  update(delta: number) {
    this.time += delta
    const { context: ctx, texture } = this
    const w = texture.image.width as number
    const h = texture.image.height as number
    const t = this.time
    const accent = hex(this.accent)

    const background = ctx.createLinearGradient(0, 0, 0, h)
    background.addColorStop(0, "#0a1420")
    background.addColorStop(1, "#05080f")
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = "#0d1a26"
    ctx.fillRect(0, 0, w, 26)
    ctx.fillStyle = accent
    ctx.fillRect(0, 26, w, 2)
    ctx.font = `600 14px ${MONO}`
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#7f95ad"
    ctx.fillText(this.title.toUpperCase(), 14, 14)
    ctx.fillStyle = Math.sin(t * 3) > 0 ? accent : "#1d3342"
    ctx.beginPath()
    ctx.arc(w - 18, 13, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(0, 34)
    ctx.beginPath()
    ctx.rect(0, 0, w, h - 34)
    ctx.clip()
    this.paint(w, h - 34, t, accent)
    ctx.restore()

    // scanlines + glass reflection keep the surface from reading as flat UI
    ctx.fillStyle = "rgba(255,255,255,0.035)"
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
    const sheen = ctx.createLinearGradient(0, 0, w, h)
    sheen.addColorStop(0, "rgba(180,230,255,0.09)")
    sheen.addColorStop(0.42, "rgba(180,230,255,0)")
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, w, h)
    texture.needsUpdate = true
  }

  private paint(w: number, h: number, t: number, accent: string) {
    const ctx = this.context
    if (this.kind === "code") {
      ctx.font = `15px ${MONO}`
      const scroll = Math.floor(t * 1.6)
      for (let i = 0; i < 18; i++) {
        const row = (i + scroll) % LINES.length
        const y = 20 + i * 17
        ctx.fillStyle = "#20323f"
        ctx.fillText(String((i + scroll) % 99).padStart(2, "0"), 14, y)
        ctx.fillStyle = [accent, "#9fd8ff", "#ffd28a", "#c9b6ff"][(i + row) % 4]
        ctx.fillText(LINES[row], 48, y)
      }
      const caretY = 20 + 18 * 17
      ctx.fillStyle = accent
      if (Math.sin(t * 8) > 0) ctx.fillRect(48, caretY - 14, 9, 16)
    } else if (this.kind === "radar") {
      const cx = w * 0.5
      const cy = h * 0.52
      const r = Math.min(w, h) * 0.42
      ctx.strokeStyle = "rgba(120,200,230,0.28)"
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (r * i) / 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(cx - r, cy)
      ctx.lineTo(cx + r, cy)
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx, cy + r)
      ctx.stroke()
      const sweep = (t * 1.1) % (Math.PI * 2)
      const gradient = ctx.createConicGradient
        ? ctx.createConicGradient(sweep - 1, cx, cy)
        : null
      if (gradient) {
        gradient.addColorStop(0, "rgba(0,0,0,0)")
        gradient.addColorStop(0.12, `${accent}44`)
        gradient.addColorStop(0.16, "rgba(0,0,0,0)")
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = accent
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r)
      ctx.stroke()
      for (let i = 0; i < 9; i++) {
        const angle = i * 2.39 + t * 0.13
        const d = r * (0.25 + ((i * 37) % 70) / 100)
        const x = cx + Math.cos(angle) * d
        const y = cy + Math.sin(angle) * d
        const near = (angle - sweep + Math.PI * 4) % (Math.PI * 2) < 1.2
        ctx.fillStyle = near ? accent : "rgba(120,200,230,0.35)"
        ctx.fillRect(x - 3, y - 2, 6, 4)
      }
    } else if (this.kind === "chart") {
      ctx.strokeStyle = "rgba(130,170,200,0.18)"
      for (let i = 1; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(20, (h / 5) * i)
        ctx.lineTo(w - 20, (h / 5) * i)
        ctx.stroke()
      }
      const bars = 22
      for (let i = 0; i < bars; i++) {
        const v = 0.25 + 0.62 * Math.abs(Math.sin(i * 0.7 + t * 0.6))
        ctx.fillStyle = i % 4 === 0 ? accent : "rgba(120,200,235,0.45)"
        ctx.fillRect(
          22 + i * ((w - 44) / bars),
          h - 18 - v * (h - 60),
          (w - 44) / bars - 5,
          v * (h - 60),
        )
      }
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) {
        const x = 22 + (i / 40) * (w - 44)
        const y =
          h * 0.55 - Math.sin(i * 0.4 + t * 1.4) * 34 - Math.sin(i * 0.13) * 18
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      }
      ctx.stroke()
    } else if (this.kind === "terminal") {
      ctx.font = `15px ${MONO}`
      const scroll = Math.floor(t * 3)
      for (let i = 0; i < 14; i++) {
        const y = 22 + i * 17
        ctx.fillStyle =
          i === scroll % 14 ? accent : i % 3 === 0 ? "#7de3b0" : "#4c8f74"
        const text = [
          "$ agent run --goal 'ship'",
          "✓ planner online",
          "→ tool: vector.search",
          "← 12 results, 3 merged",
          "⚡ latency 240ms",
          "✓ checkpoint saved",
          "$ ",
        ][(i + scroll) % 7]
        ctx.fillText(text, 16, y)
      }
      if (Math.sin(t * 9) > 0) {
        ctx.fillStyle = accent
        ctx.fillRect(16, h - 22, 10, 15)
      }
    } else if (this.kind === "chat") {
      const messages = [
        ["scout", "sensors are green 🚀"],
        ["muse", "pushed the new palette"],
        ["relay", "pipeline queued ✅"],
        ["pixel", "one more render, promise"],
        ["atlas", "brb kahve ☕"],
      ]
      ctx.font = `14px ${MONO}`
      messages.forEach((message, i) => {
        const y = 16 + i * 40
        const active = Math.floor(t * 0.7) % messages.length === i
        ctx.fillStyle = active
          ? "rgba(120,200,235,0.16)"
          : "rgba(120,200,235,0.07)"
        ctx.fillRect(14, y, Math.min(w - 40, 60 + message[1].length * 8), 30)
        ctx.fillStyle = active ? accent : "#9fc4dc"
        ctx.fillText(`${message[0]}: ${message[1]}`, 22, y + 16)
      })
    } else if (this.kind === "map") {
      ctx.strokeStyle = "rgba(110,190,225,0.22)"
      for (let x = 0; x < w; x += 26) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + 40, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 22) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y + 12)
        ctx.stroke()
      }
      ctx.strokeStyle = accent
      ctx.lineWidth = 2.5
      ctx.beginPath()
      const steps = 26
      for (let i = 0; i <= steps; i++) {
        const p = (t * 0.12 + i / steps) % 1
        const x = 30 + p * (w - 60)
        const y = h * 0.5 + Math.sin(i * 0.6) * h * 0.3 + Math.sin(p * 6) * 12
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      }
      ctx.stroke()
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(w - 60, h * 0.5 + Math.sin(t) * 40, 5, 0, Math.PI * 2)
      ctx.fill()
    } else if (this.kind === "render") {
      ctx.strokeStyle = "rgba(110,190,225,0.15)"
      for (let i = 1; i < 6; i++) {
        ctx.beginPath()
        ctx.moveTo((w / 6) * i, 0)
        ctx.lineTo((w / 6) * i, h)
        ctx.moveTo(0, (h / 6) * i)
        ctx.lineTo(w, (h / 6) * i)
        ctx.stroke()
      }
      const cx = w * 0.5
      const cy = h * 0.5
      const r = Math.min(w, h) * 0.3
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      for (let axis = 0; axis < 3; axis++) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(t * 0.5 + axis)
        ctx.strokeRect(-r * 0.6, -r, r * 1.2, r * 2)
        ctx.restore()
      }
      ctx.fillStyle = `${accent}22`
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2)
      ctx.fill()
    } else if (this.kind === "site-radar" || this.kind === "site-vektr") {
      this.paintSite(w, h, t, accent, this.kind === "site-radar")
    } else {
      const bars = 40
      for (let i = 0; i < bars; i++) {
        const v =
          0.2 +
          0.8 *
            Math.abs(Math.sin(i * 0.5 + t * 3)) *
            Math.abs(Math.cos(i * 0.13 - t * 1.4))
        ctx.fillStyle = i % 4 === 0 ? accent : "rgba(120,200,235,0.4)"
        ctx.fillRect(
          10 + i * ((w - 20) / bars),
          h * 0.5 - v * h * 0.42,
          (w - 20) / bars - 3,
          v * h * 0.84,
        )
      }
    }
  }

  /** A drawn preview of one of the studio's own sites, shown on the wall
   *  displays inside the studio. Nothing is fetched — it is all artwork. */
  private paintSite(
    w: number,
    h: number,
    t: number,
    accent: string,
    radar: boolean,
  ) {
    const ctx = this.context
    const domain = radar ? "radarpro.online" : "vektr.design"
    ctx.fillStyle = "#0b111b"
    ctx.fillRect(0, 0, w, 30)
    ;["#ff5f57", "#febc2e", "#28c840"].forEach((color, index) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(16 + index * 15, 15, 5, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = "#141c29"
    ctx.fillRect(62, 7, w - 80, 17)
    ctx.font = `500 11px ${MONO}`
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#8fa4bb"
    ctx.fillText(domain, 74, 16)

    const top = 34
    const bodyH = h - top
    if (radar) {
      ctx.fillStyle = "#080d15"
      ctx.fillRect(0, top, w, bodyH)
      ctx.strokeStyle = "rgba(90,170,210,0.16)"
      for (let x = 0; x < w; x += 28) {
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x - 30, h)
        ctx.stroke()
      }
      for (let y = top; y < h; y += 24) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y + 8)
        ctx.stroke()
      }
      const route = (p: number) =>
        top + bodyH * 0.62 + Math.sin(p * 7 + 0.4) * bodyH * 0.22
      ctx.strokeStyle = accent
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let i = 0; i <= 30; i++) {
        const x = 40 + (i / 30) * (w - 90)
        i ? ctx.lineTo(x, route(i / 30)) : ctx.moveTo(x, route(0))
      }
      ctx.stroke()
      const marker = (t * 0.08) % 1
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(40 + marker * (w - 90), route(marker), 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "rgba(8,14,22,0.9)"
      ctx.fillRect(16, top + 16, 108, 62)
      ctx.strokeStyle = "rgba(140,200,235,0.25)"
      ctx.strokeRect(16, top + 16, 108, 62)
      ctx.font = `700 34px ${DISPLAY}`
      ctx.fillStyle = accent
      ctx.fillText("68", 26, top + 50)
      ctx.font = `500 11px ${MONO}`
      ctx.fillStyle = "#7f93a8"
      ctx.fillText("km/h", 72, top + 50)
      ctx.fillStyle = "rgba(8,14,22,0.9)"
      ctx.fillRect(w - 150, top + 16, 134, 62)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === 1 ? accent : "rgba(140,200,235,0.35)"
        ctx.fillRect(w - 140, top + 26 + i * 20, i === 1 ? 112 : 74, 6)
      }
      ctx.font = `700 22px ${DISPLAY}`
      ctx.fillStyle = "#e8f6ff"
      ctx.fillText("RADARPRO", w / 2 - 78, top + 34)
    } else {
      const gradient = ctx.createLinearGradient(0, top, w, h)
      gradient.addColorStop(0, "#120b18")
      gradient.addColorStop(1, "#1b0d22")
      ctx.fillStyle = gradient
      ctx.fillRect(0, top, w, bodyH)
      ctx.font = `700 34px ${DISPLAY}`
      ctx.fillStyle = "#fdf1ff"
      ctx.fillText("VEKTR", 20, top + 38)
      ctx.font = `500 10px ${MONO}`
      ctx.fillStyle = accent
      ctx.fillText("CREATIVE INTELLIGENCE", 22, top + 54)
      const tiles = [
        "#ff5fa8",
        "#8b6bff",
        "#38e8ff",
        "#ffb347",
        "#8dffb0",
        "#ff6b6b",
      ]
      const labels = [
        "IDENTITY",
        "MOTION",
        "SYSTEM",
        "CAMPAIGN",
        "PRODUCT",
        "SOUND",
      ]
      for (let i = 0; i < 6; i++) {
        const x = 20 + (i % 3) * ((w - 46) / 3)
        const y = top + 70 + Math.floor(i / 3) * 52
        const size = (w - 46) / 3 - 8
        ctx.globalAlpha = 0.85
        ctx.fillStyle = tiles[i]
        ctx.fillRect(x, y, size, 44)
        ctx.globalAlpha = 1
        ctx.fillStyle = "rgba(0,0,0,0.35)"
        ctx.fillRect(x, y + 30, size, 14)
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        ctx.font = `600 9px ${MONO}`
        ctx.fillText(labels[i], x + 6, y + 40)
      }
      ctx.fillStyle = Math.sin(t * 2.4) > 0 ? accent : "rgba(255,95,168,0.3)"
      ctx.beginPath()
      ctx.arc(w - 34, top + 34, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Holographic call-to-action that unfolds over a wall display. */
export function linkCardTexture(label: string, accent: number) {
  const { canvas, context } = surface(512, 128)
  const color = hex(accent)
  context.clearRect(0, 0, 512, 128)
  context.fillStyle = "rgba(4,8,14,0.88)"
  context.beginPath()
  context.roundRect(4, 18, 504, 92, 10)
  context.fill()
  context.strokeStyle = color
  context.lineWidth = 3
  context.stroke()
  context.shadowColor = color
  context.shadowBlur = 22
  context.stroke()
  context.shadowBlur = 0
  context.fillStyle = color
  context.fillRect(4, 18, 6, 92)
  context.textBaseline = "middle"
  context.textAlign = "left"
  context.font = `500 15px ${MONO}`
  context.fillStyle = color
  context.fillText("OPEN LIVE PREVIEW", 30, 46)
  context.font = `700 34px ${DISPLAY}`
  context.fillStyle = "#f2fbff"
  context.fillText(label, 28, 82)
  context.font = `700 30px ${DISPLAY}`
  context.fillStyle = color
  context.fillText("↗", 430, 76)
  return toTexture(canvas)
}

/* ------------------------------------------------------------------ */
/* Signage                                                             */
/* ------------------------------------------------------------------ */

export interface SignOptions {
  accent?: number
  width?: number
  height?: number
  sub?: string
  style?: "solid" | "outline" | "boxed" | "vertical"
}

/** Neon panel used for wall signage, hanging banners and lobby marks. */
export function signTexture(text: string, options: SignOptions = {}) {
  const { accent = 0x38e8ff, sub = "", style = "boxed" } = options
  const width = options.width ?? 512
  const height = options.height ?? 128
  const { canvas, context } = surface(width, height)
  const color = hex(accent)

  context.fillStyle = "#04070d"
  context.fillRect(0, 0, width, height)
  if (style === "boxed") {
    context.strokeStyle = `${color}55`
    context.lineWidth = 4
    context.strokeRect(14, 14, width - 28, height - 28)
    context.fillStyle = `${color}18`
    context.fillRect(18, 18, width - 36, height - 36)
  }

  context.textAlign = "center"
  context.textBaseline = "middle"
  const outline = style === "outline"
  const vertical = style === "vertical"
  const mainSize = vertical
    ? height * 0.3
    : Math.min(height * 0.52, (width / Math.max(3, text.length)) * 1.55)
  context.font = `700 ${mainSize}px ${DISPLAY}`
  context.shadowColor = color
  context.shadowBlur = 34
  context.fillStyle = outline ? "transparent" : "#eaf9ff"
  context.strokeStyle = color
  context.lineWidth = 3

  if (vertical) {
    const step = height / (text.length + 1)
    ;[...text].forEach((glyph, i) => {
      const x = width / 2
      const y = step * (i + 1)
      if (!outline) context.fillText(glyph, x, y)
      context.strokeText(glyph, x, y)
    })
  } else {
    const y = sub ? height * 0.42 : height * 0.5
    if (!outline) context.fillText(text, width / 2, y, width * 0.86)
    context.strokeText(text, width / 2, y, width * 0.86)
  }

  if (sub) {
    context.shadowBlur = 16
    context.font = `500 ${height * 0.13}px ${MONO}`
    context.fillStyle = color
    context.fillText(sub.toUpperCase(), width / 2, height * 0.76, width * 0.8)
  }
  context.shadowBlur = 0

  // corner ticks
  context.strokeStyle = `${color}aa`
  context.lineWidth = 3
  const tick = 26
  for (const [x, y, sx, sy] of [
    [10, 10, 1, 1],
    [width - 10, 10, -1, 1],
    [10, height - 10, 1, -1],
    [width - 10, height - 10, -1, -1],
  ]) {
    context.beginPath()
    context.moveTo(x + tick * sx, y)
    context.lineTo(x, y)
    context.lineTo(x, y + tick * sy)
    context.stroke()
  }
  return toTexture(canvas)
}

/** Stylised city advertising panel. */
export function billboardTexture(index: number, accent: number) {
  const { canvas, context } = surface(512, 256)
  const color = hex(accent)
  const gradients = [color, "#ff5fa8", "#8f7bff", "#3fe0ff", "#ffb347"]
  const fill = gradients[index % gradients.length]
  const gradient = context.createLinearGradient(0, 0, 512, 256)
  gradient.addColorStop(0, "#05070f")
  gradient.addColorStop(1, "#0b1120")
  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 256)

  context.save()
  context.translate(0, 0)
  if (index % 3 === 0) {
    context.strokeStyle = `${fill}66`
    context.lineWidth = 6
    for (let i = 0; i < 9; i++) {
      context.beginPath()
      context.arc(120, 190, 40 + i * 26, Math.PI, Math.PI * 2)
      context.stroke()
    }
    context.fillStyle = fill
    context.shadowColor = fill
    context.shadowBlur = 26
    context.font = `700 74px ${DISPLAY}`
    context.fillText("夜", 84, 170)
  } else if (index % 3 === 1) {
    context.fillStyle = `${fill}22`
    for (let i = 0; i < 16; i++) {
      const h = 30 + ((i * 47) % 120)
      context.fillRect(30 + i * 30, 236 - h, 18, h)
    }
    context.fillStyle = fill
    context.shadowColor = fill
    context.shadowBlur = 24
    context.font = `700 58px ${DISPLAY}`
    context.fillText("RAMEN 24", 36, 96)
  } else {
    context.strokeStyle = `${fill}99`
    context.lineWidth = 5
    for (let i = 0; i < 5; i++) {
      context.beginPath()
      context.arc(360, 128, 30 + i * 22, 0, Math.PI * 2)
      context.stroke()
    }
    context.fillStyle = "#eaf6ff"
    context.shadowColor = fill
    context.shadowBlur = 30
    context.font = `700 64px ${DISPLAY}`
    context.fillText("SYNTH", 36, 118)
    context.font = `500 26px ${MONO}`
    context.fillStyle = fill
    context.fillText("MARKET / SECTOR 7", 38, 158)
  }
  context.restore()
  return toTexture(canvas)
}

/** Repeating tower facade: lit windows, antennae and service bands. */
export function facadeTexture(seed = 1) {
  // Distant skyline faces cover only a few screen pixels on the opening shot;
  // double the texel density so the repeated window pattern stays crisp there.
  const { canvas, context } = surface(512, 1024)
  context.fillStyle = "#04070d"
  context.fillRect(0, 0, 512, 1024)
  let state = seed * 9301 + 49297
  const random = () => (state = (state * 9301 + 49297) % 233280) / 233280
  const columns = 6
  const rows = 12
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const lit = random()
      const x = 20 + column * 80
      const y = 32 + row * 82
      if (lit > 0.68) {
        const warm = random()
        const color =
          warm > 0.75 ? "#ffd9a0" : warm > 0.35 ? "#8fd8ff" : "#ffa8dd"
        context.fillStyle = color
        context.globalAlpha = 0.28 + random() * 0.55
        context.fillRect(x, y, 52, 40)
        context.globalAlpha = 1
      } else {
        context.fillStyle = "#070c15"
        context.fillRect(x, y, 52, 40)
      }
    }
  }
  context.fillStyle = "#0d1522"
  for (let row = 0; row < rows; row += 4)
    context.fillRect(0, 16 + row * 82, 512, 10)
  return toTexture(canvas)
}

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

/** Comic shout used when an agent is clicked. */
export function bubbleTexture(text: string, accent: number) {
  const width = 512
  const height = 256
  const { canvas, context } = surface(width, height)
  const color = hex(accent)
  context.textAlign = "center"
  context.textBaseline = "middle"
  const size = text.length > 10 ? 76 : 92
  context.font = `900 ${size}px ${DISPLAY}`
  context.lineJoin = "round"

  // starburst backing
  context.save()
  context.translate(width / 2, 104)
  context.beginPath()
  const points = 18
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2
    const radius = i % 2 === 0 ? 118 : 84
    const x = Math.cos(angle) * radius * 1.7
    const y = Math.sin(angle) * radius * 0.62
    i ? context.lineTo(x, y) : context.moveTo(x, y)
  }
  context.closePath()
  context.fillStyle = "#06080f"
  context.strokeStyle = color
  context.lineWidth = 7
  context.shadowColor = color
  context.shadowBlur = 28
  context.fill()
  context.stroke()
  context.restore()

  context.shadowColor = "#ffffff"
  context.shadowBlur = 16
  context.lineWidth = 12
  context.strokeStyle = "#05070d"
  context.strokeText(text, width / 2, 100, width - 40)
  context.fillStyle = "#ffffff"
  context.fillText(text, width / 2, 100, width - 40)
  context.shadowBlur = 0

  // tail
  context.fillStyle = "#06080f"
  context.strokeStyle = color
  context.lineWidth = 6
  context.beginPath()
  context.moveTo(width / 2 - 26, 156)
  context.lineTo(width / 2 - 8, 216)
  context.lineTo(width / 2 + 24, 154)
  context.closePath()
  context.fill()
  context.stroke()
  return toTexture(canvas)
}

/** Small floating name plate that identifies every agent in the office. */
export function tagTexture(name: string, role: string, accent: number) {
  const { canvas, context } = surface(256, 80)
  const color = hex(accent)
  context.fillStyle = "rgba(4,8,14,0.82)"
  context.beginPath()
  context.roundRect(2, 6, 252, 66, 12)
  context.fill()
  context.strokeStyle = `${color}99`
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = color
  context.fillRect(2, 6, 5, 66)
  context.textBaseline = "middle"
  context.font = `700 30px ${DISPLAY}`
  context.fillStyle = "#eef8ff"
  context.fillText(name.toUpperCase(), 18, 32)
  context.font = `500 16px ${MONO}`
  context.fillStyle = color
  context.fillText(role.toUpperCase(), 18, 56)
  return toTexture(canvas)
}

/** Soft radial falloff: contact shadows, light halos, rain splashes. */
export function radialTexture(inner = "#ffffff", power = 0.5) {
  const { canvas, context } = surface(128, 128)
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, inner)
  gradient.addColorStop(power, `${inner}66`)
  gradient.addColorStop(1, "#00000000")
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = toTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

/** Long soft streak used by the rain shader. */
export function streakTexture() {
  const { canvas, context } = surface(32, 256)
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, "rgba(190,230,255,0)")
  gradient.addColorStop(0.4, "rgba(200,236,255,0.85)")
  gradient.addColorStop(1, "rgba(190,230,255,0)")
  context.fillStyle = gradient
  context.fillRect(12, 0, 8, 256)
  const texture = toTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

/** Radial spark burst popped when an agent celebrates. */
export function sparkTexture() {
  const { canvas, context } = surface(256, 256)
  context.clearRect(0, 0, 256, 256)
  context.translate(128, 128)
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 120)
  gradient.addColorStop(0, "rgba(255,255,255,0.95)")
  gradient.addColorStop(0.25, "rgba(255,255,255,0.35)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.beginPath()
  context.arc(0, 0, 120, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = "rgba(255,255,255,0.95)"
  context.lineCap = "round"
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const inner = i % 2 ? 26 : 44
    const outer = i % 2 ? 96 : 118
    context.lineWidth = i % 3 === 0 ? 7 : 3
    context.beginPath()
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
    context.stroke()
  }
  context.lineWidth = 4
  context.beginPath()
  context.arc(0, 0, 58, 0, Math.PI * 2)
  context.stroke()
  const texture = toTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

/** Interior wall art — layered system diagram, printed on the matte layer. */
export function wallArt(accent: number, label: string) {
  const { canvas, context } = surface(512, 384)
  const color = hex(accent)
  context.fillStyle = "#0a1018"
  context.fillRect(0, 0, 512, 384)
  context.strokeStyle = `${color}44`
  context.lineWidth = 2
  context.strokeRect(18, 18, 476, 348)
  context.font = `700 42px ${DISPLAY}`
  context.fillStyle = "#dceaf6"
  context.textBaseline = "middle"
  context.fillText(label.toUpperCase(), 40, 66)
  context.font = `500 18px ${MONO}`
  context.fillStyle = color
  context.fillText("THINK / MAKE / ITERATE", 40, 96)

  const nodes = [
    [110, 200],
    [256, 160],
    [402, 210],
    [256, 300],
  ] as [number, number][]
  context.strokeStyle = `${color}88`
  context.lineWidth = 3
  nodes.forEach(([x, y], i) => {
    nodes.forEach(([x2, y2], j) => {
      if (j <= i) return
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x2, y2)
      context.stroke()
    })
  })
  nodes.forEach(([x, y], i) => {
    context.fillStyle = i % 2 ? `${color}33` : "#0e1826"
    context.strokeStyle = color
    context.lineWidth = 3
    context.beginPath()
    context.arc(x, y, 30 + (i % 2) * 8, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  })
  return toTexture(canvas)
}

/** Painted floor stencil used around the studio walkways. */
export function floorStencil(text: string, accent: number) {
  const { canvas, context } = surface(512, 128)
  context.clearRect(0, 0, 512, 128)
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.font = `700 64px ${DISPLAY}`
  context.fillStyle = `${hex(accent)}bb`
  context.fillText(text.toUpperCase(), 256, 68, 500)
  context.strokeStyle = `${hex(accent)}55`
  context.lineWidth = 4
  context.setLineDash([18, 14])
  context.strokeRect(12, 12, 488, 104)
  const texture = toTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

/** Title card rendered on the studio's biggest wall display. */
export function marqueeTexture() {
  const { canvas, context } = surface(768, 384)
  const gradient = context.createLinearGradient(0, 0, 768, 384)
  gradient.addColorStop(0, "#05070f")
  gradient.addColorStop(1, "#0c1a2a")
  context.fillStyle = gradient
  context.fillRect(0, 0, 768, 384)
  context.strokeStyle = "#38e8ff44"
  context.lineWidth = 5
  context.strokeRect(20, 20, 728, 344)
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.shadowColor = "#38e8ff"
  context.shadowBlur = 40
  context.font = `900 88px ${DISPLAY}`
  context.fillStyle = "#f2fbff"
  context.fillText("TALHA", 384, 142)
  context.font = `900 62px ${DISPLAY}`
  context.fillStyle = "#ff5fa8"
  context.fillText("BAHTIYAR", 384, 218)
  context.shadowBlur = 18
  context.font = `500 22px ${MONO}`
  context.fillStyle = "#8fe9ff"
  context.fillText("AGENTIC STUDIO // SECTOR 07 // NIGHT SHIFT", 384, 292)
  context.shadowBlur = 0
  return toTexture(canvas)
}
