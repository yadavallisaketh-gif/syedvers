import { useEffect } from 'react'

import { CAMERA_MODES, useSim } from './store'

export const SCRUB_STEP_S = 1
export const SCRUB_STEP_FAST_S = 5

/**
 * Global keys: Space play/pause · ←/→ scrub 1 s (Shift: 5 s) · 1/2/3 camera mode.
 * Keys are left alone while a text field or select has focus. The timeline slider is driven by
 * these keys too, so arrows step the same everywhere. Space is left to a focused button so
 * Tab + Space still activates it.
 */
export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target instanceof HTMLElement ? e.target : null
      const tag = el?.tagName
      const isRange = el instanceof HTMLInputElement && el.type === 'range'
      if ((tag === 'INPUT' && !isRange) || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      const s = useSim.getState()

      if (e.code === 'Space') {
        if (tag === 'BUTTON') return
        e.preventDefault()
        s.togglePlay()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.shiftKey ? SCRUB_STEP_FAST_S : SCRUB_STEP_S
        s.pause()
        s.nudge(e.key === 'ArrowLeft' ? -step : step)
      } else if (!e.shiftKey) {
        const mode = CAMERA_MODES.find((m) => m.key === e.key)
        if (mode) {
          e.preventDefault()
          s.setCamera(mode.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
