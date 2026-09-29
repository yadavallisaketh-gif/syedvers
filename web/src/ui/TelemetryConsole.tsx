import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { fmtStamp } from '../sim/format'
import { countUpTo } from '../sim/sampling'
import { useSim } from '../sim/store'
import { type LogKind, buildTelemetry } from '../sim/telemetry'
import { cx } from './controls'

const MAX_LINES = 250

const KIND_CLASS: Record<LogKind, string> = {
  SYS: 'text-zinc-400',
  EVT: 'text-zinc-300',
  MODE: 'text-zinc-300',
  ANOM: 'text-zinc-300',
  REJ: 'text-zinc-400',
  UPD: 'text-zinc-500',
  EKF: 'text-zinc-500',
  MNET: 'text-zinc-500',
  DRIFT: 'text-zinc-400',
}

/**
 * Raw diagnostic feed: filter state, mode changes, every EKF measurement update (summarised per
 * second) and every chi-square rejection, streamed as the replay advances. It follows the tail
 * until the user scrolls up, and resumes when they scroll back to the bottom.
 */
export function TelemetryConsole({ className }: { className?: string }) {
  const replay = useSim((s) => s.replay)
  const t = useSim((s) => s.t)
  const entries = useMemo(() => (replay ? buildTelemetry(replay) : []), [replay])
  const times = useMemo(() => Float64Array.from(entries, (e) => e.t), [entries])
  const count = countUpTo(times, t + 1e-6)
  const visible = useMemo(() => entries.slice(Math.max(0, count - MAX_LINES), count), [entries, count])

  const box = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)
  useLayoutEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [visible, follow])

  return (
    <section aria-label="Telemetry console" className={cx('flex min-h-0 flex-col border-t border-white/10 bg-[#161618]', className)}>
      <header className="flex h-7 shrink-0 items-center justify-between px-3">
        <h2 className="text-[11px] font-medium tracking-tight text-zinc-500">Telemetry</h2>
        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500 tabular-nums">
          <span>{count} lines</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFollow(true)}
            className={cx('rounded-[2px] px-1', follow ? 'text-zinc-500' : 'text-zinc-300 hover:bg-white/[0.06]')}
            title={follow ? 'Following the latest line' : 'Scrolled up; click to follow the latest line'}
          >
            {follow ? '● tail' : '○ paused · follow'}
          </button>
        </div>
      </header>
      <div
        ref={box}
        role="log"
        aria-live="off"
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget
          setFollow(el.scrollTop + el.clientHeight >= el.scrollHeight - 6)
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 font-mono text-xs leading-[1.45] text-zinc-500 focus-visible:outline-none"
      >
        {visible.map((e, k) => (
          <div key={count - visible.length + k} className="grid grid-cols-[6ch_5ch_1fr] gap-x-2 whitespace-pre-wrap">
            <span className="text-zinc-500 tabular-nums">{fmtStamp(e.t)}</span>
            <span className={e.kind === 'REJ' || e.kind === 'ANOM' ? 'text-[#c98f84]' : KIND_CLASS[e.kind]}>{e.kind}</span>
            <span className={cx('break-words', KIND_CLASS[e.kind])}>{e.text}</span>
          </div>
        ))}
        {!replay && <div>waiting for replay…</div>}
      </div>
    </section>
  )
}
