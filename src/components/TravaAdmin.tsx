import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound, Lock, ShieldAlert } from 'lucide-react'
import {
  definirSenhaAdmin,
  desbloquearAdmin,
  estadoSeguranca,
} from '@/lib/adminUsers'
import { useAdminSessao } from '@/store/adminSessao'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/estados'

/**
 * Segunda barreira da Administracao (§7).
 *
 * Ser admin autenticado abre esta tela; so a senha abre a proxima. Ela protege
 * o cenario que o papel `admin` sozinho nao cobre: alguem com a sessao do dono
 * em maos — notebook aberto, token copiado — teria poder de criar clientes,
 * resetar senhas e desativar acessos.
 *
 * ISTO AQUI NAO E A SEGURANCA. E a porta. A tranca esta na Edge Function, que
 * reconfere a senha em toda operacao: remover este componente do bundle nao
 * libera nada, porque o servidor continua exigindo.
 *
 * A senha vive apenas em memoria (ver store/adminSessao) e some ao recarregar.
 */
export function TravaAdmin() {
  const desbloquear = useAdminSessao((s) => s.desbloquear)

  const estado = useQuery({
    queryKey: ['admin-seguranca'],
    queryFn: estadoSeguranca,
    staleTime: Infinity,
    retry: false,
  })

  if (estado.isPending) {
    return (
      <div className="mx-auto max-w-120 space-y-3 py-16">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  const configurada = estado.data?.configurada === true

  return configurada ? (
    <FormularioDesbloqueio aoAbrir={desbloquear} />
  ) : (
    <FormularioPrimeiraSenha aoAbrir={desbloquear} />
  )
}

/** Moldura comum, para os dois estados terem o mesmo peso visual. */
function Moldura({
  Icone,
  eyebrow,
  titulo,
  descricao,
  children,
}: {
  Icone: typeof Lock
  eyebrow: string
  titulo: string
  descricao: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-120 py-12">
      <div className="rounded-panel border border-line-soft bg-panel px-7 py-7">
        <div className="flex items-center gap-2">
          <Icone className="size-4 text-gold" aria-hidden />
          <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-gold">
            {eyebrow}
          </p>
        </div>
        <h2 className="mt-2 font-display text-[19px] font-extrabold tracking-[-0.2px] text-ink">
          {titulo}
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{descricao}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

function Erro({ mensagem }: { mensagem: string }) {
  return (
    <p
      role="alert"
      className="rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger-txt"
    >
      {mensagem}
    </p>
  )
}

function FormularioDesbloqueio({ aoAbrir }: { aoAbrir: (senha: string) => void }) {
  const [senha, setSenha] = useState('')

  const mutacao = useMutation({
    mutationFn: (s: string) => desbloquearAdmin(s),
    // So guarda a senha DEPOIS que o servidor aprovou. Guardar antes deixaria a
    // tela "destravada" com uma senha que nao funciona em nenhuma operacao.
    onSuccess: (_dados, s) => aoAbrir(s),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (senha.trim() !== '') mutacao.mutate(senha)
  }

  return (
    <Moldura
      Icone={Lock}
      eyebrow="Área restrita"
      titulo="Senha de administração"
      descricao="Esta área cria acessos, redefine senhas e suspende clientes. Informe a senha de administração para continuar. Ela é pedida uma vez por sessão."
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="senha-admin">Senha de administração</Label>
          <Input
            id="senha-admin"
            type="password"
            autoComplete="off"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-invalid={mutacao.isError}
          />
        </div>

        {mutacao.isError && <Erro mensagem={mutacao.error.message} />}

        <Button type="submit" carregando={mutacao.isPending} disabled={senha.trim() === ''}>
          <KeyRound className="size-4" aria-hidden />
          Desbloquear
        </Button>
      </form>
    </Moldura>
  )
}

function FormularioPrimeiraSenha({ aoAbrir }: { aoAbrir: (senha: string) => void }) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  const mutacao = useMutation({
    mutationFn: (s: string) => definirSenhaAdmin(s),
    onSuccess: (_dados, s) => aoAbrir(s),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    setErroLocal(null)
    if (senha.length < 10) {
      setErroLocal('A senha deve ter ao menos 10 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErroLocal('As duas senhas não coincidem.')
      return
    }
    mutacao.mutate(senha)
  }

  return (
    <Moldura
      Icone={ShieldAlert}
      eyebrow="Configuração inicial"
      titulo="Defina a senha de administração"
      descricao="Ainda não existe senha de administração neste projeto. Defina-a agora: a partir daqui, criar acessos, redefinir senhas e suspender clientes passarão a exigi-la, além do login. Guarde-a — não há recuperação por e-mail."
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="nova-senha-admin">Nova senha (mínimo 10 caracteres)</Label>
          <Input
            id="nova-senha-admin"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirma-senha-admin">Repita a senha</Label>
          <Input
            id="confirma-senha-admin"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>

        {erroLocal !== null && <Erro mensagem={erroLocal} />}
        {mutacao.isError && <Erro mensagem={mutacao.error.message} />}

        <Button type="submit" carregando={mutacao.isPending}>
          <KeyRound className="size-4" aria-hidden />
          Definir e entrar
        </Button>
      </form>
    </Moldura>
  )
}
