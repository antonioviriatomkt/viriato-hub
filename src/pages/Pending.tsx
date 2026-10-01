import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { Button, FullScreen } from '../components/ui'

export default function Pending() {
  const { profile, refresh, signOut } = useAuth()
  const [checking, setChecking] = useState(false)

  return (
    <FullScreen>
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <img src="/favicon.svg" alt="" className="mx-auto mb-4 size-10 rounded-lg" />
        <h1 className="text-lg font-semibold text-stone-900">Conta a aguardar aprovação</h1>
        <p className="mt-2 text-sm text-stone-600">
          A conta <span className="font-medium text-stone-800">{profile?.email}</span> foi criada. Um administrador precisa de a
          aprovar e adicionar-te a uma equipa.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="secondary"
            disabled={checking}
            onClick={async () => {
              setChecking(true)
              await refresh()
              setChecking(false)
            }}
          >
            Verificar novamente
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </div>
    </FullScreen>
  )
}
