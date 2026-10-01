import type { LogWithActor, MeetingStatus, NameRef, Role } from './types'

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const weekday = new Intl.DateTimeFormat('pt-PT', { weekday: 'short' })
const timeOnly = new Intl.DateTimeFormat('pt-PT', { timeStyle: 'short' })
const relative = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' })

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso))
/** "qui 1 out" — compact date for lists. */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${weekday.format(d).replace('-feira', '').slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export const fmtTime = (iso: string) => timeOnly.format(new Date(iso))

export function fmtRelative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return 'agora mesmo'
  if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return relative.format(Math.round(diff / 86400), 'day')
  return fmtDateTime(iso)
}

/** ISO → value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value → ISO string. */
export const fromLocalInput = (value: string) => new Date(value).toISOString()

/** Default for a new meeting: next full hour. */
export function nextFullHour(): string {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return toLocalInput(d.toISOString())
}

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  planned: 'Agendada',
  done: 'Realizada',
  cancelled: 'Cancelada',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  member: 'Membro',
  pending: 'Pendente',
}

export function displayName(ref: NameRef | { full_name: string | null; email: string } | undefined): string {
  if (!ref) return 'Alguém'
  return ref.full_name?.trim() || ref.email || 'Alguém'
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type Details = Record<string, unknown>

/** Human sentence for a log entry (without the actor's name). */
export function describeLog(entry: LogWithActor): string {
  const d = (entry.details ?? {}) as Details
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '')
  switch (entry.event) {
    case 'meeting_created':
      return 'criou a reunião'
    case 'objective_updated':
      return str('to') ? `definiu o objetivo: “${truncate(str('to'), 120)}”` : 'removeu o objetivo'
    case 'status_changed':
      return `marcou a reunião como ${STATUS_LABEL[str('to') as MeetingStatus]?.toLowerCase() ?? str('to')}`
    case 'meeting_updated':
      return `editou a reunião (${str('title')}, ${fmtDateTime(str('scheduled_at'))})`
    case 'note_added':
      return `adicionou notas: “${truncate(str('preview'), 120)}”`
    case 'note_updated':
      return `editou notas: “${truncate(str('preview'), 120)}”`
    case 'note_deleted':
      return 'removeu notas'
    case 'manual':
      return `registou: “${str('text')}”`
    default:
      return entry.event
  }
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
