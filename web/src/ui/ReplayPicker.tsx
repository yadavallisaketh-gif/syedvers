import { fmt } from '../sim/format'
import { useSim } from '../sim/store'
import { SegmentedControl, Select } from './controls'
import { Section } from './layout'

export function ReplayPicker() {
  const index = useSim((s) => s.index)
  const replayId = useSim((s) => s.replayId)
  const replay = useSim((s) => s.replay)
  const verified = useSim((s) => s.verified)
  const { selectReplay } = useSim.getState()

  const current = index?.replays.find((r) => r.id === replayId)
  const drives = index ? [...new Set(index.replays.map((r) => r.drive))] : []
  const windows = index?.replays.filter((r) => r.drive === current?.drive).sort((a, b) => a.tStart - b.tStart) ?? []
  const s60 = verified?.summary.find((s) => s.durationS === 60)

  return (
    <Section title="Replay · held-out test drives">
      {index && current ? (
        <div className="grid grid-cols-[88px_1fr] gap-1.5">
          <SegmentedControl<string>
            label="Test drive"
            value={current.drive}
            onChange={(d) => {
              const pick = index.replays.find((r) => r.drive === d && r.median) ?? index.replays.find((r) => r.drive === d)
              if (pick) void selectReplay(pick.id)
            }}
            options={drives.map((d) => ({ value: d, label: d }))}
          />
          <Select label="60 s blackout window" value={current.id} onChange={(id) => void selectReplay(id)}>
            {windows.map((w) => (
              <option key={w.id} value={w.id}>
                {`t = ${w.tStart.toFixed(0)} s · drift ${fmt(w.driftPct, 1)} %${w.median ? ' · median' : ''}`}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {replay?.source === 'synthetic' ? (
            <>
              No engine replays in <code className="font-mono text-zinc-400">web/public/data</code>. Showing a synthetic
              placeholder. Generate the real ones with <code className="font-mono text-zinc-400">python scripts/export_web_data.py</code>.
            </>
          ) : (
            'Loading replay index…'
          )}
        </p>
      )}

      {verified && s60 && (
        <dl className="mt-2.5 grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 gap-y-0.5 border-t border-white/[0.06] pt-2 text-[11px] tabular-nums">
          <dt className="text-zinc-500">Median drift, {s60.windows} windows</dt>
          {verified.summary.map((s) => (
            <dd key={s.durationS} className="text-right text-zinc-500">
              {s.durationS.toFixed(0)} s
            </dd>
          ))}
          <dt className="text-zinc-300">IDR engine (variant {verified.variant})</dt>
          {verified.summary.map((s) => (
            <dd key={s.durationS} className={s.durationS === 60 ? 'text-right font-semibold text-zinc-100' : 'text-right text-zinc-300'}>
              {fmt(s.medianDriftPct, 1)} %
            </dd>
          ))}
          <dt className="text-zinc-500">Raw inertial baseline</dt>
          {verified.summary.map((s) => (
            <dd key={s.durationS} className="text-right text-zinc-500">
              {fmt(s.rawInsMedianDriftPct, 0)} %
            </dd>
          ))}
          <dd className="col-span-4 mt-1 text-zinc-500">
            Only 60 s meets the &lt; 10 % target. Test drives {verified.testDrives.join(' + ')} were held out of training.
          </dd>
        </dl>
      )}
    </Section>
  )
}
