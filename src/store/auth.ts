import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Papel = 'user' | 'admin'

export interface Perfil {
  id: string
  email: string
  cnpj_contratante: string
  /** A EMPRESA dona do CNPJ. E ela que identifica o tenant na interface. */
  nome_empresa: string | null
  /** A PESSOA que usa este acesso. Aparece ao lado do e-mail, no topo. */
  nome_contratante: string | null
  role: Papel
  ativo: boolean
  plano: string | null
  senha_provisoria: boolean
}

/**
 * carregando — ainda restaurando sessao/perfil; nao decida rota ainda.
 * deslogado  — sem sessao valida.
 * pronto     — sessao resolvida (com ou sem perfil; ver `perfil`).
 */
export type EstadoAuth = 'carregando' | 'deslogado' | 'pronto'

interface AuthStore {
  estado: EstadoAuth
  session: Session | null
  perfil: Perfil | null
  erroPerfil: string | null

  iniciar: () => void
  recarregarPerfil: () => Promise<void>
  marcarSenhaDefinitiva: () => void
  sair: () => Promise<void>
}

const COLUNAS_PERFIL =
  'id, email, cnpj_contratante, nome_empresa, nome_contratante, role, ativo, plano, senha_provisoria'

async function buscarPerfil(
  userId: string,
): Promise<{ perfil: Perfil | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUNAS_PERFIL)
    .eq('id', userId)
    .maybeSingle<Perfil>()

  if (error) {
    // Erro de rede/servidor e diferente de "usuario sem perfil": o primeiro
    // merece uma tela de "tentar de novo", o segundo e bloqueio de acesso.
    return { perfil: null, erro: error.message }
  }
  return { perfil: data, erro: null }
}

// React monta duas vezes em StrictMode; a assinatura do onAuthStateChange
// precisa existir uma unica vez.
let inscrito = false

export const useAuth = create<AuthStore>((set, get) => ({
  estado: 'carregando',
  session: null,
  perfil: null,
  erroPerfil: null,

  iniciar: () => {
    if (inscrito) return
    inscrito = true

    const aplicar = async (session: Session | null): Promise<void> => {
      if (!session) {
        set({ estado: 'deslogado', session: null, perfil: null, erroPerfil: null })
        return
      }
      const { perfil, erro } = await buscarPerfil(session.user.id)
      set({ estado: 'pronto', session, perfil, erroPerfil: erro })
    }

    void supabase.auth.getSession().then(({ data }) => aplicar(data.session))

    supabase.auth.onAuthStateChange((evento, session) => {
      // Nenhum destes dois eventos troca a identidade do usuario, entao o
      // perfil em memoria continua valendo e so a sessao e atualizada.
      //
      // TOKEN_REFRESHED: refazer o fetch a cada renovacao de token seria
      // trafego inutil de hora em hora.
      //
      // USER_UPDATED: alem de inutil, era ATIVAMENTE NOCIVO. Ele dispara no
      // meio da troca de senha, logo apos updateUser() e ANTES de
      // rpc_confirmar_troca_senha() gravar senha_provisoria = false. O fetch
      // disparado por ele lia o valor antigo (true) e, se a resposta chegasse
      // depois da confirmacao, sobrescrevia o estado correto e jogava o
      // usuario de volta para a tela de trocar senha.
      if ((evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED') && get().perfil) {
        set({ session })
        return
      }
      void aplicar(session)
    })
  },

  recarregarPerfil: async () => {
    const { session } = get()
    if (!session) return
    set({ erroPerfil: null })
    const { perfil, erro } = await buscarPerfil(session.user.id)
    set({ perfil, erroPerfil: erro })
  },

  /** Otimista, logo apos rpc_confirmar_troca_senha() responder OK. */
  marcarSenhaDefinitiva: () => {
    const { perfil } = get()
    if (perfil) set({ perfil: { ...perfil, senha_provisoria: false } })
  },

  sair: async () => {
    await supabase.auth.signOut()
    set({ estado: 'deslogado', session: null, perfil: null, erroPerfil: null })
  },
}))
