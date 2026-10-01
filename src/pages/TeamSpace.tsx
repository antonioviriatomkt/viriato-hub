import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MeetingListItem, MeetingStatus, MemberWithProfile } from '../lib/types'
import { STATUS_LABEL, displayName, fmtDate, fmtTime, fromLocalInput, nextFullHour, truncate } from '../lib/format'
import { Avatar, Badge, Button, Card, EmptyState, ErrorText, Field, Input, Spinner, Textarea, errorMessage } from '../components/ui'

const statusTone: Record<MeetingStatus, 'accent' | 'success' | 'muted'> = {
  planned: 'accent',
  done: 'success',
  cancelled: 'muted',
}

export default function TeamSpace() {
  const { slug } = useParams()
  const { teams, session } = useAuth()
  const navigate = useNavigate()
  const team = teams.find((t) => t.slug === slug)

  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    if (!team) return
    setError('')
    const [m, tm] = await Promise.all([
      supabase
        .from('meetings')
        .select('*, creator:profiles!meetings_created_by_fkey(full_name, email), meeting_notes(count)')
        .eq('team_id', team.id)
        .order('scheduled_at', { ascending: false })
        .overrideTypes<MeetingListItem[], { merge: false }>(),
      supabase
        .from('team_members')
        .select('*, profile:profiles!team_members_user_id_fkey(*)')
        .eq('team_id', team.id)
        .overrideTypes<MemberWithProfile[], { merge: false }>(),
    ])
    if (m.error) setError(errorMessage(m.error))
    setMeetings(m.data ?? [])
    setMembers(tm.data ?? [])
    setLoading(false)
  }, [team])

  useEffect(() => {
    setLoading(true)
    setShowForm(false)
    void load()
  }, [load])

  if (!team) {
    return <EmptyState title="Equipa não encontrada" hint="Verifica o endereço ou escolhe uma equipa no menu." />
  }

  const planned = meetings
    .filter((m) => m.status === 'planned')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const history = meetings.filter((m) => m.status !== 'planned')

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Espaço de equipa</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{team.name}</h1>
          {team.description && <p className="mt-1 text-sm text-stone-500">{team.description}</p>}
          {members.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {members.map((m) => (
                <span key={m.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-2.5 pl-0.5 text-xs text-stone-600 ring-1 ring-stone-200">
                  <Avatar name={displayName(m.profile ?? undefined)} size="sm" />
                  {displayName(m.profile ?? undefined)}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Fechar' : '+ Nova reunião'}</Button>
      </header>

      {showForm && session && (
        <NewMeetingForm
          teamId={team.id}
          userId={session.user.id}
          onCreated={(id) => navigate(`/equipas/${team.slug}/reunioes/${id}`)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          title="Ainda não há reuniões nesta equipa"
          hint="Cria a primeira reunião e define o objetivo antes de começar."
          action={<Button onClick={() => setShowForm(true)}>+ Nova reunião</Button>}
        />
      ) : (
        <>
          <MeetingSection title="Agendadas" meetings={planned} slug={team.slug} empty="Nenhuma reunião agendada." />
          <MeetingSection title="Histórico" meetings={history} slug={team.slug} empty="Ainda sem reuniões realizadas." />
        </>
      )}
    </div>
  )
}

function MeetingSection({ title, meetings, slug, empty }: { title: string; meetings: MeetingListItem[]; slug: string; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-stone-500">
        {title} <span className="ml-1 font-normal text-stone-400">{meetings.length}</span>
      </h2>
      {meetings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200/80 bg-white">
          {meetings.map((m) => {
            const notes = m.meeting_notes?.[0]?.count ?? 0
            return (
              <li key={m.id}>
                <Link to={`/equipas/${slug}/reunioes/${m.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-stone-50">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-[11px] font-semibold uppercase text-stone-500">{fmtDate(m.scheduled_at)}</p>
                    <p className="text-sm font-medium text-stone-800">{fmtTime(m.scheduled_at)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-stone-900">{m.title}</p>
                    <p className="mt-0.5 truncate text-sm text-stone-500">
                      {m.objective ? truncate(m.objective, 110) : <span className="italic text-stone-400">Sem objetivo definido</span>}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 text-xs text-stone-500 sm:flex">
                    <span>{displayName(m.creator)}</span>
                    <span title="Notas">{notes} {notes === 1 ? 'nota' : 'notas'}</span>
                    <Badge tone={statusTone[m.status as MeetingStatus] ?? 'neutral'}>{STATUS_LABEL[m.status as MeetingStatus] ?? m.status}</Badge>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function NewMeetingForm({
  teamId,
  userId,
  onCreated,
  onCancel,
}: {
  teamId: string
  userId: string
  onCreated: (id: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState(nextFullHour())
  const [objective, setObjective] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        team_id: teamId,
        created_by: userId,
        title: title.trim(),
        scheduled_at: fromLocalInput(when),
        objective: objective.trim() || null,
      })
      .select('id')
      .single()
    setBusy(false)
    if (error || !data) {
      setError(errorMessage(error))
      return
    }
    onCreated(data.id)
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <Field label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="Ex.: Reunião semanal de vendas" />
          </Field>
          <Field label="Data e hora">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
        </div>
        <Field label="Objetivo" hint="O que se pretende alcançar nesta reunião. Pode ser editado depois.">
          <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex.: Fechar a lista de leads prioritários para outubro" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !title.trim()}>
            {busy ? 'A criar…' : 'Criar reunião'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
