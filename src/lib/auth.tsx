import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, Role, Team } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  role: Role | null
  isAdmin: boolean
  teams: Team[]
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (userId: string) => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('teams').select('*').order('name'),
    ])
    setProfile(p ?? null)
    setTeams(t ?? [])
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadData(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) {
        // Defer: supabase-js must not be awaited inside this callback.
        setTimeout(() => void loadData(s.user.id), 0)
      } else {
        setProfile(null)
        setTeams([])
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadData])

  const refresh = useCallback(async () => {
    if (session) await loadData(session.user.id)
  }, [session, loadData])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const role = (profile?.role as Role | undefined) ?? null

  return (
    <AuthContext.Provider
      value={{ session, profile, role, isAdmin: role === 'admin', teams, loading, refresh, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
