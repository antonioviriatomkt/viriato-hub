import { Link, Navigate } from 'react-router'
import { useAuth } from '../lib/auth'
import { Button, EmptyState } from '../components/ui'

export default function Home() {
  const { teams, isAdmin } = useAuth()
  if (teams.length > 0) return <Navigate to={`/equipas/${teams[0].slug}`} replace />

  return (
    <EmptyState
      title="Ainda não pertences a nenhuma equipa"
      hint={isAdmin ? 'Cria uma equipa ou adiciona-te a uma existente.' : 'Pede a um administrador para te adicionar.'}
      action={
        isAdmin ? (
          <Link to="/admin">
            <Button>Gerir equipas</Button>
          </Link>
        ) : undefined
      }
    />
  )
}
