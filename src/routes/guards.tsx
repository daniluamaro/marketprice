import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { EstadoErro, Skeleton } from '@/components/ui/estados'

/**
 * Portões em cascata (CLAUDE.md §7):
 *   autenticado  ->  ativo = true  ->  senha_provisoria = false  ->  dashboard
 * Cada um redireciona para a sua tela; nenhum dado do tenant e renderizado
 * antes do ultimo portão.
 */

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-95 space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    </div>
  )
}

/** Exige sessao valida. Nao opina sobre perfil. */
export function ExigeSessao() {
  const estado = useAuth((s) => s.estado)

  if (estado === 'carregando') return <TelaCarregando />
  if (estado === 'deslogado') return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * Tela de troca de senha. So faz sentido enquanto a senha for provisoria —
 * assim que deixa de ser, este portao devolve a pessoa ao dashboard.
 *
 * Sem esta saida a tela vira um beco sem saida: a troca conclui no servidor e
 * o usuario continua olhando o formulario, porque nenhuma regra de rota o
 * tirava dali.
 */
export function ExigeTrocaPendente() {
  const estado = useAuth((s) => s.estado)
  const perfil = useAuth((s) => s.perfil)

  if (estado === 'carregando') return <TelaCarregando />
  if (estado === 'deslogado') return <Navigate to="/login" replace />
  if (perfil === null || !perfil.ativo) return <Navigate to="/acesso-suspenso" replace />
  if (!perfil.senha_provisoria) return <Navigate to="/" replace />

  return <Outlet />
}

/**
 * Tela de acesso suspenso. Mesmo raciocinio ao contrario: reativado o acesso,
 * a pessoa nao pode continuar presa no aviso de bloqueio.
 */
export function ExigeBloqueio() {
  const estado = useAuth((s) => s.estado)
  const perfil = useAuth((s) => s.perfil)

  if (estado === 'carregando') return <TelaCarregando />
  if (estado === 'deslogado') return <Navigate to="/login" replace />
  if (perfil !== null && perfil.ativo) return <Navigate to="/" replace />

  return <Outlet />
}

/** Exige sessao + perfil ativo + senha ja trocada. Portao do dashboard. */
export function ExigeAcessoLiberado() {
  const estado = useAuth((s) => s.estado)
  const perfil = useAuth((s) => s.perfil)
  const erroPerfil = useAuth((s) => s.erroPerfil)
  const recarregarPerfil = useAuth((s) => s.recarregarPerfil)

  if (estado === 'carregando') return <TelaCarregando />
  if (estado === 'deslogado') return <Navigate to="/login" replace />

  // Falha de rede ao buscar o perfil nao e o mesmo que "sem acesso": tratar
  // como bloqueio faria um cliente pagante ver "acesso suspenso" por causa de
  // um wi-fi instavel.
  if (erroPerfil !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <EstadoErro
          titulo="Não foi possível verificar seu acesso"
          descricao="Houve uma falha de conexão ao carregar seu perfil."
          onTentarNovamente={() => void recarregarPerfil()}
        />
      </div>
    )
  }

  if (perfil === null || !perfil.ativo) return <Navigate to="/acesso-suspenso" replace />
  if (perfil.senha_provisoria) return <Navigate to="/definir-senha" replace />

  return <Outlet />
}

/** Seção de Administração. */
export function ExigeAdmin() {
  const perfil = useAuth((s) => s.perfil)
  if (perfil?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

/** Impede que um usuario ja logado fique preso na tela de login. */
export function SomenteDeslogado() {
  const estado = useAuth((s) => s.estado)

  if (estado === 'carregando') return <TelaCarregando />
  if (estado === 'pronto') return <Navigate to="/" replace />
  return <Outlet />
}
