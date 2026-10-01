import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MemberWithProfile, Profile, Role, Team } from '../lib/types'
import { ROLE_LABEL, displayName, fmtDate, slugify } from '../lib/format'
import { Avatar, Badge, Button, Card, CardHeader, ErrorText, Field, Input, Select, Spinner, errorMessage } from '../components/ui'

export default function Admin() {
  const { session, refresh } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [u, t, m] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('teams').select('*').order('name'),
      supabase
        .from('team_members')
        .select('*, profile:profiles!team_members_user_id_fkey(*)')
        .overrideTypes<MemberWithProfile[], { merge: false }>(),
    ])
    const err = u.error ?? t.error ?? m.error
    if (err) setError(errorMessage(err))
    setUsers(u.data ?? [])
    setTeams(t.data ?? [])
    setMembers(m.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function reload() {
    await load()
    await refresh() // keep the sidebar in sync
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  const pending = users.filter((u) => u.role === 'pending')

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Gestão</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Administração</h1>
      </header>

      <ErrorText>{error}</ErrorText>

      {pending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader title={`Pedidos de acesso (${pending.length})`} hint="Novas contas à espera de aprovação." />
          <ul className="divide-y divide-amber-100">
            {pending.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={displayName(u)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">{displayName(u)}</p>
                  <p className="truncate text-xs text-stone-500">{u.email} · {fmtDate(u.created_at)}</p>
                </div>
                <Button size="sm" onClick={() => void setRole(u.id, 'member', reload, setError)}>
                  Aprovar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <UsersCard users={users} selfId={session?.user.id} onChanged={reload} onError={setError} />

      <TeamsCard teams={teams} users={users} members={members} selfId={session?.user.id} onChanged={reload} onError={setError} />
    </div>
  )
}

async function setRole(userId: string, role: Role, onChanged: () => Promise<void>, onError: (m: string) => void) {
  onError('')
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) onError(errorMessage(error))
  else await onChanged()
}

/* ---------- Users ---------- */

function UsersCard({ users, selfId, onChanged, onError }: { users: Profile[]; selfId?: string; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  return (
    <Card>
      <CardHeader title="Utilizadores" hint="Administradores gerem equipas e acessos; membros usam os espaços das suas equipas." />
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-stone-500">
          <tr className="border-b border-stone-100">
            <th className="px-5 py-2 font-medium">Nome</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Desde</th>
            <th className="px-5 py-2 text-right font-medium">Função</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-5 py-2.5">
                <span className="flex items-center gap-2">
                  <Avatar name={displayName(u)} size="sm" />
                  <span className="font-medium text-stone-900">{displayName(u)}</span>
                  {u.id === selfId && <Badge>tu</Badge>}
                </span>
              </td>
              <td className="px-3 py-2.5 text-stone-600">{u.email}</td>
              <td className="px-3 py-2.5 text-stone-500">{fmtDate(u.created_at)}</td>
              <td className="px-5 py-2.5 text-right">
                <Select
                  className="h-8 w-40 py-1 text-[13px]"
                  value={u.role}
                  disabled={u.id === selfId}
                  title={u.id === selfId ? 'Não podes alterar a tua própria função' : undefined}
                  onChange={(e) => void setRole(u.id, e.target.value as Role, onChanged, onError)}
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/* ---------- Teams ---------- */

function TeamsCard({
  teams,
  users,
  members,
  selfId,
  onChanged,
  onError,
}: {
  teams: Team[]
  users: Profile[]
  members: MemberWithProfile[]
  selfId?: string
  onChanged: () => Promise<void>
  onError: (m: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const active = users.filter((u) => u.role !== 'pending')

  async function createTeam(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    onError('')
    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      slug: slugify(name) || `equipa-${Date.now()}`,
      description: description.trim() || null,
      created_by: selfId ?? null,
    })
    setBusy(false)
    if (error) return onError(error.code === '23505' ? 'Já existe uma equipa com esse nome.' : errorMessage(error))
    setName('')
    setDescription('')
    await onChanged()
  }

  async function addMember(teamId: string, userId: string) {
    onError('')
    const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId })
    if (error) return onError(errorMessage(error))
    await onChanged()
  }

  async function removeMember(teamId: string, userId: string) {
    onError('')
    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
    if (error) return onError(errorMessage(error))
    await onChanged()
  }

  return (
    <Card>
      <CardHeader title="Equipas" hint="Cada equipa tem o seu espaço com reuniões, notas e registo." />
      <div className="divide-y divide-stone-100">
        {teams.map((t) => {
          const tm = members.filter((m) => m.team_id === t.id)
          const inTeam = new Set(tm.map((m) => m.user_id))
          const candidates = active.filter((u) => !inTeam.has(u.id))
          return (
            <div key={t.id} className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[15px] font-medium text-stone-900">{t.name}</p>
                  <p className="text-xs text-stone-500">/equipas/{t.slug}{t.description ? ` · ${t.description}` : ''}</p>
                </div>
                <span className="text-xs text-stone-500">{tm.length} {tm.length === 1 ? 'membro' : 'membros'}</span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {tm.map((m) => (
                  <li key={m.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 py-0.5 pr-1 pl-0.5 text-xs text-stone-700">
                    <Avatar name={displayName(m.profile ?? undefined)} size="sm" />
                    {displayName(m.profile ?? undefined)}
                    <button
                      className="ml-0.5 rounded-full px-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-800"
                      title="Remover da equipa"
                      onClick={() => void removeMember(t.id, m.user_id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {tm.length === 0 && <li className="text-xs text-stone-400 italic">Sem membros</li>}
              </ul>
              {candidates.length > 0 && (
                <div className="mt-3">
                  <Select
                    className="h-8 w-64 py-1 text-[13px]"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) void addMember(t.id, e.target.value)
                    }}
                  >
                    <option value="">+ Adicionar membro…</option>
                    {candidates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {displayName(u)} ({u.email})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <form onSubmit={createTeam} className="grid gap-3 border-t border-stone-100 bg-stone-50/60 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Nova equipa">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Equipa de Marketing" required />
        </Field>
        <Field label="Descrição (opcional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para que serve este espaço" />
        </Field>
        <Button type="submit" disabled={busy || !name.trim()}>
          Criar equipa
        </Button>
      </form>
    </Card>
  )
}
