import { expect, test, type Page } from "@playwright/test"
import { mkdir } from "node:fs/promises"

const world = (page: Page) => page.locator(".studio-world")
async function ready(page: Page) {
  await page.goto("/")
  // software rendering on a loaded machine needs a generous first paint
  await expect(world(page)).toHaveAttribute("data-ready", "true", {
    timeout: 45000,
  })
  await expect(
    page.getByText("Preparing the studio", { exact: true }),
  ).toBeHidden()
}
async function diagnostic(page: Page, name: string) {
  return world(page).getAttribute(`data-${name}`)
}

test("production scene loads without errors or remote runtime dependencies", async ({
  page,
}) => {
  const errors: string[] = []
  const external: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1") &&
      !request.url().startsWith("data:")
    )
      external.push(request.url())
  })
  await ready(page)
  await expect(page).toHaveTitle(
    "Talha Bahtiyar | Agentic Systems Architect & Product Builder",
  )
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.waitForTimeout(1200)
  expect(errors).toEqual([])
  expect(external).toEqual([])
  const dimensions = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
      cssWidth: canvas.clientWidth,
      cssHeight: canvas.clientHeight,
    }))
  expect(dimensions.width).toBeGreaterThan(100)
  expect(dimensions.height).toBeGreaterThan(100)
  // HiDPI WebKit runs at DPR 2; software-rendered CI Chromium is capped lower.
  expect(dimensions.width / dimensions.cssWidth).toBeLessThanOrEqual(2.01)
  expect(Number(await diagnostic(page, "render-calls"))).toBeLessThan(400)
  expect(Number(await diagnostic(page, "light-count"))).toBeLessThanOrEqual(12)
  await page.screenshot({
    path: test.info().outputPath(`desktop-${test.info().project.name}.png`),
    fullPage: true,
  })
})

test("projects fly into their live rooms; About dialog preserves the renderer and focus", async ({
  page,
}) => {
  await ready(page)
  await page
    .locator("canvas")
    .evaluate((canvas) => canvas.setAttribute("data-original-canvas", "yes"))
  for (const name of ["RadarPro", "VEKTR", "Experimental Lab"]) {
    const trigger = page.getByRole("button", {
      name: `Explore ${name}`,
      exact: true,
    })
    const cameraBefore = await diagnostic(page, "camera")
    await trigger.click()
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.getByRole("status")).toContainText(`Viewing ${name}`)
    await expect(trigger).toHaveClass(/active/)
    await expect.poll(() => diagnostic(page, "camera")).not.toBe(cameraBefore)
    await expect(
      page.locator('canvas[data-original-canvas="yes"]'),
    ).toHaveCount(1)
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "About", exact: true })
    .click()
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Ideas become systems." }),
  ).toBeVisible()
  await page.keyboard.press("Tab")
  const focusInDialog = await page.evaluate(() =>
    document.querySelector("dialog")?.contains(document.activeElement),
  )
  expect(focusInDialog).toBe(true)
  await page.getByRole("button", { name: "Close details" }).click()
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("mouse-look works without clicking and free flight responds to keyboard controls", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await ready(page)
  const reset = page.getByRole("button", { name: "Reset camera", exact: true })
  // waits until the scripted move has landed, whatever the device frame rate is
  const settle = async () => {
    let previous = ""
    let stable = 0
    for (let attempt = 0; attempt < 80; attempt++) {
      await page.waitForTimeout(250)
      const next = await diagnostic(page, "camera")
      const settled = await world(page).getAttribute("data-settled")
      stable = settled === "true" && next === previous ? stable + 1 : 0
      previous = next
      if (stable >= 3) return next
    }
    return previous
  }
  await reset.click()
  const initial = await settle()
  const box = await page.locator("canvas").boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width * 0.65,
    y = box!.y + box!.height * 0.6
  await page.mouse.move(x, y)
  const pointerEntered = await diagnostic(page, "camera")
  await page.mouse.move(x + 55, y + 24, { steps: 8 })
  await expect.poll(() => diagnostic(page, "camera")).not.toBe(pointerEntered)
  const beforeFlight = await diagnostic(page, "camera")
  // Keep the key down across multiple rendered frames. `press` can dispatch
  // keydown and keyup between two frames on a fast runner, so it may never
  // produce a movement tick.
  await page.keyboard.down("w")
  await page.waitForTimeout(650)
  await page.keyboard.up("w")
  expect(await diagnostic(page, "camera")).not.toBe(beforeFlight)
  await page.keyboard.press("Escape")
  const overview = await settle()
  expect(overview).toBe(initial)

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 110, y + 25, { steps: 15 })
  await page.mouse.up()
  await expect.poll(() => diagnostic(page, "camera")).not.toBe(initial)
  await page.mouse.wheel(0, -350)
  await page.waitForTimeout(700)
  const moved = await diagnostic(page, "camera")
  await reset.click()
  const restored = await settle()
  expect(restored).not.toBe(moved)
  // A reset must return to the same saved studio pose after another independent orbit.
  await page.locator("canvas").focus()
  await page.keyboard.press("ArrowRight")
  await page.waitForTimeout(700)
  expect(await diagnostic(page, "camera")).not.toBe(restored)
  await reset.click()
  expect(await settle()).toBe(restored)
})

test("agents move, pause and resume, and remain accessible by keyboard", async ({
  page,
}) => {
  await ready(page)
  const initial = await diagnostic(page, "agent-positions")
  await expect
    .poll(() => diagnostic(page, "agent-positions"), { timeout: 8000 })
    .not.toBe(initial)
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click()
  await expect(world(page)).toHaveAttribute("data-paused", "true")
  await page.waitForTimeout(1200)
  const stopped = await diagnostic(page, "agent-positions")
  await page.waitForTimeout(1400)
  expect(await diagnostic(page, "agent-positions")).toBe(stopped)
  await page
    .getByRole("combobox", { name: "Explore a simulated agent" })
    .selectOption("Talha")
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Talha", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("dialog").getByText(/visual simulation/),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click()
  await expect
    .poll(() => diagnostic(page, "agent-positions"), { timeout: 8000 })
    .not.toBe(stopped)
})

test("ambient sound is opt-in and produces an actual audio context", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext
    let contexts = 0
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options)
        contexts++
        ;(window as any).__audioContexts = contexts
      }
    }
  })
  await ready(page)
  expect(await page.evaluate(() => (window as any).__audioContexts ?? 0)).toBe(
    0,
  )
  const button = page.getByRole("button", {
    name: "Toggle ambient sound",
    exact: true,
  })
  await button.click()
  await expect(button).toHaveAttribute("aria-pressed", "true")
  expect(await page.evaluate(() => (window as any).__audioContexts)).toBe(1)
  await button.click()
  await expect(button).toHaveAttribute("aria-pressed", "false")
})

test("mobile, tablet and short landscape keep content reachable without horizontal overflow", async ({
  page,
}) => {
  // five full scene boots on a software rasteriser — give it room
  test.setTimeout(240_000)
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size)
    await ready(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "About", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await page
      .getByRole("button", { name: "Explore Experimental Lab", exact: true })
      .click()
    await expect(page.getByRole("status")).toContainText(
      "Viewing Experimental Lab",
    )
    await expect(page.getByRole("dialog")).toBeHidden()
    await page.evaluate(() => window.scrollTo(0, 0))
    await mkdir("release/screenshots", { recursive: true })
    await page.screenshot({
      path: `release/screenshots/${size.width}x${size.height}-${test.info().project.name}.png`,
      fullPage: true,
    })
  }
})

test("reduced motion starts paused while project content remains available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await ready(page)
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeVisible()
  const positions = await diagnostic(page, "agent-positions")
  await page.waitForTimeout(1800)
  expect(await diagnostic(page, "agent-positions")).toBe(positions)
  await page.getByRole("button", { name: "Explore VEKTR", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("Viewing VEKTR")
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("explore mode drops to eye level, walks the floor and returns to orbit", async ({
  page,
}) => {
  await ready(page)
  const walk = page.locator(".walk-hud")
  await expect(walk).toHaveCount(0)
  const overview = await diagnostic(page, "camera")
  await page.getByRole("button", { name: "Explore the studio" }).click()
  await expect(walk).toBeVisible()
  await expect(walk.getByText("Walking the floor")).toBeVisible()
  await expect
    .poll(() => diagnostic(page, "camera"), { timeout: 8000 })
    .not.toBe(overview)
  const eye = JSON.parse((await diagnostic(page, "camera"))!).position
  // The studio sits above the skyline; walking keeps the altitude of its
  // elevated floor rather than dropping the camera to world-space y=0.
  expect(eye[1]).toBeGreaterThan(91.3)
  expect(eye[1]).toBeLessThan(92)
  const before = (await diagnostic(page, "camera"))!
  await page.keyboard.down("w")
  await page.waitForTimeout(1500)
  await page.keyboard.up("w")
  await expect
    .poll(() => diagnostic(page, "camera"), { timeout: 8000 })
    .not.toBe(before)
  const moved = JSON.parse((await diagnostic(page, "camera"))!).position
  expect(Math.hypot(moved[0] - eye[0], moved[2] - eye[2])).toBeGreaterThan(0.3)
  await walk.getByRole("button", { name: "Back to overview" }).click()
  await expect(walk).toHaveCount(0)
  await expect
    .poll(() => diagnostic(page, "camera"), { timeout: 8000 })
    .toBe(overview)
})

test("clicking a crew member celebrates and steps into their view", async ({
  page,
}) => {
  await ready(page)
  const row = page.locator(".roster-row").first()
  const name = (await row.locator(".roster-copy strong").textContent())!.trim()
  await row.click()
  const walk = page.locator(".walk-hud")
  await expect(walk).toBeVisible()
  await expect(walk.getByText("Agent view")).toBeVisible()
  await expect(walk.locator(".walk-card strong")).toHaveText(name)
  const view = JSON.parse((await diagnostic(page, "camera"))!)
  expect(view.position[1]).toBeGreaterThan(1.2)
  await walk.getByRole("button", { name: "Step out and keep walking" }).click()
  await expect(walk.getByText("Walking the floor")).toBeVisible()
  await walk.getByRole("button", { name: "Back to overview" }).click()
  await expect(walk).toHaveCount(0)
})

interface WallLink {
  label: string
  x: number
  y: number
}

test("wall displays preview the studio sites and hand their links over on hover", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const opened: string[] = []
    ;(window as any).__opened = opened
    window.open = (((url: string) => {
      opened.push(String(url))
      return null
    }) as typeof window.open)
  })
  await ready(page)
  const links = async () =>
    JSON.parse((await diagnostic(page, "links"))!) as WallLink[]
  const box = (await page.locator("canvas").boundingBox())!
  const floor = await links()
  const vektr = floor.find((link) => link.label === "vektr.design")!
  expect(vektr).toBeTruthy()
  await page.mouse.move(box.x + vektr.x, box.y + vektr.y)
  await expect
    .poll(() => page.locator("canvas").getAttribute("data-link"), {
      timeout: 8000,
    })
    .toBe("vektr.design")
  await expect
    .poll(() => world(page).getAttribute("data-link-card"), { timeout: 8000 })
    .toContain("vektr.design")
  // Orbit mouse-look is intentionally always on, so physically moving toward
  // the wall after hover can rotate the target away. Dispatch a stationary
  // pointer click at the hovered hotspot to verify the handoff itself.
  await page.locator("canvas").evaluate(
    (canvas, point) => {
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: point.x,
          clientY: point.y,
        }),
      )
      canvas.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: point.x,
          clientY: point.y,
        }),
      )
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: point.x,
          clientY: point.y,
        }),
      )
    },
    { x: box.x + vektr.x, y: box.y + vektr.y },
  )
  await expect
    .poll(() => page.evaluate(() => (window as any).__opened), {
      timeout: 8000,
    })
    .toEqual(["https://vektr.design"])
  // the RadarPro display lives on the west wall of its own sector
  const overviewCamera = await diagnostic(page, "camera")
  await page.getByRole("button", { name: "B2 RadarPro" }).click()
  await expect(page.getByRole("status")).toContainText("Viewing RadarPro")
  await expect
    .poll(() => diagnostic(page, "camera"), { timeout: 8000 })
    .not.toBe(overviewCamera)
  await expect
    .poll(() => world(page).getAttribute("data-settled"), { timeout: 8000 })
    .toBe("true")
  const sector = await links()
  const radar = sector.find((link) => link.label === "radarpro.online")!
  expect(radar.x).toBeGreaterThan(0)
  expect(radar.y).toBeGreaterThan(0)
  expect(radar.x).toBeLessThan(box.width)
  expect(radar.y).toBeLessThan(box.height)
})

test("WebGL failure preserves project, About and contact access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = (function (
      type: any,
      ...args: any[]
    ) {
      if (String(type).startsWith("webgl")) return null
      return (original as any).call(this, type, ...args)
    } as any)
  })
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "The studio, beyond the scene." }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Explore RadarPro", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Explore RadarPro", exact: true }),
  ).toHaveClass(/active/)
  await expect(page.getByRole("dialog")).toBeHidden()
})
