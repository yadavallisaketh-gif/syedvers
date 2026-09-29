import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { KMH, fmt, fmtRelT } from '../sim/format'
import { replaySpan, sampleIndex } from '../sim/sampling'
import { useSim } from '../sim/store'
import type { Replay } from '../sim/types'
import { Section, Swatch } from './layout'
import { COLORS } from './tokens'

const H = 116
const M = { l: 26, r: 4, t: 6, b: 16 }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceStep(max: number) {
  for (const s of [10, 20, 25, 50, 100]) if (max / s <= 4) return s
  return 200
}

function buildChart(r: Replay, width: number) {
  const c = r.columns
  const [t0, t1] = replaySpan(r)
  let vmax = 0
  for (const col of [c.truthSpeed, c.vF, c.mnSpeed]) {
    for (let i = 0; i < col.length; i++) if (Number.isFinite(col[i])) vmax = Math.max(vmax, col[i] * KMH)
  }
  const step = niceStep(vmax * 1.1)
  const ymax = Math.max(step, Math.ceil((vmax * 1.08) / step) * step)
  const iw = Math.max(width - M.l - M.r, 10)
  const ih = H - M.t - M.b
  const x = (t: number) => M.l + ((t - t0) / (t1 - t0)) * iw
  const y = (v: number) => M.t + ih - (v / ymax) * ih

  const line = (col: Float64Array) => {
    let d = ''
    let pen = false
    for (let i = 0; i < col.length; i++) {
      const v = col[i]
      if (!Number.isFinite(v)) {
        pen = false
        continue
      }
      d += `${pen ? 'L' : 'M'}${x(c.relT[i]).toFixed(1)} ${y(v * KMH).toFixed(1)}`
      pen = true
    }
    return d
  }
  let dots = ''
  for (let i = 0; i < c.mnSpeed.length; i += 2) {
    const v = c.mnSpeed[i]
    if (Number.isFinite(v)) dots += `M${x(c.relT[i]).toFixed(1)} ${y(v * KMH).toFixed(1)}h0`
  }
  const yTicks = Array.from({ length: Math.floor(ymax / step) + 1 }, (_, k) => k * step)
  const xTicks: number[] = []
  for (let t = Math.ceil(t0 / 20) * 20; t <= t1; t += 20) xTicks.push(t)
  return { t0, t1, x, y, iw, ih, truth: line(c.truthSpeed), vf: line(c.vF), dots, yTicks, xTicks }
}

export function SpeedTrace() {
  const replay = useSim((s) => s.replay)
  const t = useSim((s) => s.t)
  const [ref, width] = useWidth<HTMLDivElement>()
  const clipId = `speed-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [hover, setHover] = useState<number | null>(null)
  const chart = useMemo(() => (replay && width > 0 ? buildChart(replay, width) : null), [replay, width])

  const legend = (
    <span className="flex items-center gap-2.5 text-[10px] text-zinc-400">
      <span className="flex items-center gap-1">
        <Swatch color={COLORS.truth} kind="line" />
        Truth
      </span>
      <span className="flex items-center gap-1">
        <Swatch color={COLORS.estimate} kind="line" />
        EKF v_f
      </span>
      <span className="flex items-center gap-1">
        <Swatch color={COLORS.motionnet} kind="dot" />
        MotionNet
      </span>
    </span>
  )

  const hoverAt = (clientX: number, el: SVGSVGElement) => {
    if (!chart) return null
    const rect = el.getBoundingClientRect()
    const px = clientX - rect.left
    const tt = chart.t0 + ((px - M.l) / chart.iw) * (chart.t1 - chart.t0)
    return Math.min(Math.max(tt, chart.t0), chart.t1)
  }

  const hi = replay && hover !== null ? sampleIndex(replay.columns.relT, hover) : null
  const cols = replay?.columns

  return (
    <Section title="Speed · km/h" aside={legend}>
      <div ref={ref} className="relative">
        {chart && replay && cols && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Speed over the replay in km/h: ground truth, EKF forward velocity and MotionNet output. Blackout from 0 to ${replay.durationS} s.`}
            className="block cursor-crosshair touch-none select-none"
            onPointerMove={(e) => setHover(hoverAt(e.clientX, e.currentTarget))}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => {
              const tt = hoverAt(e.clientX, e.currentTarget)
              if (tt === null) return
              const s = useSim.getState()
              s.pause()
              s.seek(tt)
            }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={M.l - 2} y={0} width={Math.max(chart.x(t) - M.l + 2, 0)} height={H} />
              </clipPath>
            </defs>
            {/* blackout band */}
            <rect
              x={chart.x(0)}
              y={M.t}
              width={chart.x(replay.durationS) - chart.x(0)}
              height={chart.ih}
              fill={COLORS.degraded}
              opacity={0.1}
            />
            <text x={chart.x(0) + 3} y={M.t + 9} className="fill-zinc-500 text-[9px]">
              GNSS denied
            </text>
            {/* grid + axes (recessive) */}
            {chart.yTicks.map((v) => (
              <g key={v}>
                <line x1={M.l} x2={width - M.r} y1={chart.y(v)} y2={chart.y(v)} stroke="rgb(255 255 255 / 0.06)" />
                <text x={M.l - 5} y={chart.y(v) + 3} textAnchor="end" className="fill-zinc-500 text-[9px] tabular-nums">
                  {v}
                </text>
              </g>
            ))}
            {chart.xTicks.map((v) => (
              <text key={v} x={chart.x(v)} y={H - 4} textAnchor="middle" className="fill-zinc-500 text-[9px] tabular-nums">
                {v > 0 ? `+${v}` : v}
              </text>
            ))}
            {/* series, revealed up to the playhead */}
            <g clipPath={`url(#${clipId})`} fill="none" strokeLinejoin="round">
              <path d={chart.truth} stroke={COLORS.truth} strokeWidth={2} />
              <path d={chart.vf} stroke={COLORS.estimate} strokeWidth={1.5} />
              <path d={chart.dots} stroke={COLORS.motionnet} strokeWidth={3} strokeLinecap="round" />
            </g>
            {/* playhead */}
            <line x1={chart.x(t)} x2={chart.x(t)} y1={M.t} y2={M.t + chart.ih} stroke="#d4d4d8" strokeWidth={1} />
            {hover !== null && (
              <line
                x1={chart.x(hover)}
                x2={chart.x(hover)}
                y1={M.t}
                y2={M.t + chart.ih}
                stroke="#71717a"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
          </svg>
        )}
        {chart && cols && hover !== null && hi !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[120px] rounded-sm border border-white/10 bg-raised/95 px-2 py-1.5 text-[11px] text-zinc-300 tabular-nums"
            style={
              chart.x(hover) > width / 2
                ? { right: width - chart.x(hover) + 8 }
                : { left: chart.x(hover) + 8 }
            }
          >
            <div className="mb-1 text-zinc-500">{fmtRelT(cols.relT[hi])} s · click to seek</div>
            {[
              { label: 'Truth', v: cols.truthSpeed[hi], color: COLORS.truth, kind: 'line' as const },
              { label: 'EKF v_f', v: cols.vF[hi], color: COLORS.estimate, kind: 'line' as const },
              { label: 'MotionNet', v: cols.mnSpeed[hi], color: COLORS.motionnet, kind: 'dot' as const },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <Swatch color={row.color} kind={row.kind} />
                  {row.label}
                </span>
                <span className="text-zinc-100">{Number.isFinite(row.v) ? fmt(row.v * KMH, 1) : 'idle'}</span>
              </div>
            ))}
          </div>
        )}
        {!chart && <div style={{ height: H }} />}
      </div>
    </Section>
  )
}
