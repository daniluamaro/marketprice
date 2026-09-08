import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/store/auth'

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
async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body })

  if (error) {
    // A funcao devolve { error: "mensagem em pt-BR" } com status != 2xx; sem
    // isto o usuario veria apenas "Edge Function returned a non-2xx status".
    if (error instanceof FunctionsHttpError) {
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

export function listarUsuarios(): Promise<{ usuarios: UsuarioAdmin[] }> {
  return chamar({ action: 'listar' })
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
