import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Marca } from '@/components/Marca'
import { linkWhatsapp } from '@/lib/whatsapp'

/**
 * Tela de login.
 *
 * DIVERGENCIA APROVADA vs. CLAUDE.md §7/§10.7: o contrato original proibia
 * "esqueci a senha" e cadastro nesta tela. O Danilo pediu explicitamente os
 * dois — mas resolvidos POR FORA do sistema, via WhatsApp do admin. Ou seja, a
 * premissa do contrato continua valida: nao existe autoatendimento, nao existe
 * e-mail transacional e nao existe auto-cadastro. Sao dois links de contato,
 * nao dois fluxos de autenticacao.
 */

const LINK_SENHA = linkWhatsapp(
  'Olá! Perdi o acesso à minha conta do Market Price e preciso redefinir minha senha.',
)
const LINK_CADASTRO = linkWhatsapp(
  'Olá! Gostaria de solicitar cadastro no Market Price — Inteligência de Preços.',
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      // Nunca vazar a mensagem crua do provedor para a interface (§10.6).
      setErro(
        error.message.toLowerCase().includes('invalid login')
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      )
      setEnviando(false)
      return
    }
    // Em caso de sucesso o onAuthStateChange assume e o roteador redireciona.
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-130">
        <form
          onSubmit={entrar}
          className="rounded-panel border border-line-soft bg-panel px-10 py-11 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.95)]"
          noValidate
        >
          <div className="flex flex-col items-center">
            <Marca tamanho="grande" />
            <p className="mt-7 max-w-95 text-center text-[13.5px] leading-relaxed text-ink-2">
              Acesse sua conta para ter acesso ao Dashboard de Inteligência de
              Preços
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                className="h-12 text-[15px]"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-4">
                <Label htmlFor="senha">Senha</Label>
                <a
                  href={LINK_SENHA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-badge text-[12px] text-gold-bright transition-colors duration-150 hover:text-gold focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2"
                >
                  Esqueci minha senha
                </a>
              </div>

              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="h-12 pr-21.5 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-pressed={mostrarSenha}
                  aria-controls="senha"
                  className="absolute inset-y-0 right-0 flex items-center rounded-r-card px-3.5 text-[12px] text-ink-2 transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2"
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
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
              className="mt-2 h-12 w-full text-[15px]"
              carregando={enviando}
              disabled={email.trim() === '' || senha === ''}
            >
              Entrar
            </Button>

            <a
              href={LINK_CADASTRO}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto rounded-badge px-2 py-1 text-center text-[13px] text-gold-bright transition-colors duration-150 hover:text-gold focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2"
            >
              Solicitar Cadastro
            </a>
          </div>
        </form>
      </div>
    </main>
  )
}
