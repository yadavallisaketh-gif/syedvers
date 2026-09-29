import type { Camera } from 'three'
import { Vector3 } from 'three'

/*
 * In-scene text labels without extra React roots: the label elements are plain DOM rendered by
 * <SceneLabels> (in the main tree, over the canvas), and scene components move them each frame by
 * projecting a world-space anchor through the camera (view offset included).
 */

export type LabelId = 'tether' | 'gnssLost' | 'gnssBack'

// tether text sits on its dimension line (drawing convention); markers label up-left of their post
const ALIGN: Record<LabelId, string> = {
  tether: 'translate(-50%, -50%)',
  gnssLost: 'translate(calc(-100% - 4px), calc(-100% - 4px))',
  gnssBack: 'translate(calc(-100% - 4px), calc(-100% - 4px))',
}

const els: Partial<Record<LabelId, HTMLDivElement | null>> = {}
const scratch = new Vector3()

export function hideLabel(id: LabelId) {
  const el = els[id]
  if (el) el.style.visibility = 'hidden'
}

export function placeLabel(
  id: LabelId,
  world: { x: number; y: number; z: number },
  camera: Camera,
  size: { width: number; height: number },
  text?: string,
) {
  const el = els[id]
  if (!el) return
  scratch.set(world.x, world.y, world.z).project(camera)
  const behind = scratch.z > 1 || scratch.z < -1
  el.style.visibility = behind ? 'hidden' : 'visible'
  if (behind) return
  const x = ((scratch.x + 1) / 2) * size.width
  const y = ((1 - scratch.y) / 2) * size.height
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${ALIGN[id]}`
  if (text !== undefined && el.textContent !== text) el.textContent = text
}

const LABELS: { id: LabelId; className: string; text: string }[] = [
  {
    id: 'tether',
    className: 'rounded-sm border border-white/10 bg-panel/90 px-1.5 py-px text-[11px] font-medium text-zinc-200 tabular-nums',
    text: '',
  },
  {
    id: 'gnssLost',
    className: 'rounded-sm border border-white/10 bg-panel/85 px-1.5 py-px text-[10px] font-medium tracking-tight text-zinc-400',
    text: 'GNSS lost',
  },
  {
    id: 'gnssBack',
    className: 'rounded-sm border border-white/10 bg-panel/85 px-1.5 py-px text-[10px] font-medium tracking-tight text-zinc-400',
    text: 'GNSS back',
  },
]

/** DOM layer for the labels; render it next to the <Canvas>, inside the same positioned box. */
export function SceneLabels() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {LABELS.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            els[l.id] = el
          }}
          className={`absolute top-0 left-0 whitespace-nowrap will-change-transform ${l.className}`}
          style={{ visibility: 'hidden' }}
        >
          {l.text}
        </div>
      ))}
    </div>
  )
}
