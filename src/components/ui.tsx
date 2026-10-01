import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

/* ---------- Buttons ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variantClass: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-stone-700 disabled:bg-stone-400',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 disabled:text-stone-400',
  danger: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-red-300',
}
const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  )
}

/* ---------- Form fields ---------- */

const fieldClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:bg-stone-100'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, 'min-h-24 resize-y leading-relaxed', className)} {...props} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, 'h-10 pr-8', className)} {...props} />
}

/* ---------- Surfaces ---------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      {children}
    </section>
  )
}

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
      </div>
      {action}
    </header>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'muted'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    accent: 'bg-accent-soft text-accent-strong',
    success: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    muted: 'bg-stone-100 text-stone-500 line-through',
  }
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tones[tone])}>
      {children}
    </span>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 px-6 py-12 text-center">
      <p className="text-sm font-medium text-stone-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx('inline-block size-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700', className)}
      role="status"
      aria-label="A carregar"
    />
  )
}

export function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6">{children}</div>
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-stone-200 font-semibold text-stone-700',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs',
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}

/** Error message from Supabase / unknown. */
export function errorMessage(e: unknown): string {
  if (!e) return ''
  if (typeof e === 'string') return e
  if (typeof e === 'object' && e && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return 'Ocorreu um erro inesperado.'
}
