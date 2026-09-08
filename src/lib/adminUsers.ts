import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { senhaAdminAtual } from '@/store/adminSessao'
import type { Papel } from '@/store/auth'

/**
 * Erro especifico de "a senha de administracao ainda nao existe neste projeto".
 * Merece um tipo proprio porque a tela reage a ele de forma diferente: em vez
 * de pedir a senha, oferece a definicao inicial.
 */
export class SenhaAdminNaoConfigurada extends Error {
  constructor() {
    super('Senha de administração ainda não foi configurada.')
    this.name = 'SenhaAdminNaoConfigurada'
  }
}

export interface UsuarioAdmin {
  id: string
  email: string
  cnpj_contratante: string
  nome_contratante: string | null
  role: Papel
  ativo: boolean
  plano: string | null
  senha_provisoria: boolean
  created_at: string
}

/**
 * Toda operacao privilegiada passa pela Edge Function `admin-users`.
 * O frontend nunca tem a service_role — ele so pede, e o servidor decide.
 */
/**
 * Variante que recebe a senha explicitamente, para os dois momentos em que ela
 * ainda nao esta no store: o destravamento e a definicao/troca da senha.
 */
async function chamarComSenha<T>(
  body: Record<string, unknown>,
  senha: string | null,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', {
    body: senha === null ? body : { ...body, senha_admin: senha },
  })

  if (error) {
    // A funcao devolve { error: "mensagem em pt-BR" } com status != 2xx; sem
    // isto o usuario veria apenas "Edge Function returned a non-2xx status".
    if (error instanceof FunctionsHttpError) {
      // 428 = "ainda nao configurada". E um estado do sistema, nao um erro do
      // usuario, e a tela precisa distingui-lo para oferecer a criacao.
      if (error.context.status === 428) throw new SenhaAdminNaoConfigurada()
      try {
        const corpo = (await error.context.json()) as { error?: string }
        if (corpo.error) throw new Error(corpo.error)
      } catch (e) {
        if (e instanceof Error && e.message !== '') throw e
      }
    }
    throw new Error('Não foi possível concluir a operação. Tente novamente.')
  }

  if (data === null) throw new Error('Resposta vazia do servidor.')
  return data
}

/**
 * Chamada padrao: a senha da sessao acompanha TODA operacao, nao apenas o
 * destravamento. A trava da tela e conveniencia; a garantia e o servidor
 * conferir de novo a cada acao — inclusive se alguem pular a interface.
 */
function chamar<T>(body: Record<string, unknown>): Promise<T> {
  return chamarComSenha<T>(body, senhaAdminAtual())
}

export function listarUsuarios(): Promise<{ usuarios: UsuarioAdmin[] }> {
  return chamar({ action: 'listar' })
}

/** Ja existe senha de administracao neste projeto? Nao exige a senha. */
export function estadoSeguranca(): Promise<{ configurada: boolean }> {
  return chamar({ action: 'estado_seguranca' })
}

/**
 * Confere a senha antes de liberar a tela. Recebe a senha como argumento em vez
 * de ler do store porque, neste momento, ela ainda nao foi guardada — so entra
 * no store se o servidor aprovar.
 */
export async function desbloquearAdmin(senha: string): Promise<void> {
  await chamarComSenha({ action: 'desbloquear' }, senha)
}

/** Define a primeira senha ou troca a existente (exige a atual na troca). */
export async function definirSenhaAdmin(
  novaSenha: string,
  senhaAtual?: string,
): Promise<{ ok: true; primeira_definicao: boolean }> {
  return chamarComSenha(
    { action: 'definir_senha_admin', nova_senha_admin: novaSenha },
    senhaAtual ?? null,
  )
}

export function criarUsuario(dados: {
  email: string
  cnpj_contratante: string
  nome_contratante: string | null
  role: Papel
  plano: string | null
}): Promise<{ id: string; email: string; senha_provisoria: string }> {
  return chamar({ action: 'criar', ...dados })
}

export function atualizarUsuario(dados: {
  id: string
  cnpj_contratante?: string
  nome_contratante?: string | null
  role?: Papel
  plano?: string | null
}): Promise<{ ok: true }> {
  return chamar({ action: 'atualizar', ...dados })
}

export function resetarSenha(id: string): Promise<{ senha_provisoria: string }> {
  return chamar({ action: 'resetar_senha', id })
}

export function alternarAtivo(id: string, ativo: boolean): Promise<{ ok: true }> {
  return chamar({ action: 'alternar_ativo', id, ativo })
}

export function excluirUsuario(id: string): Promise<{ ok: true }> {
  return chamar({ action: 'excluir', id })
}
