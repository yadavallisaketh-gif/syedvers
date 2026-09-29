import type { ReactNode } from 'react'

import { cx } from './controls'

export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('border-t border-white/[0.07] px-3 py-2.5', className)} aria-label={title}>
      <header className="mb-2 flex h-4 items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium tracking-tight text-zinc-500">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

/** Square identity mark for a data series; `dashed` / `dot` variants for line-style legends. */
export function Swatch({ color, kind = 'square' }: { color: string; kind?: 'square' | 'dot' | 'dashed' | 'line' }) {
  if (kind === 'dashed') {
    return (
      <svg aria-hidden viewBox="0 0 12 6" className="h-1.5 w-3 shrink-0">
        <path d="M0 3h3M5 3h2M9 3h3" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }
  if (kind === 'line') {
    return <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
  }
  return (
    <span
      aria-hidden
      className={cx('size-1.5 shrink-0', kind === 'dot' ? 'rounded-full' : 'rounded-[1px]')}
      style={{ background: color }}
    />
  )
}

export function Readout({
  label,
  value,
  unit,
  swatch,
  title,
}: {
  label: string
  value: string
  unit?: string
  swatch?: ReactNode
  title?: string
}) {
  return (
    <div className="min-w-0" title={title}>
      <div className="flex items-center gap-1.5 text-[11px] tracking-tight text-zinc-500">
        {swatch}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-[15px] font-medium tracking-tight text-zinc-100 tabular-nums">{value}</span>
        {unit && <span className="text-[11px] text-zinc-500">{unit}</span>}
      </div>
    </div>
  )
}

export function ReadoutGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cx('grid gap-x-3 gap-y-2', cols === 3 ? 'grid-cols-3' : 'grid-cols-2')}>{children}</div>
}
