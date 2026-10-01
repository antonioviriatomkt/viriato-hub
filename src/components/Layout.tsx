import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL, displayName } from '../lib/format'
import { Avatar } from './ui'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5 hover:text-stone-100',
  ].join(' ')

export default function Layout() {
  const { profile, role, isAdmin, teams, signOut } = useAuth()
  const name = displayName(profile ?? undefined)

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-ink text-stone-200 md:sticky md:top-0 md:h-screen md:w-64">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
          <span className="text-[15px] font-semibold tracking-tight text-white">Viriato Hub</span>
        </div>

        <nav className="flex-1 space-y-6 px-3">
          <div>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Equipas</p>
            {teams.length === 0 && <p className="px-3 py-2 text-sm text-stone-500">Sem equipas</p>}
            {teams.map((t) => (
              <NavLink key={t.id} to={`/equipas/${t.slug}`} className={linkClass}>
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                {t.name}
              </NavLink>
            ))}
          </div>

          {isAdmin && (
            <div>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Gestão</p>
              <NavLink to="/admin" className={linkClass}>
                Administração
              </NavLink>
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="truncate text-xs text-stone-500">{role ? ROLE_LABEL[role] : ''}</p>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-white/10 hover:text-white"
              title="Terminar sessão"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
