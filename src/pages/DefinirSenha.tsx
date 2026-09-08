import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Marca } from '@/components/Marca'

const MINIMO = 8

/**
 * Troca obrigatoria no 1o acesso (CLAUDE.md §7).
 * Fluxo: auth.updateUser({password}) -> rpc_confirmar_troca_senha() -> libera.
 * Enquanto senha_provisoria for true, o roteador nao deixa sair daqui.
 */
export default function DefinirSenha() {
  const navigate = useNavigate()
  const marcarSenhaDefinitiva = useAuth((s) => s.marcarSenhaDefinitiva)
  const recarregarPerfil = useAuth((s) => s.recarregarPerfil)
  const sair = useAuth((s) => s.sair)

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const curta = senha.length > 0 && senha.length < MINIMO
  const divergem = confirmacao.length > 0 && senha !== confirmacao
  const podeEnviar = senha.length >= MINIMO && senha === confirmacao

  async function definir(e: FormEvent) {
    e.preventDefault()
    if (!podeEnviar) return
    setErro(null)
    setEnviando(true)

    const { error: erroSenha } = await supabase.auth.updateUser({ password: senha })
    if (erroSenha) {
      setErro(
        erroSenha.message.toLowerCase().includes('should be different')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível alterar a senha agora. Tente novamente.',
      )
      setEnviando(false)
      return
    }

    const { error: erroRpc } = await supabase.rpc('rpc_confirmar_troca_senha')
    if (erroRpc) {
      // A senha JA mudou aqui. Nao podemos fingir que falhou tudo, senao o
      // usuario tentaria de novo com a senha antiga e se trancaria para fora.
      setErro(
        'Sua senha foi alterada, mas houve uma falha ao concluir. ' +
          'Entre novamente com a nova senha.',
      )
      setEnviando(false)
      return
    }

    // Atualiza a sessao com o estado real do servidor e sai da tela. Antes o
    // codigo so marcava a flag em memoria e parava aqui — o botao ficava
    // girando e ninguem era levado ao dashboard.
    marcarSenhaDefinitiva()
    await recarregarPerfil()
    setEnviando(false)
    navigate('/', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-105">
        <div className="mb-9 flex flex-col items-center gap-3.5">
          <Marca />
        </div>

        <form
          onSubmit={definir}
          className="rounded-panel border border-line-soft bg-panel px-7 py-7 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
          noValidate
        >
          <div className="mb-6 flex flex-col gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
              <ShieldCheck className="size-4 text-gold-bright" aria-hidden />
            </div>
            <h1 className="font-display text-[17px] font-extrabold text-ink">
              Defina sua senha
            </h1>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Seu acesso foi criado com uma senha provisória. Escolha uma senha
              própria para continuar — ela terá no mínimo {MINIMO} caracteres.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nova">Nova senha</Label>
              <Input
                id="nova"
                type="password"
                autoComplete="new-password"
                autoFocus
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              {curta && (
                <p className="text-[11.5px] text-warning-txt">
                  Use ao menos {MINIMO} caracteres.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmar">Confirme a nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                required
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
              {divergem && (
                <p className="text-[11.5px] text-warning-txt">As senhas não conferem.</p>
              )}
            </div>

            {erro !== null && (
              <p
                role="alert"
                className="rounded-chip border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger-txt"
              >
                {erro}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-1 w-full"
              carregando={enviando}
              disabled={!podeEnviar}
            >
              Salvar e continuar
            </Button>

            <button
              type="button"
              onClick={() => void sair()}
              className="mx-auto text-[12px] text-ink-3 transition-colors hover:text-ink-2"
            >
              Sair
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
