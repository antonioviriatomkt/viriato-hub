import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { LogWithActor, MeetingDetail, MeetingStatus, NoteWithAuthor } from '../lib/types'
import { STATUS_LABEL, describeLog, displayName, fmtDateTime, fmtRelative, fromLocalInput, toLocalInput } from '../lib/format'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorText, Field, Input, Spinner, Textarea, errorMessage } from '../components/ui'

const statusTone: Record<MeetingStatus, 'accent' | 'success' | 'muted'> = {
  planned: 'accent',
  done: 'success',
  cancelled: 'muted',
}

export default function MeetingPage() {
  const { slug, id } = useParams()
  const { teams, session, isAdmin } = useAuth()
  const navigate = useNavigate()
  const team = teams.find((t) => t.slug === slug)
  const userId = session?.user.id

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null)
  const [notes, setNotes] = useState<NoteWithAuthor[]>([])
  const [log, setLog] = useState<LogWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const [m, n, l] = await Promise.all([
      supabase
        .from('meetings')
        .select('*, creator:profiles!meetings_created_by_fkey(full_name, email)')
        .eq('id', id)
        .maybeSingle()
        .overrideTypes<MeetingDetail, { merge: false }>(),
      supabase
        .from('meeting_notes')
        .select('*, author:profiles!meeting_notes_author_id_fkey(full_name, email)')
        .eq('meeting_id', id)
        .order('created_at')
        .overrideTypes<NoteWithAuthor[], { merge: false }>(),
      supabase
        .from('meeting_log')
        .select('*, actor:profiles!meeting_log_actor_id_fkey(full_name, email)')
        .eq('meeting_id', id)
        .order('created_at', { ascending: false })
        .overrideTypes<LogWithActor[], { merge: false }>(),
    ])
    if (m.error) setError(errorMessage(m.error))
    setMeeting(m.data ?? null)
    setNotes(n.data ?? [])
    setLog(l.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  // Live updates: any change to this meeting, its notes or its log refreshes the page.
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`meeting:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `id=eq.${id}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_notes', filter: `meeting_id=eq.${id}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_log', filter: `meeting_id=eq.${id}` }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id, load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }
  if (!meeting || !team || meeting.team_id !== team.id) {
    return (
      <EmptyState
        title="Reunião não encontrada"
        hint="Pode ter sido eliminada ou não tens acesso."
        action={
          team ? (
            <Link to={`/equipas/${team.slug}`}>
              <Button variant="secondary">Voltar à equipa</Button>
            </Link>
          ) : undefined
        }
      />
    )
  }

  const status = meeting.status as MeetingStatus
  const canDelete = isAdmin || meeting.created_by === userId

  async function setStatus(next: MeetingStatus) {
    const { error } = await supabase.from('meetings').update({ status: next }).eq('id', meeting!.id)
    if (error) setError(errorMessage(error))
    else void load()
  }

  async function remove() {
    const { error } = await supabase.from('meetings').delete().eq('id', meeting!.id)
    if (error) setError(errorMessage(error))
    else navigate(`/equipas/${team!.slug}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/equipas/${team.slug}`} className="text-sm text-stone-500 hover:text-stone-800">
          ← {team.name}
        </Link>
      </div>

      <MeetingHeader meeting={meeting} status={status} onSaved={load} onStatus={setStatus} canDelete={canDelete} onDelete={remove} />

      <ErrorText>{error}</ErrorText>

      <ObjectiveCard meeting={meeting} onSaved={load} />

      <NotesCard meetingId={meeting.id} status={status} notes={notes} userId={userId} isAdmin={isAdmin} onChanged={load} />

      <LogCard meetingId={meeting.id} log={log} userId={userId} onChanged={load} />
    </div>
  )
}

/* ---------- Header: title, date, status, actions ---------- */

function MeetingHeader({
  meeting,
  status,
  onSaved,
  onStatus,
  canDelete,
  onDelete,
}: {
  meeting: MeetingDetail
  status: MeetingStatus
  onSaved: () => Promise<void>
  onStatus: (s: MeetingStatus) => Promise<void>
  canDelete: boolean
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(meeting.title)
  const [when, setWhen] = useState(toLocalInput(meeting.scheduled_at))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTitle(meeting.title)
    setWhen(toLocalInput(meeting.scheduled_at))
  }, [meeting.title, meeting.scheduled_at])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase
      .from('meetings')
      .update({ title: title.trim(), scheduled_at: fromLocalInput(when) })
      .eq('id', meeting.id)
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    setEditing(false)
    await onSaved()
  }

  return (
    <header className="space-y-3">
      {editing ? (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Field label="Título">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </Field>
            <Field label="Data e hora">
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={busy || !title.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{meeting.title}</h1>
              <Badge tone={statusTone[status]}>{STATUS_LABEL[status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {fmtDateTime(meeting.scheduled_at)} · criada por {displayName(meeting.creator)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status === 'planned' && (
              <>
                <Button size="sm" onClick={() => void onStatus('done')}>
                  Marcar como realizada
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void onStatus('cancelled')}>
                  Cancelar reunião
                </Button>
              </>
            )}
            {status !== 'planned' && (
              <Button size="sm" variant="secondary" onClick={() => void onStatus('planned')}>
                Reabrir
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Editar
            </Button>
            {canDelete &&
              (confirmDelete ? (
                <span className="inline-flex items-center gap-1">
                  <Button size="sm" variant="danger" onClick={() => void onDelete()}>
                    Confirmar eliminação
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Não
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
              ))}
          </div>
        </div>
      )}
    </header>
  )
}

/* ---------- Objective ---------- */

function ObjectiveCard({ meeting, onSaved }: { meeting: MeetingDetail; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(meeting.objective ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setValue(meeting.objective ?? ''), [meeting.objective])
  const dirty = value.trim() !== (meeting.objective ?? '').trim()

  async function save() {
    setBusy(true)
    setError('')
    const { error } = await supabase.from('meetings').update({ objective: value.trim() || null }).eq('id', meeting.id)
    setBusy(false)
    if (error) setError(errorMessage(error))
    else await onSaved()
  }

  return (
    <Card>
      <CardHeader
        title="Objetivo"
        hint="Define antes da reunião o que se pretende alcançar."
        action={
          dirty ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setValue(meeting.objective ?? '')}>
                Repor
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={busy}>
                Guardar
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="p-5">
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Decidir a estratégia de follow-up para os leads da feira" />
        <ErrorText>{error}</ErrorText>
      </div>
    </Card>
  )
}

/* ---------- Notes ---------- */

function NotesCard({
  meetingId,
  status,
  notes,
  userId,
  isAdmin,
  onChanged,
}: {
  meetingId: string
  status: MeetingStatus
  notes: NoteWithAuthor[]
  userId?: string
  isAdmin: boolean
  onChanged: () => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!userId || !draft.trim()) return
    setBusy(true)
    setError('')
    const { error } = await supabase.from('meeting_notes').insert({ meeting_id: meetingId, author_id: userId, body: draft.trim() })
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    setDraft('')
    await onChanged()
  }

  return (
    <Card>
      <CardHeader
        title="Notas da reunião"
        hint={status === 'planned' ? 'Registadas depois da reunião: decisões, próximos passos, responsáveis.' : 'Decisões, próximos passos e responsáveis.'}
      />
      <div className="divide-y divide-stone-100">
        {notes.length === 0 && <p className="px-5 py-6 text-sm text-stone-500">Ainda não há notas.</p>}
        {notes.map((n) => (
          <NoteItem key={n.id} note={n} editable={isAdmin || n.author_id === userId} onChanged={onChanged} />
        ))}
      </div>
      <form onSubmit={add} className="space-y-3 border-t border-stone-100 bg-stone-50/60 p-5">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve as notas desta reunião…" />
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
            {busy ? 'A guardar…' : 'Adicionar notas'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function NoteItem({ note, editable, onChanged }: { note: NoteWithAuthor; editable: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(note.body)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const { error } = await supabase.from('meeting_notes').update({ body: value.trim() }).eq('id', note.id)
    if (error) return setError(errorMessage(error))
    setEditing(false)
    await onChanged()
  }
  async function remove() {
    const { error } = await supabase.from('meeting_notes').delete().eq('id', note.id)
    if (error) return setError(errorMessage(error))
    await onChanged()
  }

  const name = displayName(note.author)
  return (
    <article className="px-5 py-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
        <Avatar name={name} size="sm" />
        <span className="font-medium text-stone-700">{name}</span>
        <span>·</span>
        <time dateTime={note.created_at} title={fmtDateTime(note.created_at)}>
          {fmtRelative(note.created_at)}
        </time>
        {note.updated_at !== note.created_at && <span className="italic">(editado)</span>}
        {editable && !editing && (
          <span className="ml-auto flex gap-1">
            <button className="rounded px-1.5 py-0.5 hover:bg-stone-100 hover:text-stone-800" onClick={() => setEditing(true)}>
              Editar
            </button>
            {confirm ? (
              <>
                <button className="rounded px-1.5 py-0.5 text-red-700 hover:bg-red-50" onClick={() => void remove()}>
                  Confirmar
                </button>
                <button className="rounded px-1.5 py-0.5 hover:bg-stone-100" onClick={() => setConfirm(false)}>
                  Não
                </button>
              </>
            ) : (
              <button className="rounded px-1.5 py-0.5 hover:bg-stone-100 hover:text-stone-800" onClick={() => setConfirm(true)}>
                Eliminar
              </button>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(note.body) }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={!value.trim()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-800">{note.body}</p>
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </article>
  )
}

/* ---------- Log ---------- */

function LogCard({ meetingId, log, userId, onChanged }: { meetingId: string; log: LogWithActor[]; userId?: string; onChanged: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!userId || !text.trim()) return
    const { error } = await supabase.from('meeting_log').insert({ meeting_id: meetingId, actor_id: userId, event: 'manual', details: { text: text.trim() } })
    if (error) return setError(errorMessage(error))
    setText('')
    await onChanged()
  }

  return (
    <Card>
      <CardHeader title="Registo" hint="Histórico automático de tudo o que acontece nesta reunião." />
      <ol className="px-5 py-2">
        {log.map((entry) => (
          <li key={entry.id} className="relative flex gap-3 py-2.5 text-sm">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-stone-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-stone-700">
                <span className="font-medium text-stone-900">{displayName(entry.actor)}</span> {describeLog(entry)}
              </p>
              <time className="text-xs text-stone-400" dateTime={entry.created_at} title={fmtDateTime(entry.created_at)}>
                {fmtRelative(entry.created_at)}
              </time>
            </div>
          </li>
        ))}
        {log.length === 0 && <li className="py-4 text-sm text-stone-500">Sem registos.</li>}
      </ol>
      <form onSubmit={add} className="flex gap-2 border-t border-stone-100 p-4">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar uma entrada manual ao registo…" />
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Registar
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
