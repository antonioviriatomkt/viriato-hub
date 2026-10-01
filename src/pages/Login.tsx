import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, ErrorText, Field, FullScreen, Input, Spinner, errorMessage } from '../components/ui'

type Mode = 'login' | 'signup'

export default function Login() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (loading) {
    return (
      <FullScreen>
        <Spinner />
      </FullScreen>
    )
  }
  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Conta criada. Confirma o teu email para continuar.')
        }
      }
    } catch (err) {
      setError(translateAuthError(errorMessage(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FullScreen>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">Viriato Hub</h1>
            <p className="text-sm text-stone-500">Espaço interno das equipas</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-stone-200/70 p-1 text-sm font-medium">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError('')
                setInfo('')
              }}
              className={[
                'rounded-md py-1.5 transition-colors',
                mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900',
              ].join(' ')}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="O teu nome" />
            </Field>
          )}
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="nome@viriato.pt"
            />
          </Field>
          <Field label="Palavra-passe" hint={mode === 'signup' ? 'Mínimo 8 caracteres.' : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>

          <ErrorText>{error}</ErrorText>
          {info && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">{info}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Spinner className="size-4 border-white/40 border-t-white" /> : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-center text-xs text-stone-500">
            As novas contas ficam pendentes até um administrador as aprovar.
          </p>
        )}
      </div>
    </FullScreen>
  )
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ou palavra-passe incorretos.'
  if (m.includes('email not confirmed')) return 'Confirma o teu email antes de entrar.'
  if (m.includes('already registered')) return 'Já existe uma conta com este email.'
  if (m.includes('password should be')) return 'A palavra-passe deve ter pelo menos 8 caracteres.'
  if (m.includes('is invalid')) return 'Email inválido.'
  if (m.includes('rate limit')) return 'Demasiadas tentativas. Tenta novamente daqui a pouco.'
  return msg
}
