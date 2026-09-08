import type { TomEtiqueta } from '@/components/ui/etiqueta'
import { T } from '@/lib/tokens'

/**
 * Indice de Posicionamento de Preco (IPP).
 *
 *   IPP = preco da loja no item / media de mercado do MESMO item x 100
 *
 *   100 = exatamente na media   ·   < 100 = mais barato   ·   > 100 = mais caro
 *
 * As faixas vivem aqui, num lugar so, porque a tabela e o heatmap precisam
 * classificar identicamente — se cada tela tivesse a sua copia, um dia a
 * mesma celula seria "alinhada" num lugar e "cara" no outro.
 *
 * Os intervalos sao semiabertos [de, ate) para nao existir valor sem faixa nem
 * valor em duas faixas.
 */

export interface FaixaIpp {
  rotulo: string
  tom: TomEtiqueta
  /** Cor usada no heatmap (canvas nao le classe CSS). */
  cor: string
}

const MUITO_COMPETITIVO: FaixaIpp = {
  rotulo: 'Muito competitivo',
  tom: 'ok',
  cor: T.success,
}
const COMPETITIVO: FaixaIpp = { rotulo: 'Competitivo', tom: 'ok', cor: T.successTxt }
const ALINHADO: FaixaIpp = { rotulo: 'Alinhado', tom: 'neutro', cor: T.ink3 }
const ACIMA: FaixaIpp = { rotulo: 'Acima do mercado', tom: 'alerta', cor: T.dangerTxt }
const MUITO_ACIMA: FaixaIpp = { rotulo: 'Muito acima', tom: 'critico', cor: T.danger }

export function faixaIpp(ipp: number | null): FaixaIpp | null {
  if (ipp === null || !Number.isFinite(ipp)) return null
  if (ipp < 90) return MUITO_COMPETITIVO
  if (ipp < 97) return COMPETITIVO
  if (ipp < 103) return ALINHADO
  if (ipp < 110) return ACIMA
  return MUITO_ACIMA
}

/** Ordem de leitura da legenda: do mais barato ao mais caro. */
export const FAIXAS_IPP: { faixa: FaixaIpp; descricao: string }[] = [
  { faixa: MUITO_COMPETITIVO, descricao: 'abaixo de 90' },
  { faixa: COMPETITIVO, descricao: '90 a 97' },
  { faixa: ALINHADO, descricao: '97 a 103' },
  { faixa: ACIMA, descricao: '103 a 110' },
  { faixa: MUITO_ACIMA, descricao: 'acima de 110' },
]

/** "94,3" — o IPP tem uma casa decimal e vive em fonte mono. */
export function fmtIpp(ipp: number | null): string {
  if (ipp === null || !Number.isFinite(ipp)) return '—'
  return ipp.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}
