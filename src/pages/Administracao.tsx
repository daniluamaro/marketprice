import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Pencil, Plus, Power, X } from 'lucide-react'
import {
  alternarAtivo,
  atualizarUsuario,
  criarUsuario,
  listarUsuarios,
  resetarSenha,
  type UsuarioAdmin,
} from '@/lib/adminUsers'
import { useAuth, type Papel } from '@/store/auth'
import { fmtCnpj, fmtData, fmtPlano } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EstadoErro, EstadoVazio, Skeleton } from '@/components/ui/estados'
import { Etiqueta } from '@/components/ui/etiqueta'
import { Secao } from '@/components/ui/secao'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'

interface SenhaRevelada {
  email: string
  senha: string
  motivo: 'criado' | 'resetado'
}

/** A senha provisoria aparece UMA vez. Depois disso nem o admin a recupera. */
function PainelSenha({
  info,
  onFechar,
}: {
  info: SenhaRevelada
  onFechar: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(info.senha)
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mb-5 rounded-card border border-gold/30 bg-gold/7 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-gold-bright">
            {info.motivo === 'criado' ? 'Acesso criado' : 'Senha redefinida'}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
            Repasse esta senha provisória a{' '}
            <span className="text-ink">{info.email}</span> por fora do sistema. Ela
            não será exibida novamente, e a troca é obrigatória no primeiro acesso.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="num rounded-chip border border-line bg-elevated px-3 py-2 text-[14px] font-bold tracking-[1px] text-ink">
              {info.senha}
            </code>
            <Button variant="outline" size="sm" onClick={() => void copiar()}>
              {copiado ? (
                <Check className="size-3.5 text-success-txt" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
        <button
          onClick={onFechar}
          className="shrink-0 rounded-chip p-1.5 text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          aria-label="Fechar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function FormularioNovo({
  onCriado,
  onCancelar,
}: {
  onCriado: (info: SenhaRevelada) => void
  onCancelar: () => void
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [nome, setNome] = useState('')
  const [plano, setPlano] = useState('padrao')
  const [papel, setPapel] = useState<'user' | 'admin'>('user')

  const mutacao = useMutation({
    mutationFn: criarUsuario,
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
      onCriado({ email: res.email, senha: res.senha_provisoria, motivo: 'criado' })
    },
  })

  const digitosCnpj = cnpj.replace(/\D/g, '')
  const valido = email.trim() !== '' && digitosCnpj.length === 14

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    mutacao.mutate({
      email: email.trim(),
      cnpj_contratante: digitosCnpj,
      nome_contratante: nome.trim() === '' ? null : nome.trim(),
      role: papel,
      plano,
    })
  }

  return (
    <form
      onSubmit={enviar}
      className="mb-5 rounded-card border border-line bg-elevated px-5 py-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-email">E-mail</Label>
          <Input
            id="novo-email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@empresa.com.br"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-cnpj">CNPJ contratante</Label>
          <Input
            id="novo-cnpj"
            inputMode="numeric"
            required
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00000000000000"
            className="num"
          />
          {digitosCnpj.length > 0 && digitosCnpj.length !== 14 && (
            <p className="text-[11.5px] text-warning-txt">
              O CNPJ precisa ter 14 dígitos ({digitosCnpj.length} informados).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-nome">Nome do contratante</Label>
          <Input
            id="novo-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da empresa"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="novo-plano">Plano</Label>
            <Input
              id="novo-plano"
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="novo-papel">Papel</Label>
            <select
              id="novo-papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value === 'admin' ? 'admin' : 'user')}
              className="h-11 rounded-card border border-line bg-elevated px-3 text-[14px] text-ink focus:border-gold/50 focus:outline-none"
            >
              <option value="user">Cliente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
      </div>

      {mutacao.isError && (
        <p
          role="alert"
          className="mt-4 rounded-chip border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger-txt"
        >
          {mutacao.error.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2.5">
        <Button type="submit" carregando={mutacao.isPending} disabled={!valido}>
          Criar acesso
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function FormularioEdicao({
  usuario,
  onSalvo,
  onCancelar,
}: {
  usuario: UsuarioAdmin
  onSalvo: () => void
  onCancelar: () => void
}) {
  const queryClient = useQueryClient()
  const meuId = useAuth((s) => s.perfil?.id ?? null)

  const [cnpj, setCnpj] = useState(usuario.cnpj_contratante)
  const [nome, setNome] = useState(usuario.nome_contratante ?? '')
  const [plano, setPlano] = useState(usuario.plano ?? 'padrao')
  const [papel, setPapel] = useState<Papel>(usuario.role)

  const mutacao = useMutation({
    mutationFn: atualizarUsuario,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
      onSalvo()
    },
  })

  const digitosCnpj = cnpj.replace(/\D/g, '')
  const valido = digitosCnpj.length === 14
  const souEu = usuario.id === meuId

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    mutacao.mutate({
      id: usuario.id,
      cnpj_contratante: digitosCnpj,
      nome_contratante: nome.trim() === '' ? null : nome.trim(),
      role: papel,
      plano,
    })
  }

  return (
    <form
      onSubmit={enviar}
      className="mb-5 rounded-card border border-gold/25 bg-elevated px-5 py-5"
    >
      <p className="mb-4 text-[10.5px] font-bold uppercase tracking-[1.2px] text-gold-bright">
        Editando · {usuario.email}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ed-cnpj">CNPJ contratante</Label>
          <Input
            id="ed-cnpj"
            inputMode="numeric"
            required
            autoFocus
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="num"
          />
          {digitosCnpj.length !== 14 && (
            <p className="text-[11.5px] text-warning-txt">
              O CNPJ precisa ter 14 dígitos ({digitosCnpj.length} informados).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ed-nome">Nome do contratante</Label>
          <Input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ed-plano">Plano</Label>
          <Input id="ed-plano" value={plano} onChange={(e) => setPlano(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ed-papel">Papel</Label>
          <select
            id="ed-papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value === 'admin' ? 'admin' : 'user')}
            disabled={souEu}
            className="h-11 rounded-card border border-line bg-elevated px-3 text-[14px] text-ink focus:border-gold/50 focus:outline-none disabled:opacity-50"
          >
            <option value="user">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
          {souEu && (
            <p className="text-[11.5px] text-ink-3">
              Você não pode alterar o próprio papel.
            </p>
          )}
        </div>
      </div>

      {mutacao.isError && (
        <p
          role="alert"
          className="mt-4 rounded-chip border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger-txt"
        >
          {mutacao.error.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2.5">
        <Button type="submit" carregando={mutacao.isPending} disabled={!valido}>
          Salvar alterações
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

export default function Administracao() {
  const queryClient = useQueryClient()
  const meuId = useAuth((s) => s.perfil?.id ?? null)

  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)
  const [senha, setSenha] = useState<SenhaRevelada | null>(null)

  const consulta = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: listarUsuarios,
  })

  const mutAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      alternarAtivo(id, ativo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] }),
  })

  const mutSenha = useMutation({
    mutationFn: ({ id }: { id: string; email: string }) => resetarSenha(id),
    onSuccess: (res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setSenha({ email: vars.email, senha: res.senha_provisoria, motivo: 'resetado' })
    },
  })

  const usuarios: UsuarioAdmin[] = consulta.data?.usuarios ?? []
  const erroAcao = mutAtivo.error ?? mutSenha.error

  return (
    <Secao
      eyebrow="Gestão"
      titulo="Administração de acessos"
      descricao="Cada acesso enxerga apenas os dados do próprio CNPJ. Desativar um acesso revoga a entrada imediatamente, sem excluir o histórico."
      acessorio={
        criando ? undefined : (
          <Button onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden />
            Novo acesso
          </Button>
        )
      }
    >
      <div>
        {senha !== null && (
          <PainelSenha info={senha} onFechar={() => setSenha(null)} />
        )}

        {criando && (
          <FormularioNovo
            onCriado={(info) => {
              setSenha(info)
              setCriando(false)
            }}
            onCancelar={() => setCriando(false)}
          />
        )}

        {editando !== null && (
          <FormularioEdicao
            key={editando.id}
            usuario={editando}
            onSalvo={() => setEditando(null)}
            onCancelar={() => setEditando(null)}
          />
        )}

        {erroAcao && (
          <p
            role="alert"
            className="mb-5 rounded-chip border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger-txt"
          >
            {erroAcao.message}
          </p>
        )}

        {consulta.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {consulta.isError && (
          <EstadoErro
            titulo="Não foi possível carregar os acessos"
            descricao={consulta.error.message}
            onTentarNovamente={() => void consulta.refetch()}
          />
        )}

        {consulta.isSuccess && usuarios.length === 0 && (
          <EstadoVazio
            titulo="Nenhum acesso cadastrado"
            descricao="Crie o primeiro acesso para liberar a plataforma a um cliente."
          />
        )}

        {consulta.isSuccess && usuarios.length > 0 && (
          <Tabela>
            <thead>
              <tr>
                <Th>Contratante</Th>
                <Th numerica>CNPJ</Th>
                <Th>Papel</Th>
                <Th>Plano</Th>
                <Th>Estado</Th>
                <Th numerica>Criado</Th>
                <Th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const souEu = u.id === meuId
                return (
                  <Tr key={u.id}>
                    <Td>
                      <p className="font-semibold text-ink">
                        {u.nome_contratante ?? '—'}
                        {souEu && (
                          <span className="ml-2 text-[10px] font-normal text-gold-bright">
                            você
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-ink-3">{u.email}</p>
                    </Td>

                    <Td numerica>{fmtCnpj(u.cnpj_contratante)}</Td>

                    <Td>
                      <Etiqueta tom={u.role === 'admin' ? 'marca' : 'neutro'}>
                        {u.role === 'admin' ? 'ADMIN' : 'CLIENTE'}
                      </Etiqueta>
                    </Td>

                    <Td>{fmtPlano(u.plano)}</Td>

                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Etiqueta tom={u.ativo ? 'ok' : 'critico'}>
                          {u.ativo ? 'ATIVO' : 'SUSPENSO'}
                        </Etiqueta>
                        {u.senha_provisoria && (
                          <Etiqueta tom="alerta">SENHA PROVISÓRIA</Etiqueta>
                        )}
                      </div>
                    </Td>

                    <Td numerica className="text-ink-3">
                      {fmtData(u.created_at)}
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCriando(false)
                            setEditando(u)
                          }}
                          title="Editar nome, CNPJ, papel e plano"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => mutSenha.mutate({ id: u.id, email: u.email })}
                          carregando={
                            mutSenha.isPending && mutSenha.variables?.id === u.id
                          }
                          title="Gerar nova senha provisória"
                        >
                          <KeyRound className="size-3.5" aria-hidden />
                          Senha
                        </Button>
                        <Button
                          variant={u.ativo ? 'danger' : 'outline'}
                          size="sm"
                          disabled={souEu}
                          onClick={() => mutAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                          carregando={
                            mutAtivo.isPending && mutAtivo.variables?.id === u.id
                          }
                          title={
                            souEu ? 'Você não pode desativar o próprio acesso' : undefined
                          }
                        >
                          <Power className="size-3.5" aria-hidden />
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </div>
    </Secao>
  )
}
