import { create } from 'zustand'

import { MissingDataError, loadIndex, loadReplay, loadVerified } from './loader'
import { replaySpan } from './sampling'
import { makeSyntheticReplay } from './synthetic'
import type { Replay, ReplayIndex, Verified } from './types'

/**
 * Replay time lives in two places on purpose:
 * - `clock.t` is mutable and advanced every animation frame; the 3D scene reads it directly.
 * - `useSim().t` is a React-state copy, refreshed at UI_HZ while playing and immediately on seek,
 *   so the DOM panel doesn't re-render at display refresh rate.
 */
export const clock = { t: 0 }
export const UI_HZ = 20

export type CameraMode = 'chase' | 'orbit' | 'plan'
export const CAMERA_MODES: { id: CameraMode; label: string; key: string }[] = [
  { id: 'chase', label: 'Chase', key: '1' },
  { id: 'orbit', label: 'Orbit', key: '2' },
  { id: 'plan', label: 'Top-down', key: '3' },
]

export const SPEEDS = [1, 2, 5, 10] as const
export type Speed = (typeof SPEEDS)[number]

export interface Layers {
  ghost: boolean
  tether: boolean
  uncertainty: boolean
  route: boolean
  grid: boolean
}

type Status = 'loading' | 'ready' | 'error'

interface SimState {
  index: ReplayIndex | null
  verified: Verified | null
  replay: Replay | null
  replayId: string | null
  status: Status
  error: string | null

  t: number
  playing: boolean
  speed: Speed
  camera: CameraMode
  layers: Layers
  /** px of the right-hand panel overlapping the canvas (0 when the panel is stacked below it) */
  panelInset: number

  init: () => Promise<void>
  selectReplay: (id: string) => Promise<void>
  togglePlay: () => void
  pause: () => void
  seek: (t: number) => void
  nudge: (dt: number) => void
  syncT: (t: number) => void
  setSpeed: (s: Speed) => void
  setCamera: (c: CameraMode) => void
  toggleLayer: (k: keyof Layers) => void
  setPanelInset: (px: number) => void
}

function clampToReplay(r: Replay | null, t: number) {
  if (!r) return t
  const [a, b] = replaySpan(r)
  return Math.min(Math.max(t, a), b)
}

/** Deep-link parameters: ?replay=S1_1230&t=42&cam=plan */
function urlParams() {
  const p = new URLSearchParams(window.location.search)
  const t = Number.parseFloat(p.get('t') ?? '')
  const cam = p.get('cam')
  return {
    replay: p.get('replay'),
    t: Number.isFinite(t) ? t : null,
    camera: CAMERA_MODES.some((m) => m.id === cam) ? (cam as CameraMode) : null,
  }
}

export const useSim = create<SimState>((set, get) => ({
  index: null,
  verified: null,
  replay: null,
  replayId: null,
  status: 'loading',
  error: null,

  t: 0,
  playing: false,
  speed: 2,
  camera: 'chase',
  layers: { ghost: true, tether: true, uncertainty: true, route: true, grid: true },
  panelInset: 0,

  init: async () => {
    const params = urlParams()
    if (params.camera) set({ camera: params.camera })
    const [index, verified] = await Promise.allSettled([loadIndex(), loadVerified()])
    if (verified.status === 'fulfilled') set({ verified: verified.value })
    else if (!(verified.reason instanceof MissingDataError)) set({ error: String(verified.reason) })

    if (index.status === 'rejected') {
      if (!(index.reason instanceof MissingDataError)) {
        set({ status: 'error', error: String(index.reason) })
        return
      }
      // No exported engine replays: run on the labelled synthetic placeholder.
      const replay = makeSyntheticReplay()
      const t = clampToReplay(replay, params.t ?? replay.columns.relT[0])
      clock.t = t
      set({ replay, replayId: replay.id, status: 'ready', t })
      return
    }
    set({ index: index.value })
    const wanted = index.value.replays.some((r) => r.id === params.replay) ? params.replay! : index.value.defaultId
    await get().selectReplay(wanted)
    if (params.t !== null) get().seek(params.t)
  },

  selectReplay: async (id) => {
    const entry = get().index?.replays.find((r) => r.id === id)
    if (!entry) return
    set({ replayId: id, status: 'loading', playing: false })
    try {
      const replay = await loadReplay(entry.file)
      if (get().replayId !== id) return // a newer selection won
      const t = replay.columns.relT[0]
      clock.t = t
      set({ replay, status: 'ready', t, error: null })
    } catch (e) {
      if (get().replayId === id) set({ status: 'error', error: String(e) })
    }
  },

  togglePlay: () => {
    const { replay, playing } = get()
    if (!replay) return
    if (!playing) {
      const [a, b] = replaySpan(replay)
      if (clock.t >= b - 1e-3) get().seek(a) // play from the end restarts
    }
    set({ playing: !playing, t: clock.t })
  },
  pause: () => set({ playing: false, t: clock.t }),

  seek: (t) => {
    const c = clampToReplay(get().replay, t)
    clock.t = c
    set({ t: c })
  },
  nudge: (dt) => get().seek(clock.t + dt),
  syncT: (t) => set({ t }),

  setSpeed: (speed) => set({ speed }),
  setCamera: (camera) => set({ camera }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setPanelInset: (panelInset) => set({ panelInset }),
}))
