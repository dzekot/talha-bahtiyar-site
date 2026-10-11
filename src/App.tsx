import { useCallback, useEffect, useMemo, useState } from "react";
import StudioWorld, { type StudioFocus } from "./StudioWorld";

const projects = [
  {
    id: "radar",
    number: "01",
    name: "RadarPro",
    eyebrow: "Mobility intelligence",
    description: "A location-aware driving companion that turns live road signals into calm, useful decisions.",
    color: "red",
  },
  {
    id: "vektr",
    number: "02",
    name: "VEKTR",
    eyebrow: "Creative intelligence",
    description: "An AI-native platform where strategy, identity and autonomous production work as one.",
    color: "violet",
  },
  {
    id: "lab",
    number: "03",
    name: "Experimental Lab",
    eyebrow: "Emerging technology",
    description: "Generative experiments, spatial interfaces and creative code at the edge of what's possible.",
    color: "cyan",
  },
] as const;

const capabilities = [
  "Agentic systems",
  "Product engineering",
  "Creative direction",
  "Interactive technology",
];

function Mark() {
  return (
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <path d="M5 8h32M21 8v27M10 15v20M32 15v20" />
    </svg>
  );
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={diagonal ? "M5 15 15 5M8 5h7v7" : "M4 10h12M12 6l4 4-4 4"} />
    </svg>
  );
}

export default function App() {
  const [focus, setFocus] = useState<StudioFocus>("studio");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoaded(true), 850);
    return () => window.clearTimeout(timeout);
  }, []);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === focus),
    [focus],
  );

  const selectFocus = useCallback((next: StudioFocus) => {
    setFocus(next);
    setSelectedAgent(null);
    setPanelOpen(next !== "studio");
  }, []);

  const selectAgent = useCallback((name: string) => {
    setSelectedAgent(name);
    setPanelOpen(true);
  }, []);

  const openAbout = useCallback(() => {
    setFocus("studio");
    setSelectedAgent(null);
    setPanelOpen(true);
  }, []);

  return (
    <main className="app-shell">
      <StudioWorld
        focus={focus}
        onFocus={selectFocus}
        onAgentSelect={selectAgent}
      />

      <div className={`loader ${loaded ? "is-gone" : ""}`}>
        <div className="loader-mark">TB</div>
        <div className="loader-line"><span /></div>
        <p>Initializing agentic studio</p>
      </div>

      <header className="topbar">
        <button className="brand" onClick={() => selectFocus("studio")} aria-label="Return to studio">
          <span className="brand-mark"><Mark /></span>
          <span>
            <strong>Talha Bahtiyar</strong>
            <small>Creative technologist</small>
          </span>
        </button>

        <nav className="nav-pill" aria-label="Main navigation">
          {(["studio", "radar", "vektr", "lab"] as StudioFocus[]).map((item) => (
            <button
              key={item}
              className={focus === item ? "active" : ""}
              onClick={() => selectFocus(item)}
            >
              {item === "radar" ? "RadarPro" : item === "lab" ? "Lab" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
          <button onClick={openAbout}>About</button>
        </nav>

        <div className="agent-count">
          <span className="live-dot" />
          <span>Agents online</span>
          <strong>08</strong>
        </div>
      </header>

      <section className="hero-copy">
        <p className="kicker">Independent creative technology studio</p>
        <h1>A studio for<br />what's <em>next.</em></h1>
        <p className="intro">
          I build intelligent systems, create digital experiences, and turn ambitious ideas into real products.
        </p>
        <button className="primary-action" onClick={() => selectFocus("vektr")}>
          Explore the studio <Arrow />
        </button>
        <div className="explore-hint">
          <span className="mouse-icon" />
          Drag to orbit · Scroll to zoom · Select a room
        </div>
      </section>

      <aside className="capability-rail">
        {capabilities.map((capability) => <span key={capability}>{capability}</span>)}
      </aside>

      <section className="projects-strip" aria-label="Selected projects">
        <div className="strip-label">
          <span>Selected projects</span>
          <span>03 / 03</span>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-card ${project.color} ${focus === project.id ? "active" : ""}`}
              onClick={() => selectFocus(project.id)}
            >
              <span className="project-number">{project.number}</span>
              <span className="project-copy">
                <strong>{project.name}</strong>
                <small>{project.eyebrow}</small>
              </span>
              <span className="card-arrow"><Arrow diagonal /></span>
            </button>
          ))}
        </div>
      </section>

      <div className="world-tools">
        <button onClick={() => setSoundOn(!soundOn)} aria-label="Toggle ambient sound">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 9v6h4l5 4V5L9 9H5zm12 1c1 1 1 3 0 4m2-7c3 3 3 7 0 10" />
          </svg>
          <span>{soundOn ? "Sound on" : "Sound off"}</span>
        </button>
        <button onClick={() => selectFocus("studio")} aria-label="Reset camera">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2-5.5M4 4v6h6" />
          </svg>
          <span>Reset view</span>
        </button>
      </div>

      <aside className="simulation-feed" aria-label="Live studio activity">
        <div className="feed-heading">
          <span>Live workflow</span>
          <span className="feed-wave"><i /><i /><i /><i /></span>
        </div>
        <div className="feed-row">
          <span className="agent-token violet">M</span>
          <span><strong>Muse + Relay</strong><small>Reviewing VEKTR directions</small></span>
        </div>
        <div className="feed-row">
          <span className="agent-token cyan">V</span>
          <span><strong>Vector</strong><small>Deploying product build</small></span>
        </div>
        <div className="feed-row">
          <span className="agent-token red">R</span>
          <span><strong>Rover → Orchestration</strong><small>Transferring road context</small></span>
        </div>
      </aside>

      <aside className={`detail-panel ${panelOpen ? "open" : ""}`}>
        <button className="panel-close" onClick={() => setPanelOpen(false)} aria-label="Close details">×</button>
        <p className="panel-kicker">{selectedAgent ? "Live agent" : activeProject ? activeProject.eyebrow : "About Talha"}</p>
        {selectedAgent ? (
          <>
            <h2>{selectedAgent}</h2>
            <p>
              This autonomous agent is actively moving through the studio—collecting context, working at stations and collaborating with the wider system. Follow its illuminated path in the world.
            </p>
            <div className="agent-status">
              <span className="live-dot" />
              <div><small>Current state</small><strong>Coordinating next task</strong></div>
            </div>
          </>
        ) : activeProject ? (
          <>
            <div className={`project-glyph ${activeProject.color}`}>{activeProject.number}</div>
            <h2>{activeProject.name}</h2>
            <p>{activeProject.description}</p>
            <a href={`mailto:hello@talhabahtiyar.com?subject=${activeProject.name}`} className="text-link">
              Start a conversation <Arrow />
            </a>
          </>
        ) : (
          <>
            <h2>Ideas become systems.</h2>
            <p>
              Talha is an AI-native Creative Technologist, Product Builder and Agentic Systems Architect. He works across software, design and automation to build products end to end.
            </p>
            <div className="panel-tags">
              {capabilities.map((item) => <span key={item}>{item}</span>)}
            </div>
            <a href="mailto:hello@talhabahtiyar.com" className="text-link">
              hello@talhabahtiyar.com <Arrow />
            </a>
          </>
        )}
      </aside>

      <footer>
        <span>© 2025 Talha Bahtiyar</span>
        <button onClick={openAbout}>Available for select collaborations</button>
      </footer>
    </main>
  );
}
