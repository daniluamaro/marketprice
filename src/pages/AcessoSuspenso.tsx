import { Lock } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Marca } from '@/components/Marca'

/**
 * Gate comercial (CLAUDE.md §7): perfil com ativo = false, ou usuario
 * autenticado sem perfil. Em nenhum dos casos exibimos qualquer dado — a RLS
 * ja garantiria isso no servidor, esta tela e a face amigavel do bloqueio.
 */
export default function AcessoSuspenso() {
  const sair = useAuth((s) => s.sair)
  const email = useAuth((s) => s.session?.user.email ?? null)

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-105">
        <div className="mb-9 flex justify-center">
          <Marca />
        </div>

        <div className="rounded-panel border border-line-soft bg-panel px-7 py-7 text-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-warning/25 bg-warning/10">
            <Lock className="size-5 text-warning-txt" aria-hidden />
          </div>

          <h1 className="font-display text-[17px] font-extrabold text-ink">
            Acesso suspenso
          </h1>

          <p className="mx-auto mt-2.5 max-w-80 text-[12.5px] leading-relaxed text-ink-2">
            Este acesso está temporariamente indisponível. Fale com o suporte da
            Performar para regularizar e reativar sua conta.
          </p>

          {email !== null && (
            <p className="mt-4 rounded-chip border border-line bg-elevated px-3 py-2 text-[11.5px] text-ink-3">
              {email}
            </p>
          )}

          <Button variant="outline" className="mt-5 w-full" onClick={() => void sair()}>
            Sair
          </Button>
        </div>
      </div>
    </main>
  )
}
