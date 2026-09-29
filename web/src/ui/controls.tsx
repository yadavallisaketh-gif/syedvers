import type { ButtonHTMLAttributes, ReactNode } from 'react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Mouse clicks shouldn't park keyboard focus on a control (Space would re-trigger it instead of play/pause). */
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-[2px] border border-white/10 bg-white/[0.03] px-1 font-mono text-[10px] leading-none text-zinc-500',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' }

export function Button({ variant = 'default', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      className={cx(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border px-2.5 text-[12px] font-medium tracking-tight transition-colors',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-zinc-400',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary'
          ? 'border-zinc-300 bg-zinc-200 text-zinc-900 hover:bg-zinc-100'
          : 'border-white/10 bg-raised text-zinc-200 hover:border-white/15 hover:bg-white/[0.07]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

interface SegmentOption<T extends string | number> {
  value: T
  label: ReactNode
  hint?: string
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex h-7 rounded-sm border border-white/10 bg-surface p-px', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-keyshortcuts={o.hint}
            onMouseDown={keepFocus}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[1px] px-2 text-[12px] font-medium tracking-tight transition-colors',
              'focus-visible:outline focus-visible:outline-1 focus-visible:outline-zinc-400',
              active ? 'bg-raised text-zinc-100 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]' : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.hint && <Kbd className={active ? 'text-zinc-400' : undefined}>{o.hint}</Kbd>}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  swatch,
}: {
  checked: boolean
  onChange: () => void
  label: string
  swatch?: ReactNode
}) {
  return (
    <label className="group flex h-6 cursor-pointer items-center gap-2 text-[12px] text-zinc-300 select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden
        className={cx(
          'flex size-3 shrink-0 items-center justify-center rounded-[2px] border transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-zinc-400',
          checked ? 'border-zinc-300 bg-zinc-300' : 'border-white/25 group-hover:border-white/40',
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-2.5 text-zinc-900">
            <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </span>
      {swatch}
      <span className={cx('truncate tracking-tight', !checked && 'text-zinc-500')}>{label}</span>
    </label>
  )
}

export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full cursor-pointer appearance-none rounded-sm border border-white/10 bg-raised pr-7 pl-2 text-[12px] tracking-tight text-zinc-200 tabular-nums hover:border-white/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
      >
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-zinc-500">
        <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </div>
  )
}

export { cx }
