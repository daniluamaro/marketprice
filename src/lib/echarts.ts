/**
 * Tema custom do ECharts — CLAUDE.md §10.5.
 *
 * Sem isto os graficos saem com as cores default do ECharts (aquele azul/verde
 * de tutorial) e denunciam o produto na hora. O tema consome os mesmos tokens
 * do resto da interface.
 *
 * Registra tambem apenas os modulos usados: o import completo do echarts
 * adiciona cerca de 1 MB ao bundle sem necessidade.
 */
import * as echarts from 'echarts/core'
import {
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { PALETA_SERIES, T } from '@/lib/tokens'

// ATENCAO: um tipo de serie NAO registrado aqui e descartado em silencio — o
// grafico renderiza sem ela, sem erro no console. Foi o que aconteceu com o
// ScatterChart (o losango da media na tela de Amplitude): a serie existia na
// option e simplesmente nao aparecia. Ao usar um tipo novo, registre-o aqui.
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  BoxplotChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  MarkLineComponent,
  // Sem MarkArea a matriz de quadrantes perde as faixas de fundo e vira um
  // grafico de dispersao qualquer — de novo, sem erro nenhum no console.
  MarkAreaComponent,
  // O heatmap depende do VisualMap para colorir as celulas; sem ele o grafico
  // renderiza a grade inteira de uma cor so, sem erro nenhum no console.
  VisualMapComponent,
  CanvasRenderer,
])

export const TEMA = 'performar'

const eixoBase = {
  axisLine: { show: true, lineStyle: { color: T.line } },
  axisTick: { show: false },
  axisLabel: { color: T.ink3, fontSize: 11, fontFamily: T.fontBody },
  splitLine: { show: true, lineStyle: { color: T.lineSoft, width: 1 } },
  splitArea: { show: false },
}

echarts.registerTheme(TEMA, {
  color: [...PALETA_SERIES],
  backgroundColor: 'transparent',

  textStyle: { fontFamily: T.fontBody, color: T.ink2 },

  title: {
    textStyle: { color: T.ink, fontFamily: "'Manrope', sans-serif", fontWeight: 800 },
    subtextStyle: { color: T.ink3 },
  },

  grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },

  // Eixo de categoria nao leva splitLine: linha por rotulo vira grade suja.
  categoryAxis: { ...eixoBase, splitLine: { show: false } },
  valueAxis: eixoBase,
  logAxis: eixoBase,
  timeAxis: eixoBase,

  legend: {
    textStyle: { color: T.ink2, fontSize: 11.5, fontFamily: T.fontBody },
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
  },

  tooltip: {
    backgroundColor: T.elevated,
    borderColor: T.line,
    borderWidth: 1,
    padding: [10, 12],
    extraCssText:
      'border-radius:10px; box-shadow:0 18px 40px -20px rgba(0,0,0,.9); backdrop-filter:blur(4px);',
    textStyle: { color: T.ink, fontSize: 12, fontFamily: T.fontBody },
    axisPointer: {
      type: 'line',
      lineStyle: { color: T.line, width: 1 },
      crossStyle: { color: T.line },
    },
  },

  bar: {
    itemStyle: { borderRadius: [3, 3, 0, 0] },
    barMaxWidth: 34,
  },

  line: {
    symbol: 'circle',
    symbolSize: 5,
    smooth: false,
    lineStyle: { width: 2 },
  },

  // Animacao curta e sobria (§10.5). Movimento longo em dashboard cansa.
  animationDuration: 320,
  animationEasing: 'cubicOut',
})

export default echarts
