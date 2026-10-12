import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type {
  StudioActivity,
  StudioFocus,
  ViewMode,
  WorldApi,
} from "./StudioWorld"
import useAmbientSound, { type SceneCue } from "./hooks/useAmbientSound"

const StudioWorld = lazy(() => import("./StudioWorld"))

const projects = [
  {
    id: "radar",
    number: "01",
    name: "RadarPro",
    eyebrow: "Mobility intelligence",
    color: "lime",
    accent: "#8dffb0",
    description:
      "A location-aware driving companion that turns road signals into calm, useful decisions.",
    narrative:
      "Road information is only useful when it is clear at a glance. RadarPro explores how location, timely signals and a considered interface can come together in a more helpful driving experience.",
    features: [
      "Location-aware road context",
      "Clear, timely alerts",
      "A focused driving interface",
    ],
    principle: "The right information. At the right moment.",
  },
  {
    id: "vektr",
    number: "02",
    name: "VEKTR",
    eyebrow: "Creative intelligence",
    color: "magenta",
    accent: "#ff5fa8",
    description:
      "An AI-native platform where strategy, identity and autonomous production work as one.",
    narrative:
      "Creative work gains momentum when the brief, the identity and the output share the same context. VEKTR brings that idea into a connected system for moving from a direction to a coherent body of work.",
    features: [
      "Strategy and shared context",
      "Connected brand direction",
      "Agent-assisted creative production",
    ],
    principle: "One direction. A connected creative system.",
  },
  {
    id: "lab",
    number: "03",
    name: "Experimental Lab",
    eyebrow: "Emerging technology",
    color: "violet",
    accent: "#a98bff",
    description:
      "Generative experiments, spatial interfaces and creative code at the edge of what's possible.",
    narrative:
      "A space for questions that need a working prototype. The lab brings software, motion and generative systems together to explore new ways of interacting with technology.",
    features: [
      "Spatial and interactive prototypes",
      "Generative visual experiments",
      "Creative code and agent behaviours",
    ],
    principle: "Make something to discover something.",
  },
] as const

const capabilities = [
  "Agentic systems",
  "Product engineering",
  "Creative direction",
  "Interactive technology",
]

const roster = [
  {
    name: "Talha",
    role: "studio founder",
    accent: "#38e8ff",
    quip: "Bir tur daha. Şimdi oldu.",
  },
  {
    name: "Scout",
    role: "signal hunter",
    accent: "#38e8ff",
    quip: "Sinyal temiz, bağlantı hazır.",
  },
  {
    name: "Muse",
    role: "art director",
    accent: "#ff5fa8",
    quip: "Renk paleti kilitlendi, akış çok iyi.",
  },
  {
    name: "Pixel",
    role: "shader cook",
    accent: "#a98bff",
    quip: "Render tamam, görüntü tam kıvamında.",
  },
  {
    name: "Vector",
    role: "systems",
    accent: "#ffb347",
    quip: "Tüm sistemler çalışıyor, akış hazır.",
  },
  {
    name: "Nova",
    role: "orchestrator",
    accent: "#ff5fa8",
    quip: "Ekip senkronize, bütün parçalar bağlı.",
  },
  {
    name: "Atlas",
    role: "logistics",
    accent: "#7fa8ff",
    quip: "Lojistik tamam, ihtiyaç duyduğunda buradayım.",
  },
  { name: "Relay", role: "comms", accent: "#8dffb0", quip: "Sinyal açık, şehir bizi dinliyor." },
] as const

const agentVoiceSources: Record<string, string> = {
  rover: "/audio/agents/rover.wav",
  scout: "/audio/agents/scout.wav",
  muse: "/audio/agents/muse.wav",
  pixel: "/audio/agents/pixel.wav",
  vector: "/audio/agents/vector.wav",
  nova: "/audio/agents/nova.wav",
  atlas: "/audio/agents/atlas.wav",
  relay: "/audio/agents/relay.wav",
}

interface NavItem {
  id: StudioFocus
  label: string
}

interface Sector {
  code: string
  name: string
}

const navItems: NavItem[] = [
  { id: "studio", label: "Floor" },
  { id: "radar", label: "RadarPro" },
  { id: "vektr", label: "VEKTR" },
  { id: "lab", label: "Lab" },
]

const sectors: Record<StudioFocus, Sector> = {
  studio: { code: "A1", name: "Night shift floor" },
  radar: { code: "B2", name: "RadarPro / mobility" },
  vektr: { code: "C3", name: "VEKTR / creative" },
  lab: { code: "D4", name: "Lab / experiments" },
}

class SceneBoundary extends Component<{
  children: ReactNode
  onError: (message: string) => void
}, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError("The 3D view could not be loaded.")
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Mark() {
  return (
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <path d="M5 8h32M21 8v27M10 15v20M32 15v20" />
    </svg>
  )
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={diagonal ? "M5 15 15 5M8 5h7v7" : "M4 10h12M12 6l4 4-4 4"} />
    </svg>
  )
}

function ProjectLogo({ project }: { project: "radar" | "vektr" }) {
  if (project === "radar") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11.5" />
        <circle cx="16" cy="16" r="6" />
        <path d="M16 16 24.5 7.5M16 3v3M29 16h-3M16 29v-3M3 16h3" />
        <circle className="project-logo-ping" cx="22.5" cy="9.5" r="1.7" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 7h5l7 13 7-13h5L16 27 4 7Z" />
      <path d="M11 7h5l7 13" opacity=".55" />
    </svg>
  )
}

export default function App() {
  const [focus, setFocus] = useState<StudioFocus>("studio")
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [sceneError, setSceneError] = useState("")
  const [resetToken, setResetToken] = useState(0)
  const [paused, setPaused] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  const [activity, setActivity] = useState<StudioActivity[]>(() =>
    roster.map((agent) => ({
      name: agent.name,
      activity: "on shift",
      room: "studio" as StudioFocus,
    })),
  )
  const [vibe, setVibe] = useState(0)
  const [shout, setShout] = useState("")
  const [hudOpen, setHudOpen] = useState(false)
  const [mode, setMode] = useState<ViewMode>("orbit")
  const [followed, setFollowed] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [voiceMuted, setVoiceMuted] = useState(false)
  const toastTimer = useRef(0)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const resetRef = useRef<HTMLButtonElement>(null)
  const shoutTimer = useRef(0)
  const voiceRef = useRef<HTMLAudioElement>(null)
  const apiRef = useRef<WorldApi | null>(null)
  const sound = useAmbientSound()

  const activeProject = projects.find((project) => project.id === focus)
  const agentActivity = activity.find((agent) => agent.name === selectedAgent)
  const agentProfile = roster.find((agent) => agent.name === selectedAgent)
  const agentVoice = agentProfile
    ? agentVoiceSources[agentProfile.name.toLowerCase()]
    : undefined

  useEffect(() => {
    const voice = voiceRef.current
    if (!voice) return
    voice.pause()
    voice.currentTime = 0
    voice.muted = voiceMuted
    if (panelOpen && selectedAgent && !voiceMuted)
      void voice.play().catch(() => {
        // Browser autoplay policies can require an explicit replay tap.
      })
    return () => voice.pause()
  }, [panelOpen, selectedAgent, voiceMuted])

  useEffect(() => {
    const dialog = dialogRef.current
    if (panelOpen && dialog && !dialog.open) {
      // only fall back to whatever is focused — Safari leaves it on <body>
      if (!returnFocusRef.current) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
      }
      dialog.showModal()
    } else if (!panelOpen && dialog?.open) dialog.close()
  }, [panelOpen])

  useEffect(() => {
    if (!panelOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    // Safari does not reliably contain focus inside a modal dialog, so the
    // cycle is driven explicitly
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog.open) return
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select, input, [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!items.length) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next = event.shiftKey
        ? index <= 0
          ? items.length - 1
          : index - 1
        : index < 0 || index === items.length - 1
          ? 0
          : index + 1
      event.preventDefault()
      items[next]?.focus()
    }
    dialog.addEventListener("keydown", onKeyDown)
    return () => dialog.removeEventListener("keydown", onKeyDown)
  }, [panelOpen])

  useEffect(() => {
    if (!panelOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [panelOpen])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPaused(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => () => window.clearTimeout(shoutTimer.current), [])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const flashToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(""), 4000)
  }, [])

  // Safari does not focus buttons on click, so the opener is remembered by hand
  const rememberOpener = (source?: HTMLElement | null) => {
    if (source && source !== document.body) returnFocusRef.current = source
  }

  const resetView = useCallback(() => {
    if (mode !== "orbit") apiRef.current?.release()
    setFocus("studio")
    setSelectedAgent(null)
    setPanelOpen(false)
    setResetToken((value) => value + 1)
  }, [mode])

  const selectFocus = useCallback(
    (next: StudioFocus, source?: HTMLElement | null) => {
      rememberOpener(source)
      setFocus(next)
      setSelectedAgent(null)
      // Project navigation is a trip into the live 3D set. Keep the world in
      // view and reserve the dossier dialog for an explicit About/agent action.
      setPanelOpen(false)
      setHudOpen(false)
      if (next !== "studio") {
        const project = projects.find((item) => item.id === next)
        if (project) flashToast(`Viewing ${project.name} workspace`)
      }
    },
    [flashToast],
  )

  const selectAgent = useCallback(
    (name: string, source?: HTMLElement | null) => {
      rememberOpener(source)
      setSelectedAgent(name)
      setPanelOpen(true)
    },
    [],
  )

  const openAbout = useCallback((source?: HTMLElement | null) => {
    rememberOpener(source)
    setFocus("studio")
    setSelectedAgent(null)
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    const target = returnFocusRef.current
    returnFocusRef.current = null
    window.setTimeout(() => {
      if (target?.isConnected && target !== document.body) target.focus()
      else resetRef.current?.focus()
    }, 0)
  }, [])

  const celebrate = useCallback((name: string) => {
    apiRef.current?.celebrate(name)
  }, [])

  /** hype an agent and step into their first-person view */
  const hypeAgent = useCallback((name: string) => {
    apiRef.current?.follow(name)
  }, [])

  const handleMode = useCallback((next: ViewMode, agent: string | null) => {
    setMode(next)
    setFollowed(agent)
  }, [])

  const handleLink = useCallback(
    (url: string, label: string) => {
      flashToast(`${label} opened in a new tab`)
    },
    [flashToast],
  )

  const handleVibe = useCallback((value: number, line: string) => {
    setVibe(value)
    setShout(line)
    window.clearTimeout(shoutTimer.current)
    shoutTimer.current = window.setTimeout(() => setShout(""), 3600)
  }, [])

  const handleReady = useCallback(() => {
    setLoaded(true)
    setSceneError("")
  }, [])

  const handleError = useCallback((message: string) => {
    setSceneError(message)
    setLoaded(false)
  }, [])

  const sector = sectors[focus]

  return (
    <main
      className={`app-shell ${paused ? "is-paused" : ""} ${
        mode === "orbit" ? "" : "is-walking"
      }`}
    >
      <a href="#crew-roster" className="skip-link">
        Skip to the crew
      </a>

      <div className="viewport">
        <SceneBoundary onError={handleError}>
          <Suspense fallback={null}>
            <StudioWorld
              focus={focus}
              onFocus={selectFocus}
              onAgentSelect={selectAgent}
              resetToken={resetToken}
              paused={paused}
              onReady={handleReady}
              onError={handleError}
              onActivity={setActivity}
              onVibe={handleVibe}
              onMode={handleMode}
              onCue={sound.play}
              onLink={handleLink}
              apiRef={apiRef}
            />
          </Suspense>
        </SceneBoundary>
        {!loaded && !sceneError && (
          <div className="loader" role="status">
            <div className="loader-mark">TB</div>
            <div className="loader-line">
              <span />
            </div>
            <p>Preparing the studio</p>
          </div>
        )}
        {sceneError && (
          <div className="scene-fallback" role="status">
            <span className="fallback-mark">
              <Mark />
            </span>
            <h2>The studio, beyond the scene.</h2>
            <p>
              The 3D view is unavailable on this device. Explore the projects
              and ideas below.
            </p>
            <a href="#sectors" className="text-link">
              View selected projects <Arrow />
            </a>
          </div>
        )}
        {mode !== "orbit" && (
          <div className={`walk-hud ${mode === "agent" ? "agent-view" : ""}`}>
            <span className="crosshair" aria-hidden="true" />
            <div className="walk-card">
              <p className="kicker">
                {mode === "agent"
                  ? "Agent view"
                  : mode === "flight"
                    ? "Free flight"
                    : "Walking the floor"}
              </p>
              <strong>
                {mode === "agent" && followed
                  ? followed
                  : "SECTOR 07 · night shift"}
              </strong>
              <span>
                {mode === "flight" ? (
                  <>
                    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · arrows steer · mouse look · <kbd>Space</kbd>/<kbd>Ctrl</kbd> rise/fall · <kbd>Shift</kbd> boost
                  </>
                ) : (
                  <>
                    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · mouse look · <kbd>Shift</kbd> run
                  </>
                )}
              </span>
              <div className="walk-actions">
                {mode === "agent" ? (
                  <button onClick={() => apiRef.current?.explore()}>
                    Step out and keep walking
                  </button>
                ) : null}
                <button onClick={() => apiRef.current?.release()}>
                  Back to overview
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <p className="walk-toast" role="status">
            <span aria-hidden="true">↗</span> {toast}
          </p>
        )}
      </div>

      <div className="hud">
        <header className="topbar">
          <button
            className="brand"
            onClick={resetView}
            aria-label="Talha Bahtiyar — return to the floor"
          >
            <span className="brand-mark">
              <Mark />
            </span>
            <span className="brand-copy">
              <strong>Talha Bahtiyar</strong>
              <small>Agentic systems architect</small>
            </span>
          </button>

          <nav className="nav-pill" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={focus === item.id ? "active" : ""}
                aria-current={focus === item.id ? "page" : undefined}
                onClick={(event) => selectFocus(item.id, event.currentTarget)}
              >
                <span className="nav-code">{sectors[item.id].code}</span>
                {item.label}
              </button>
            ))}
            <button onClick={(event) => openAbout(event.currentTarget)}>
              About
            </button>
          </nav>

          <div className="status-cluster">
            <span className="status-dot" />
            <span className="status-text">
              <strong>{paused ? "Scene paused" : "Shift in progress"}</strong>
              <small>
                {sector.code} · {sector.name}
              </small>
            </span>
          </div>
          <button
            className="hud-toggle"
            onClick={() => setHudOpen((value) => !value)}
            aria-expanded={hudOpen}
            aria-controls="crew-roster"
          >
            {hudOpen ? "Close" : "Crew"}
          </button>
        </header>

        <div className={`hud-body ${hudOpen ? "crew-open" : ""}`}>
          <section className="hero-panel holo" aria-labelledby="studio-heading">
            <p className="kicker">Ideas. Systems. Possibilities.</p>
            <h1 id="studio-heading">
              A studio for
              <br />
              what&apos; s <em>next.</em>
            </h1>
            <p className="intro">
              I build intelligent systems, create digital experiences, and turn
              ambitious ideas into real products.
            </p>
            <button
              className="primary-action"
              onClick={() => {
                if (mode === "orbit") apiRef.current?.explore()
                else apiRef.current?.release()
              }}
            >
              {mode === "orbit" ? "Explore the studio" : "Back to the overview"}{" "}
              <Arrow />
            </button>
            <div className="capability-rail" aria-label="Capabilities">
              {capabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>
            <p className="hero-note">
              <span />
              Eight agents. Two levels. Zero boring meetings.
            </p>
          </section>

          <section
            className={`roster-panel holo ${hudOpen ? "open" : ""}`}
            id="crew-roster"
            aria-label="Crew on shift"
          >
            <div className="panel-head">
              <div>
                <p className="kicker">Crew online</p>
                <h2>Night shift</h2>
              </div>
              <label className="agent-picker">
                <span className="sr-only">Explore a simulated agent</span>
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value)
                      selectAgent(event.target.value, event.currentTarget)
                  }}
                >
                  <option value="">Meet the agents ↗</option>
                  {roster.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="roster-list">
              {roster.map((agent) => {
                const live = activity.find((entry) => entry.name === agent.name)
                return (
                  <li key={agent.name}>
                    <button
                      className="roster-row"
                      onClick={() => hypeAgent(agent.name)}
                      onDoubleClick={() => selectAgent(agent.name)}
                    >
                      <span
                        className="roster-dot"
                        style={{
                          background: agent.accent,
                          boxShadow: `0 0 12px ${agent.accent}`,
                        }}
                      />
                      <span className="roster-copy">
                        <strong>{agent.name}</strong>
                        <small>{live?.activity ?? agent.quip}</small>
                      </span>
                      <span className="roster-hype" aria-hidden="true">
                        hype
                      </span>
                    </button>
                    <button
                      className="roster-open"
                      onClick={(event) =>
                        selectAgent(agent.name, event.currentTarget)
                      }
                      aria-label={`Open ${agent.name}'s dossier`}
                    >
                      ↵
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="vibe-meter">
              <div className="vibe-label">
                <span>Floor vibe</span>
                <strong>
                  {vibe > 0 ? "+" : ""}
                  {Math.round(vibe)}
                </strong>
              </div>
              <div className="vibe-track">
                <span style={{ width: `${vibe}%` }} />
              </div>
            </div>
            {shout && (
              <p className="shout" role="status">
                <span aria-hidden="true">»</span> {shout}
              </p>
            )}
          </section>
        </div>

        <div className="hud-footer">
          <div className="world-toolbar">
            <p className="explore-hint orbit-hint">
              {mode === "orbit" ? (
                <>
                  Move mouse to look · WASD to fly
                  <span>Arrows steer · Space/Ctrl rise · Shift boost · Esc overview</span>
                </>
              ) : (
                <>
                  {mode === "flight"
                    ? "WASD move · mouse look · arrows steer"
                    : "WASD walk · mouse look"}
                  <span>
                    {mode === "flight"
                      ? "Space/Ctrl rise and fall · Shift boost · Esc overview"
                      : "Shift to run · Esc for the overview"}
                  </span>
                </>
              )}
            </p>
            <div className="world-tools" aria-label="Studio controls">
              <button
                onClick={sound.toggleSound}
                disabled={sound.busy}
                aria-pressed={sound.soundOn}
                aria-label="Toggle ambient sound"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 9v6h4l5 4V5L9 9H5zm12 1c1 1 1 3 0 4m2-7c3 3 3 7 0 10" />
                </svg>
                <span>Sound {sound.soundOn ? "on" : "off"}</span>
              </button>
              <button
                onClick={() => setPaused((value) => !value)}
                aria-pressed={paused}
                aria-label={paused ? "Resume simulation" : "Pause simulation"}
                disabled={Boolean(sceneError)}
              >
                <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span>
                {paused ? "Resume" : "Pause"}
                <span className="sr-only"> scene</span>
              </button>
              <button
                ref={resetRef}
                onClick={resetView}
                aria-label="Reset camera"
                disabled={Boolean(sceneError)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12a8 8 0 1 0 2-5.5M4 4v6h6" />
                </svg>
                Reset view
              </button>
            </div>
          </div>
          <div className="project-strip" id="sectors">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-card ${project.color} ${
                  focus === project.id ? "active" : ""
                }`}
                style={{ "--accent": project.accent } as React.CSSProperties}
                onClick={(event) =>
                  selectFocus(project.id, event.currentTarget)
                }
                aria-label={`Explore ${project.name}`}
              >
                {project.id === "lab" ? (
                  <span className="project-number">{project.number}</span>
                ) : (
                  <span className="project-logo" aria-hidden="true">
                    <ProjectLogo project={project.id} />
                  </span>
                )}
                <span className="project-copy">
                  <strong>{project.name}</strong>
                  <small>{project.eyebrow}</small>
                </span>
                <span className="card-arrow">
                  <Arrow diagonal />
                </span>
              </button>
            ))}
          </div>
          <footer className="footer-strip">
            <span>© {new Date().getFullYear()} Talha Bahtiyar</span>
            <span className="footer-live">
              <span className="status-dot" /> Rendering live · no external
              assets
            </span>
            <button onClick={(event) => openAbout(event.currentTarget)}>
              Available for select collaborations <Arrow diagonal />
            </button>
          </footer>
        </div>
      </div>

      {sound.error && (
        <p className="sound-message" role="status">
          {sound.error}
        </p>
      )}

      <dialog
        ref={dialogRef}
        className="detail-panel"
        aria-labelledby="detail-title"
        onClose={closePanel}
        onCancel={() => setPanelOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPanelOpen(false)
        }}
      >
        <article className="panel-content">
          <button
            className="panel-close"
            autoFocus
            onClick={() => setPanelOpen(false)}
            aria-label="Close details"
          >
            ×
          </button>
          <p className="panel-kicker">
            {selectedAgent
              ? "Studio simulation / Agent"
              : activeProject
                ? activeProject.eyebrow
                : "About Talha"}
          </p>
          {selectedAgent ? (
            <>
              <div
                className="project-glyph"
                style={{
                  color: agentProfile?.accent,
                  borderColor: agentProfile?.accent,
                  background: `${agentProfile?.accent}14`,
                }}
              >
                {selectedAgent.slice(0, 1)}
              </div>
              <h2 id="detail-title">{selectedAgent}</h2>
              <p className="panel-lede">
                {agentProfile?.role}. One of the eight agents working the floor
                right now.
              </p>
              {agentVoice && (
                <>
                  <audio ref={voiceRef} src={agentVoice} preload="none" />
                  <p className="agent-voice-line">“{agentProfile?.quip}”</p>
                  <div className="panel-actions agent-voice-actions">
                    <button
                      className="secondary-action"
                      onClick={() => {
                        if (voiceRef.current) {
                          voiceRef.current.currentTime = 0
                          void voiceRef.current.play().catch(() => {})
                        }
                      }}
                    >
                      Replay voice
                    </button>
                    <button
                      className="secondary-action"
                      aria-pressed={voiceMuted}
                      onClick={() => setVoiceMuted((muted) => !muted)}
                    >
                      {voiceMuted ? "Unmute voice" : "Mute voice"}
                    </button>
                  </div>
                </>
              )}
              <p>
                Watch them work a station, walk the aisles, pair up with a
                colleague — or click them in the scene and see what happens.
              </p>
              <div className="agent-status">
                <span className="status-dot" />
                <div>
                  <small>
                    {paused
                      ? "Paused simulation"
                      : sceneError
                        ? "3D view unavailable"
                        : "Live activity"}
                  </small>
                  <strong>
                    {sceneError
                      ? "3D view unavailable"
                      : (agentActivity?.activity ?? "on shift")}
                  </strong>
                </div>
              </div>
              <div className="panel-actions">
                <button
                  className="primary-action"
                  onClick={() => celebrate(selectedAgent)}
                >
                  Hype them up <Arrow />
                </button>
              </div>
              <p className="panel-note">
                This is a visual simulation, not a connected service or a
                real-time report of work.
              </p>
              <div className="panel-tags">
                {roster.map((agent) => (
                  <button
                    key={agent.name}
                    className={selectedAgent === agent.name ? "selected" : ""}
                    aria-pressed={selectedAgent === agent.name}
                    onClick={() => setSelectedAgent(agent.name)}
                    style={{ "--accent": agent.accent } as React.CSSProperties}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            </>
          ) : activeProject ? (
            <>
              <div
                className={`project-glyph ${activeProject.color}`}
                style={{
                  color: activeProject.accent,
                  borderColor: activeProject.accent,
                }}
              >
                {activeProject.number}
              </div>
              <h2 id="detail-title">{activeProject.name}</h2>
              <p className="panel-lede">{activeProject.description}</p>
              <p>{activeProject.narrative}</p>
              <h3>Project focus</h3>
              <ul className="feature-list">
                {activeProject.features.map((feature) => (
                  <li key={feature}>
                    <span aria-hidden="true">↗</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <blockquote>{activeProject.principle}</blockquote>
              <a
                href={`mailto:talha@bahtiyar.org?subject=${encodeURIComponent(`Let's talk about ${activeProject.name}`)}`}
                className="text-link"
              >
                Start a conversation <Arrow />
              </a>
            </>
          ) : (
            <>
              <h2 id="detail-title">Ideas become systems.</h2>
              <p className="panel-lede">
                Talha is an AI-native Creative Technologist, Product Builder and
                Agentic Systems Architect.
              </p>
              <p>
                He works across software, design and automation to build
                products end to end. This studio brings those disciplines
                together: thoughtful ideas, working systems and experiences with
                a point of view.
              </p>
              <div className="panel-tags">
                {capabilities.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <a href="mailto:talha@bahtiyar.org" className="text-link">
                talha@bahtiyar.org <Arrow />
              </a>
            </>
          )}
        </article>
      </dialog>
    </main>
  )
}
