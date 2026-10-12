import { useCallback, useEffect, useRef, useState } from "react"

/** Cues the 3D floor can ask for while it runs. */
export type SceneCue = "step" | "run" | "cheer" | "click" | "enter" | "exit" | "sector" | "land"

/** A quiet generated night-shift soundscape: room tone, distant traffic,
 *  keyboards down the aisle and short cues. Audio only ever starts inside the
 *  user's click, and every sound is synthesised — no files, no requests. */
export default function useAmbientSound() {
  const audio = useRef<AudioContext | null>(null)
  const bus = useRef<GainNode | null>(null)
  const typingTimer = useRef(0)
  const [soundOn, setSoundOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(
    () => () => {
      window.clearInterval(typingTimer.current)
      void audio.current?.close()
    },
    [],
  )

  const buildAmbience = (context: AudioContext, output: GainNode) => {
    // deep room tone
    const lowpass = context.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.value = 340
    lowpass.Q.value = 0.7
    lowpass.connect(output)
    ;[55, 82.4, 110, 164.8, 220].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = index % 2 ? "sine" : "triangle"
      oscillator.frequency.value = frequency
      const gain = context.createGain()
      gain.gain.value = 0.42 / (index + 1.4)
      oscillator.connect(gain)
      gain.connect(lowpass)
      oscillator.start()
      const drift = context.createOscillator()
      drift.frequency.value = 0.03 + index * 0.017
      const depth = context.createGain()
      depth.gain.value = 0.18 / (index + 1.4)
      drift.connect(depth)
      depth.connect(gain.gain)
      drift.start()
    })

    // ventilation hiss
    const noiseBuffer = context.createBuffer(
      1,
      context.sampleRate * 3,
      context.sampleRate,
    )
    const data = noiseBuffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.035 * white) / 1.035
      data[i] = last * 3.2
    }
    const noise = context.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true
    const airFilter = context.createBiquadFilter()
    airFilter.type = "bandpass"
    airFilter.frequency.value = 620
    airFilter.Q.value = 0.5
    const airGain = context.createGain()
    airGain.gain.value = 0.5
    noise.connect(airFilter)
    airFilter.connect(airGain)
    airGain.connect(output)
    noise.start()

    // fluorescent buzz, gently amplitude modulated
    const buzz = context.createOscillator()
    buzz.type = "square"
    buzz.frequency.value = 100
    const buzzGain = context.createGain()
    buzzGain.gain.value = 0.012
    const buzzFilter = context.createBiquadFilter()
    buzzFilter.type = "lowpass"
    buzzFilter.frequency.value = 900
    buzz.connect(buzzFilter)
    buzzFilter.connect(buzzGain)
    buzzGain.connect(output)
    buzz.start()
    const wobble = context.createOscillator()
    wobble.frequency.value = 0.27
    const wobbleDepth = context.createGain()
    wobbleDepth.gain.value = 0.008
    wobble.connect(wobbleDepth)
    wobbleDepth.connect(buzzGain.gain)
    wobble.start()

    // distant traffic under the floor plate
    const traffic = context.createOscillator()
    traffic.type = "sawtooth"
    traffic.frequency.value = 42
    const trafficGain = context.createGain()
    trafficGain.gain.value = 0.05
    const trafficFilter = context.createBiquadFilter()
    trafficFilter.type = "lowpass"
    trafficFilter.frequency.value = 150
    traffic.connect(trafficFilter)
    trafficFilter.connect(trafficGain)
    trafficGain.connect(output)
    traffic.start()
    const sweep = context.createOscillator()
    sweep.frequency.value = 0.08
    const sweepDepth = context.createGain()
    sweepDepth.gain.value = 0.035
    sweep.connect(sweepDepth)
    sweepDepth.connect(trafficGain.gain)
    sweep.start()

    // keyboards down the aisle
    typingTimer.current = window.setInterval(() => {
      if (context.state !== "running") return
      const burst = 3 + Math.floor(Math.random() * 7)
      for (let i = 0; i < burst; i++) {
        const key = context.createOscillator()
        key.type = "square"
        key.frequency.value = 1400 + Math.random() * 2600
        const filter = context.createBiquadFilter()
        filter.type = "bandpass"
        filter.frequency.value = 1800 + Math.random() * 2200
        filter.Q.value = 3
        const gain = context.createGain()
        const at = context.currentTime + i * (0.05 + Math.random() * 0.09)
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(
          0.012 + Math.random() * 0.01,
          at + 0.004,
        )
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
        key.connect(filter)
        filter.connect(gain)
        gain.connect(output)
        key.start(at)
        key.stop(at + 0.06)
      }
    }, 4200)
  }

  const toggleSound = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      if (!audio.current) {
        const context = new AudioContext()
        audio.current = context
        const volume = context.createGain()
        volume.gain.value = 0.06
        volume.connect(context.destination)
        bus.current = volume
        buildAmbience(context, volume)
      }
      if (soundOn) {
        await audio.current.suspend()
        setSoundOn(false)
      } else {
        await audio.current.resume()
        setSoundOn(audio.current.state === "running")
      }
    } catch {
      setError("Ambient sound is unavailable in this browser.")
      setSoundOn(false)
      await audio.current?.close().catch(() => {})
      audio.current = null
    } finally {
      setBusy(false)
    }
  }, [busy, soundOn])

  const play = useCallback((cue: SceneCue) => {
    const context = audio.current
    const output = bus.current
    if (!context || !output || context.state !== "running") return
    const now = context.currentTime

    const blip = (
      frequency: number,
      duration: number,
      type: OscillatorType,
      volume: number,
      slide = 0,
    ) => {
      const oscillator = context.createOscillator()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, now)
      if (slide)
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * slide,
          now + duration,
        )
      const gain = context.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain)
      gain.connect(output)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.02)
    }

    const thump = (
      cutoff: number,
      duration: number,
      volume: number,
      pitch: number,
    ) => {
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      )
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.4)
      }
      const source = context.createBufferSource()
      source.buffer = buffer
      const filter = context.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.setValueAtTime(cutoff, now)
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(90, cutoff * 0.28),
        now + duration,
      )
      filter.Q.value = 1.1
      const gain = context.createGain()
      gain.gain.setValueAtTime(volume, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(output)
      source.start(now)
      // a little body under the tap
      const body = context.createOscillator()
      body.type = "sine"
      body.frequency.setValueAtTime(pitch, now)
      body.frequency.exponentialRampToValueAtTime(
        pitch * 0.55,
        now + duration * 0.8,
      )
      const bodyGain = context.createGain()
      bodyGain.gain.setValueAtTime(volume * 0.55, now)
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.9)
      body.connect(bodyGain)
      bodyGain.connect(output)
      body.start(now)
      body.stop(now + duration)
    }

    if (cue === "step") thump(1500, 0.16, 0.07, 130)
    else if (cue === "run") thump(1200, 0.2, 0.1, 110)
    else if (cue === "land") thump(700, 0.3, 0.12, 90)
    else if (cue === "click") blip(1180, 0.06, "square", 0.05, 0.7)
    else if (cue === "enter") {
      blip(220, 0.34, "sine", 0.09, 2.4)
      thump(900, 0.3, 0.05, 120)
    } else if (cue === "exit") blip(660, 0.26, "sine", 0.07, 0.45)
    else if (cue === "sector") {
      blip(440, 0.5, "sine", 0.06, 2.2)
      thump(2200, 0.4, 0.04, 160)
    } else if (cue === "cheer") {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        oscillator.type = "triangle"
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.055)
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.08,
          now + index * 0.055 + 0.14,
        )
        const gain = context.createGain()
        gain.gain.setValueAtTime(0.0001, now + index * 0.055)
        gain.gain.exponentialRampToValueAtTime(0.15, now + index * 0.055 + 0.02)
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + index * 0.055 + 0.26,
        )
        oscillator.connect(gain)
        gain.connect(output)
        oscillator.start(now + index * 0.055)
        oscillator.stop(now + index * 0.055 + 0.3)
      })
      thump(2600, 0.22, 0.06, 180)
    }
  }, [])

  return { soundOn, busy, error, toggleSound, play }
}
