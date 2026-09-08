import { create } from 'zustand'

/**
 * Senha de administracao da sessao corrente.
 *
 * SOMENTE EM MEMORIA, e isso e o ponto do arquivo. Nao usa `persist`, nao toca
 * localStorage nem sessionStorage: qualquer um dos dois deixaria a senha legivel
 * para um script injetado na pagina, e o objetivo aqui e justamente proteger
 * contra sessao comprometida. Fechar a aba ou recarregar apaga — e a tela pede
 * de novo, que e o comportamento combinado ("a cada sessao").
 *
 * O valor guardado nunca decide nada sozinho: ele so viaja para a Edge Function,
 * que e quem confere. Se alguem alterar este estado pelo devtools, o servidor
 * continua recusando.
 */
interface AdminSessao {
  senha: string | null
  desbloqueada: boolean
  desbloquear: (senha: string) => void
  bloquear: () => void
}

export const useAdminSessao = create<AdminSessao>((set) => ({
  senha: null,
  desbloqueada: false,
  desbloquear: (senha) => set({ senha, desbloqueada: true }),
  bloquear: () => set({ senha: null, desbloqueada: false }),
}))

/** Leitura fora de componente (usada pelo cliente de `admin-users`). */
export function senhaAdminAtual(): string | null {
  return useAdminSessao.getState().senha
}
