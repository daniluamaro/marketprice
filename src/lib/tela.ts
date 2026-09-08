import { useEffect, useState } from 'react'

/**
 * Helpers de apresentacao compartilhados entre os relatorios.
 *
 * Estavam dentro de VisaoGeral.tsx; com sete telas usando as mesmas regras de
 * eixo e truncagem, manter uma copia por pagina garantiria que elas divergissem.
 */

/**
 * Em tela estreita o rotulo do eixo nao pode ter largura fixa: com 190px num
 * viewport de 390px sobra quase nada para a barra, e o grafico deixa de
 * comunicar a comparacao que e o proprio motivo dele existir.
 */
export function useTelaEstreita(limite = 720): boolean {
  const [estreita, setEstreita] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < limite,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${limite - 1}px)`)
    const aoMudar = () => setEstreita(mq.matches)
    aoMudar()
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [limite])
  return estreita
}

/** Nome longo de loja/produto cortado com reticencia, para caber no eixo. */
export function encurtar(nome: string | null, max = 28): string {
  if (nome === null || nome === '') return 'Sem nome'
  return nome.length <= max ? nome : `${nome.slice(0, max - 1)}…`
}
