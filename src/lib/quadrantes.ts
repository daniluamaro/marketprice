import type { Quadrante } from '@/lib/rpc'
import type { TomEtiqueta } from '@/components/ui/etiqueta'
import { T } from '@/lib/tokens'

/**
 * Os quatro quadrantes da matriz Preco x Dispersao, em um lugar so.
 *
 * Mesma razao de `lib/ipp.ts`: a cor do ponto no grafico, a cor da area de
 * fundo, o rotulo da legenda e a etiqueta da tabela precisam concordar. Com a
 * definicao espalhada, a primeira mudanca de cor deixa a legenda mentindo.
 *
 * A classificacao em si NAO mora aqui — ela vem pronta do Postgres
 * (rpc_matriz_preco_dispersao), porque quem calcula os cortes tem que ser quem
 * decide o lado da linha. Este arquivo so traduz o rotulo tecnico para a
 * interface.
 */
export interface DefinicaoQuadrante {
  id: Quadrante
  /** Titulo curto, o que aparece na legenda. */
  rotulo: string
  /** A condicao que define o quadrante. */
  criterio: string
  /** O que fazer com um produto que cai aqui. */
  leitura: string
  cor: string
  /** Mesma cor com alfa baixissimo: tinge o quadrante sem competir com o ponto. */
  fundo: string
  tom: TomEtiqueta
}

export const QUADRANTES: Record<Quadrante, DefinicaoQuadrante> = {
  oportunidade: {
    id: 'oportunidade',
    rotulo: 'Grande oportunidade',
    criterio: 'preço alto e dispersão alta',
    leitura:
      'Item caro que cada loja precifica de um jeito. É onde uma negociação ou um ajuste de posicionamento rende mais.',
    cor: T.danger,
    fundo: 'rgba(255,107,107,0.07)',
    tom: 'critico',
  },
  caro_estavel: {
    id: 'caro_estavel',
    rotulo: 'Caro e estável',
    criterio: 'preço alto e dispersão baixa',
    leitura:
      'O mercado inteiro cobra caro e concorda com o preço. Margem existe, mas mexer nele isola a loja.',
    cor: T.warning,
    fundo: 'rgba(240,180,41,0.06)',
    tom: 'alerta',
  },
  competitivo: {
    id: 'competitivo',
    rotulo: 'Mercado competitivo',
    criterio: 'preço baixo e dispersão alta',
    leitura:
      'Item barato com guerra de preço em curso. Acompanhe de perto: a posição muda rápido.',
    cor: T.success,
    fundo: 'rgba(61,220,151,0.06)',
    tom: 'ok',
  },
  consolidado: {
    id: 'consolidado',
    rotulo: 'Preço consolidado',
    criterio: 'preço baixo e dispersão baixa',
    leitura:
      'Preço baixo e igual em todo lugar. Pouco a ganhar mexendo aqui — é o piso do mercado.',
    cor: '#5B8FF9',
    fundo: 'rgba(91,143,249,0.06)',
    tom: 'neutro',
  },
}

/** Ordem de leitura da legenda: do que exige acao para o que nao exige. */
export const ORDEM_QUADRANTES: Quadrante[] = [
  'oportunidade',
  'competitivo',
  'caro_estavel',
  'consolidado',
]
