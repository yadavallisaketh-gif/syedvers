import { useSim } from '../sim/store'
import { cx } from './controls'

export function PanelHeader() {
  const replay = useSim((s) => s.replay)
  const synthetic = replay?.source === 'synthetic'
  return (
    <header className="flex items-start justify-between gap-3 px-3 pt-2.5 pb-2">
      <div className="min-w-0">
        <h1 className="flex items-baseline gap-2 text-[13px] font-semibold tracking-tight text-zinc-100">
          IDR Engine
          <span className="text-[11px] font-medium text-zinc-500">SIH26168 · blackout replay</span>
        </h1>
        <p className="mt-0.5 truncate text-[11px] tracking-tight text-zinc-500 tabular-nums">
          {replay
            ? synthetic
              ? 'Synthetic placeholder · no engine export found'
              : `Drive ${replay.drive} · ${replay.durationS.toFixed(0)} s blackout at t = ${replay.tStart.toFixed(0)} s · variant ${replay.profile.variant}`
            : 'Loading replay…'}
        </p>
      </div>
      {replay && (
        <span
          title={
            synthetic
              ? 'Placeholder data generated in the browser. Run python scripts/export_web_data.py for engine replays.'
              : 'Every sample is output of the navigation engine (src/ui/sim.py → scripts/export_web_data.py).'
          }
          className={cx(
            'mt-px shrink-0 rounded-sm border px-1.5 py-px font-mono text-[10px] leading-4 tracking-wide',
            synthetic ? 'border-degraded/60 text-[#d7998d]' : 'border-white/15 text-zinc-400',
          )}
        >
          {synthetic ? 'SYNTHETIC' : 'ENGINE'}
        </span>
      )}
    </header>
  )
}
