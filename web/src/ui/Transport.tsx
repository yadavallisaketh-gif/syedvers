import { fmtRelT } from '../sim/format'
import { replaySpan } from '../sim/sampling'
import { SPEEDS, type Speed, useSim } from '../sim/store'
import { SCRUB_STEP_FAST_S, SCRUB_STEP_S } from '../sim/useHotkeys'
import { Button, Kbd, SegmentedControl } from './controls'

export function Transport() {
  const replay = useSim((s) => s.replay)
  const t = useSim((s) => s.t)
  const playing = useSim((s) => s.playing)
  const speed = useSim((s) => s.speed)
  const { togglePlay, seek, pause, setSpeed } = useSim.getState()

  const [start, end] = replay ? replaySpan(replay) : [0, 1]
  const span = end - start || 1
  const pct = (v: number) => `${((Math.min(Math.max(v, start), end) - start) / span) * 100}%`
  const dur = replay?.durationS ?? 0

  return (
    <section aria-label="Playback" className="border-t border-white/[0.07] px-3 pt-2.5 pb-2">
      <div className="flex items-center gap-1.5">
        <Button
          variant="primary"
          className="w-[84px] justify-between"
          onClick={togglePlay}
          disabled={!replay}
          aria-keyshortcuts="Space"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <span className="flex items-center gap-1.5">
            {playing ? (
              <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                <path d="M2 1.5h2v7H2zM6 1.5h2v7H6z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                <path d="M2.5 1.2v7.6L8.8 5z" fill="currentColor" />
              </svg>
            )}
            {playing ? 'Pause' : 'Play'}
          </span>
          <Kbd className="border-zinc-900/20 bg-zinc-900/5 text-zinc-600">␣</Kbd>
        </Button>
        <Button
          onClick={() => {
            pause()
            seek(start)
          }}
          disabled={!replay}
          aria-label="Restart replay"
          title="Restart"
        >
          <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
            <path d="M2 1.5v7M8.5 1.5 3.5 5l5 3.5z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
          </svg>
        </Button>
        <SegmentedControl<Speed>
          label="Replay speed"
          className="ml-auto w-[152px]"
          value={speed}
          onChange={setSpeed}
          options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))}
        />
      </div>

      <div className="mt-2.5">
        <div className="relative h-5">
          {/* track, blackout band, progress */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-[1px] bg-white/[0.07]" />
          {replay && (
            <>
              <div
                className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 bg-degraded/45"
                style={{ left: pct(0), width: `calc(${pct(dur)} - ${pct(0)})` }}
              />
              <div className="pointer-events-none absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-zinc-400/50" style={{ width: pct(t) }} />
            </>
          )}
          <input
            type="range"
            className="scrubber absolute inset-0"
            min={start}
            max={end}
            step={0.1}
            value={t}
            disabled={!replay}
            aria-label="Replay time"
            aria-valuetext={`${fmtRelT(t)} seconds relative to GNSS loss`}
            aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight"
            onChange={(e) => {
              pause()
              seek(Number.parseFloat(e.target.value))
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 tabular-nums">
          <span>{fmtRelT(start)} s</span>
          <span className="flex items-center gap-1 text-zinc-500">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <span>{SCRUB_STEP_S} s</span>
            <Kbd className="ml-1">⇧</Kbd>
            <span>{SCRUB_STEP_FAST_S} s</span>
          </span>
          <span className="font-medium text-zinc-300">{fmtRelT(t)} s</span>
        </div>
      </div>
    </section>
  )
}
