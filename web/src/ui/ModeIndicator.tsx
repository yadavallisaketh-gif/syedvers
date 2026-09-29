import { fmt } from '../sim/format'
import { MODE_DR } from '../sim/types'
import { cx } from './controls'
import { useCurrentSample } from './useCurrentSample'

type State = 'gnss' | 'confirming' | 'dr'

const COPY: Record<State, { label: string; detail: (timeout: number) => string }> = {
  gnss: { label: 'GNSS + INS', detail: () => 'GNSS + inertial fusion' },
  confirming: { label: 'GNSS lost · confirming', detail: (s) => `no fix for < ${fmt(s, 1)} s yet` },
  dr: { label: 'Dead reckoning', detail: () => 'phone IMU + MotionNet + NHC + road proxy only' },
}

/** Status icon: shape carries the state as well as colour (nominal ■ grey, confirming □, DR ■ + bar). */
function StatusIcon({ state }: { state: State }) {
  if (state === 'gnss') return <span aria-hidden className="size-2 shrink-0 rounded-[1px] bg-zinc-400" />
  if (state === 'confirming') return <span aria-hidden className="size-2 shrink-0 rounded-[1px] border border-degraded" />
  return (
    <span aria-hidden className="relative size-2 shrink-0 rounded-[1px] bg-degraded">
      <span className="absolute inset-x-[3px] top-px h-[3px] bg-panel" />
    </span>
  )
}

export function ModeIndicator() {
  const { replay, t, i } = useCurrentSample()
  if (!replay) return <div className="h-[60px] border-t border-white/[0.07]" />
  const c = replay.columns
  const state: State = c.mode[i] === MODE_DR ? 'dr' : c.denied[i] ? 'confirming' : 'gnss'
  const dur = replay.durationS
  const phase =
    t < 0
      ? `${fmt(-t, 1)} s to GNSS loss`
      : t <= dur
        ? `${fmt(t, 1)} of ${fmt(dur, 0)} s blackout`
        : `${fmt(t - dur, 1)} s after GNSS returned`
  const progress = Math.min(Math.max(t / dur, 0), 1)

  return (
    <section aria-label="Navigation mode" aria-live="polite" className="border-t border-white/[0.07] px-3 pt-2.5 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <StatusIcon state={state} />
          <span className={cx('truncate text-[14px] font-semibold tracking-tight', state === 'gnss' ? 'text-zinc-200' : 'text-zinc-100')}>
            {COPY[state].label}
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums">{phase}</span>
      </div>
      <p className="mt-1 truncate text-[11px] text-zinc-500" title={`Engine mode: ${replay.modes[c.mode[i]] ?? ''}`}>
        {COPY[state].detail(replay.profile.gnssTimeoutS)}
      </p>
      <div className="mt-2 h-[2px] w-full bg-white/[0.06]" role="presentation">
        <div
          className={cx('h-full', t >= 0 && t <= dur ? 'bg-degraded' : 'bg-zinc-600')}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </section>
  )
}
