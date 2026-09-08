/**
 * Espelho em JavaScript dos tokens definidos em `src/index.css` (@theme).
 *
 * Por que existe duplicacao: o ECharts desenha em canvas e precisa dos valores
 * como strings JS — ele nao enxerga variaveis CSS. Ler via getComputedStyle no
 * carregamento seria fragil (a folha de estilo pode nao estar aplicada ainda
 * quando o tema e registrado).
 *
 * REGRA: ao mudar uma cor, mude nos DOIS lugares. Este arquivo e a unica
 * excecao autorizada a "cores so no CSS".
 */
export const T = {
  base: '#080B14',
  panel: '#0F1524',
  elevated: '#141B2E',
  hover: '#1A2237',
  line: '#212A42',
  lineSoft: '#1A2237',

  gold: '#D4AF37',
  goldBright: '#F0CC5C',
  goldDim: '#8A7328',

  ink: '#EEF1F8',
  ink2: '#AAB3CA',
  ink3: '#8790A8',

  success: '#3DDC97',
  successTxt: '#7FECC0',
  danger: '#FF6B6B',
  dangerTxt: '#FF9E9E',
  warning: '#F0B429',
  warningTxt: '#F8CE6A',

  fontBody: "'Inter', ui-sans-serif, system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
} as const

/**
 * Paleta de series: o acento da marca primeiro, depois neutros frios que nao
 * competem com ele. Cor semantica (acima/abaixo do mercado) NAO sai daqui —
 * ela e aplicada ponto a ponto por cada grafico.
 */
export const PALETA_SERIES = [
  T.gold,
  '#5B8FF9',
  '#3DDC97',
  '#9B7BE0',
  '#F0B429',
  '#5AC8D8',
  '#E07B9B',
  '#8D96B0',
] as const
