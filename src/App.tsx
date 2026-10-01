import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Button, FullScreen, Spinner } from './components/ui'
import Login from './pages/Login'
import Pending from './pages/Pending'
import Home from './pages/Home'
import TeamSpace from './pages/TeamSpace'
import MeetingPage from './pages/Meeting'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="equipas/:slug" element={<TeamSpace />} />
          <Route path="equipas/:slug/reunioes/:id" element={<MeetingPage />} />
          <Route path="admin" element={<RequireAdmin />}>
            <Route index element={<Admin />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireAuth() {
  const { session, profile, role, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <FullScreen>
        <Spinner />
      </FullScreen>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (!profile) {
    return (
      <FullScreen>
        <div className="text-center">
          <p className="text-sm text-stone-600">Não foi possível carregar o teu perfil.</p>
          <Button variant="secondary" className="mt-4" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </FullScreen>
    )
  }
  if (role === 'pending') return <Pending />
  return <Outlet />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}
