import { useLayoutEffect, useRef } from 'react'

import { useSim } from '../sim/store'
import { cx } from './controls'
import { DriftReadout } from './DriftReadout'
import { Kinematics } from './Kinematics'
import { ModeIndicator } from './ModeIndicator'
import { PanelHeader } from './PanelHeader'
import { ReplayPicker } from './ReplayPicker'
import { SceneControls } from './SceneControls'
import { SpeedTrace } from './SpeedTrace'
import { TelemetryConsole } from './TelemetryConsole'
import { Transport } from './Transport'

const OVERLAY_QUERY = '(min-width: 1024px)'
const PANEL_GAP_PX = 8

/**
 * The single control surface, docked to the right edge over the full-bleed canvas (≈25 % width).
 * Mode + transport stay pinned at the top, the telemetry console at the bottom, readouts scroll
 * between them. Below 1024 px the panel stacks under the canvas instead.
 */
export function ControlPanel() {
  const ref = useRef<HTMLElement>(null)
  const status = useSim((s) => s.status)
  const error = useSim((s) => s.error)

  // report how much of the canvas the panel covers, so the camera can centre the subject
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const mq = window.matchMedia(OVERLAY_QUERY)
    const report = () => useSim.getState().setPanelInset(mq.matches ? el.offsetWidth + PANEL_GAP_PX : 0)
    const ro = new ResizeObserver(report)
    ro.observe(el)
    mq.addEventListener('change', report)
    report()
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', report)
    }
  }, [])

  return (
    <aside
      ref={ref}
      aria-label="Replay controls and telemetry"
      className={cx(
        'relative z-10 flex flex-col overflow-hidden rounded-sm border border-white/10 bg-panel/[0.97] text-[12px] text-zinc-300',
        'lg:absolute lg:top-2 lg:right-2 lg:bottom-2 lg:w-[25%] lg:max-w-[420px] lg:min-w-[340px]',
        'max-lg:mx-2 max-lg:mt-2 max-lg:mb-2',
      )}
    >
      <div className="shrink-0">
        <PanelHeader />
        <ModeIndicator />
        <Transport />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === 'error' && error && (
          <p role="alert" className="border-t border-white/[0.07] px-3 py-2 text-[11px] text-[#d7998d]">
            {error}
          </p>
        )}
        <DriftReadout />
        <Kinematics />
        <SpeedTrace />
        <SceneControls />
        <ReplayPicker />
      </div>
      <TelemetryConsole className="h-[184px] shrink-0 max-lg:h-[220px]" />
    </aside>
  )
}
