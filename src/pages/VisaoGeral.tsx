import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { ArrowDownRight, ArrowUpRight, Target } from 'lucide-react'
import {
  buscarCategorias,
  buscarDispersao,
  buscarDistribuicao,
  buscarEvolucaoMercado,
  buscarFrequenciaDimensao,
  buscarFrequenciaProduto,
  buscarIndiceGeografico,
  buscarKpis,
  buscarRanking,
  type DimensaoFrequencia,
} from '@/lib/rpc'
import { chaveCache, useFiltros, type Filtros } from '@/store/filtros'
import { useAuth } from '@/store/auth'
import {
  fmtData,
  fmtDataHora,
  fmtInteiro,
  fmtMoeda,
  fmtPercent,
  num,
} from '@/lib/format'
import { CardKpi, GradeKpi } from '@/components/ui/kpi'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Grafico } from '@/components/ui/Grafico'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { Etiqueta } from '@/components/ui/etiqueta'
import { BarraInline } from '@/components/ui/barra'
import { Skeleton } from '@/components/ui/estados'
import { encurtar, useTelaEstreita } from '@/lib/tela'
import { T } from '@/lib/tokens'

/**
 * As tres quebras do giro por NFC-e. O rotulo no plural porque e assim que ele
 * aparece no seletor.
 */
const DIMENSOES: { id: DimensaoFrequencia; rotulo: string }[] = [
  { id: 'estabelecimento', rotulo: 'Estabelecimento' },
  { id: 'cidade', rotulo: 'Cidade' },
  { id: 'bairro', rotulo: 'Bairro' },
]

/**
 * Teto de pares (produto x local) trazidos do servidor. Precisa ser uma
 * constante compartilhada: quando o retorno bate neste numero, a lista veio
 * cortada e a interface NAO pode anunciar "de 300" como se fosse o total.
 */
const LIMITE_DIM = 300

/** Seletor segmentado — um grupo de radio, nao tres botoes soltos. */
function SeletorDimensao({
  valor,
  aoTrocar,
}: {
  valor: DimensaoFrequencia
  aoTrocar: (d: DimensaoFrequencia) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Quebrar o giro por"
      className="inline-flex rounded-chip border border-line bg-elevated p-0.5"
    >
      {DIMENSOES.map((d) => {
        const ativo = d.id === valor
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoTrocar(d.id)}
            className={`rounded-chip px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
              ativo
                ? 'bg-gold/12 text-gold-bright'
                : 'text-ink-2 hover:bg-hover hover:text-ink'
            }`}
          >
            {d.rotulo}
          </button>
        )
      })}
    </div>
  )
}

/** Cartao de leitura: um numero grande com a frase que explica o que fazer. */
function Destaque({
  Icone,
  eyebrow,
  titulo,
  valor,
  tom,
  descricao,
}: {
  Icone: typeof Target
  eyebrow: string
  titulo: string
  valor: string
  tom: 'bom' | 'ruim' | 'atencao'
  descricao: ReactNode
}) {
  const cor =
    tom === 'bom'
      ? 'text-success-txt'
      : tom === 'ruim'
        ? 'text-danger-txt'
        : 'text-warning-txt'

  return (
    <div className="flex flex-col rounded-card border border-line-soft bg-panel px-5 py-5">
      <div className="flex items-center gap-2">
        <Icone className={`size-4 ${cor}`} aria-hidden />
        <p className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-gold">
          {eyebrow}
        </p>
      </div>
      <p className="mt-3 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">
        {titulo}
      </p>
      <p className={`num mt-2 text-[24px] font-bold leading-none ${cor}`}>{valor}</p>
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-2">{descricao}</p>
    </div>
  )
}

export default function VisaoGeral() {
  const estreita = useTelaEstreita()
  const filtros = useFiltros()
  // Contexto do cabecalho e a EMPRESA, nao a pessoa: o recorte de dados
  // pertence ao CNPJ.
  const nomeContratante = useAuth((s) => s.perfil?.nome_empresa ?? null)
  const chave = chaveCache(filtros)

  const f: Filtros = filtros

  const kpis = useQuery({ queryKey: ['kpis', chave], queryFn: () => buscarKpis(f) })
  // 40 e nao 10: a mesma consulta alimenta DOIS graficos — o de amplitude, que
  // so quer o topo, e o de preco medio por produto, que quer o catalogo todo.
  // Uma consulta a mais so para reordenar as mesmas linhas seria desperdicio.
  const dispersao = useQuery({
    queryKey: ['dispersao', chave],
    queryFn: () => buscarDispersao(f, 40),
  })
  // minProdutos: 1 — um unico produto em comum ja basta para entrar no
  // comparativo. E o que faz o grafico virar a dispersao de preco do item
  // quando a pessoa filtra um EAN so; com o corte antigo (3) a selecao de um
  // produto zerava o grafico, justamente no momento em que ele era mais util.
  const ranking = useQuery({
    queryKey: ['ranking', chave],
    queryFn: () => buscarRanking(f, { minProdutos: 1 }),
  })
  // Esta consulta nao alimenta mais nenhum grafico — o de tendencia saiu da
  // tela. Ela permanece porque e a unica fonte da PRIMEIRA data com coleta
  // dentro do recorte filtrado (rpc_kpis so devolve a ultima), e e ela que
  // monta o "03/09/2026 – 06/09/2026" do cabecalho.
  const evolucao = useQuery({
    queryKey: ['evolucao-mercado', chave],
    queryFn: () => buscarEvolucaoMercado(f),
  })
  const categorias = useQuery({
    queryKey: ['categorias', chave],
    queryFn: () => buscarCategorias(f),
  })
  // Mesma razao do ranking: com um EAN filtrado, cada regiao tem exatamente um
  // produto — exigir dois deixaria esta tabela vazia sem motivo aparente.
  const distribuicao = useQuery({
    queryKey: ['distribuicao', chave],
    queryFn: () => buscarDistribuicao(f, 12),
  })
  const geo = useQuery({
    queryKey: ['indice-geo', chave],
    queryFn: () => buscarIndiceGeografico(f, 1),
  })

  const [dimensao, setDimensao] = useState<DimensaoFrequencia>('estabelecimento')

  const frequencia = useQuery({
    queryKey: ['frequencia-produto', chave],
    queryFn: () => buscarFrequenciaProduto(f),
  })
  const frequenciaDim = useQuery({
    queryKey: ['frequencia-dimensao', chave, dimensao],
    queryFn: () => buscarFrequenciaDimensao(f, dimensao, LIMITE_DIM),
  })

  const k = kpis.data ?? null
  const linhasDispersao = dispersao.data ?? []
  const linhasRanking = ranking.data ?? []
  const pontos = evolucao.data ?? []
  const linhasCategoria = categorias.data ?? []
  const linhasGeo = geo.data ?? []
  const faixas = distribuicao.data ?? []

  // ---------------------------------------------------------------- destaques
  const maiorOportunidade = linhasDispersao[0] ?? null
  const maisBarata = linhasRanking[0] ?? null
  const maisCara =
    linhasRanking.length > 1 ? (linhasRanking[linhasRanking.length - 1] ?? null) : null

  // A RPC ja devolve ordenado por amplitude decrescente, entao o topo da lista
  // e a resposta de "onde mais vale olhar".
  const dispersaoTop = useMemo(() => linhasDispersao.slice(0, 10), [linhasDispersao])

  // ------------------------------------------------------- grafico: amplitude
  const opAmplitude = useMemo<EChartsOption>(() => {
    const dados = [...dispersaoTop].reverse()
    return {
      grid: { left: 8, right: estreita ? 44 : 60, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        splitNumber: estreita ? 3 : 6,
        axisLabel: { formatter: (v: number | string) => `${v}%` },
      },
      yAxis: {
        type: 'category',
        data: dados.map((l) => encurtar(l.nome_exibicao, estreita ? 16 : 30)),
        axisLabel: {
          width: estreita ? 92 : 200,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const l = dados[i]
          if (!l) return ''
          return [
            `<b>${l.nome_exibicao ?? 'Sem nome'}</b>`,
            `Amplitude: ${fmtPercent(l.amplitude_pct)}`,
            `Mínimo: ${fmtMoeda(l.preco_min)} · Máximo: ${fmtMoeda(l.preco_max)}`,
            `Médio: ${fmtMoeda(l.preco_medio)}`,
            `${fmtInteiro(l.estabelecimentos)} estabelecimentos`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: dados.map((l) => ({
            value: Number(l.amplitude_pct ?? 0),
            itemStyle: {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: T.goldDim },
                  { offset: 1, color: T.goldBright },
                ],
              },
              borderRadius: [0, 3, 3, 0],
            },
            label: { color: Number(l.amplitude_pct ?? 0) >= 100 ? T.dangerTxt : T.ink2 },
          })),
          barMaxWidth: 16,
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: unknown }) => `${Math.round(Number(p.value))}%`,
            fontFamily: T.fontMono,
            fontSize: 11,
          },
        },
      ],
    }
  }, [dispersaoTop, estreita])

  // --------------------------------------------------- grafico: competitividade
  // Mostra os extremos: as mais baratas e as mais caras em relacao ao mercado.
  const extremos = useMemo(() => {
    if (linhasRanking.length <= 12) return linhasRanking
    return [...linhasRanking.slice(0, 6), ...linhasRanking.slice(-6)]
  }, [linhasRanking])

  const opRanking = useMemo<EChartsOption>(() => {
    const dados = [...extremos].reverse()

    // Eixo simetrico com folga de 25%: garante espaco para o rotulo fora da
    // barra mais longa (sem isso ele colide com o nome da loja) e faz com que
    // "10% abaixo" e "10% acima" tenham o mesmo comprimento visual, que e o
    // ponto de um grafico divergente.
    const maiorDesvio = dados.reduce((m, l) => {
      const d = Math.abs((Number(l.indice_competitividade ?? 1) - 1) * 100)
      return d > m ? d : m
    }, 5)
    const limite = Math.ceil((maiorDesvio * 1.25) / 5) * 5

    return {
      // containLabel nao conta os rotulos de serie desenhados fora da barra;
      // sem margem propria dos dois lados eles colidem com o eixo.
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        min: -limite,
        max: limite,
        splitNumber: estreita ? 4 : 8,
        axisLabel: { formatter: (v: number | string) => `${v}%` },
      },
      yAxis: {
        type: 'category',
        data: dados.map((l) => encurtar(l.nome_estabelecimento, estreita ? 16 : 30)),
        axisLabel: {
          width: estreita ? 92 : 200,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const l = dados[i]
          if (!l) return ''
          const desvio = (Number(l.indice_competitividade ?? 1) - 1) * 100
          return [
            `<b>${l.nome_estabelecimento ?? '—'}</b>`,
            `${l.bairro ?? '—'} · ${l.cidade ?? '—'}`,
            `${desvio < 0 ? 'Abaixo' : 'Acima'} do mercado: ${fmtPercent(Math.abs(desvio))}`,
            `Preço médio da loja: ${fmtMoeda(l.preco_medio_loja)}`,
            `Preço médio de mercado: ${fmtMoeda(l.preco_medio_mercado)}`,
            `${fmtInteiro(l.produtos_comparados)} produtos comparados`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: dados.map((l) => {
            const desvio = (Number(l.indice_competitividade ?? 1) - 1) * 100
            return {
              value: Number(desvio.toFixed(1)),
              itemStyle: {
                color: desvio <= 0 ? T.success : T.danger,
                borderRadius: desvio <= 0 ? [3, 0, 0, 3] : [0, 3, 3, 0],
              },
              label: {
                color: desvio <= 0 ? T.successTxt : T.dangerTxt,
                // A posicao vai por item porque o tipo do ECharts nao aceita
                // funcao aqui — e barra divergente precisa do rotulo do lado
                // de fora da barra, dos dois lados do zero.
                position: desvio < 0 ? ('left' as const) : ('right' as const),
              },
            }
          }),
          barMaxWidth: 16,
          label: {
            show: true,
            formatter: (p: { value: unknown }) => {
              const v = Number(p.value)
              return `${v > 0 ? '+' : ''}${v.toFixed(0)}%`
            },
            fontFamily: T.fontMono,
            fontSize: 11,
          },
        },
      ],
    }
  }, [extremos, estreita])

  // ---------------------------------------------------- grafico: distribuicao
  const opDistribuicao = useMemo<EChartsOption>(() => {
    const mediana = num(k?.preco_mediano)

    // Indice da barra que contem a mediana — e nela que a linha de referencia
    // e ancorada. Num eixo de categoria o markLine so aceita indice, nao valor.
    const iMediana =
      mediana === null
        ? -1
        : faixas.findIndex(
            (fx) => (num(fx.preco_de) ?? 0) <= mediana && mediana <= (num(fx.preco_ate) ?? 0),
          )

    return {
      grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: faixas.map((fx) => fmtMoeda(fx.preco_ate)),
        axisLabel: {
          interval: estreita ? 2 : 0,
          rotate: estreita ? 45 : 0,
          fontSize: estreita ? 9 : 10,
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { formatter: (v: number | string) => fmtInteiro(Number(v)) },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const fx = faixas[i]
          if (!fx) return ''
          return [
            `<b>${fmtMoeda(fx.preco_de)} – ${fmtMoeda(fx.preco_ate)}</b>`,
            `${fmtInteiro(fx.registros)} preços vigentes`,
            `${fmtInteiro(fx.produtos)} produtos diferentes`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: faixas.map((fx) => fx.registros),
          barMaxWidth: 44,
          barCategoryGap: '12%',
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: T.goldBright },
                { offset: 1, color: T.goldDim },
              ],
            },
          },
          // Espalhado condicionalmente: com exactOptionalPropertyTypes, passar
          // `markLine: undefined` nao compila — a chave precisa nao existir.
          ...(iMediana < 0
            ? {}
            : {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: T.successTxt, type: 'dashed' as const, width: 1.5 },
                  label: {
                    formatter: `Mediana ${fmtMoeda(mediana)}`,
                    color: T.successTxt,
                    fontFamily: T.fontMono,
                    fontSize: 10.5,
                    rotate: 0,
                    position: 'end' as const,
                    distance: 6,
                  },
                  data: [{ xAxis: iMediana }],
                },
              }),
        },
      ],
    }
  }, [faixas, k?.preco_mediano, estreita])

  // -------------------------------------------- grafico: preco medio por item
  // Mesma linguagem visual do grafico de categoria (barra em gradiente dourado
  // com o valor em R$), so que na horizontal: nome de produto e longo demais
  // para caber num eixo vertical sem virar rotulo picotado.
  const precoPorProduto = useMemo(
    () =>
      [...linhasDispersao]
        .filter((l) => num(l.preco_medio) !== null)
        .sort((a, b) => (num(b.preco_medio) ?? 0) - (num(a.preco_medio) ?? 0))
        .slice(0, 15),
    [linhasDispersao],
  )

  const opPrecoProduto = useMemo<EChartsOption>(() => {
    // O eixo de categoria do ECharts cresce de baixo para cima; invertendo,
    // o item mais caro fica no topo, que e onde o olho comeca a ler.
    const dados = [...precoPorProduto].reverse()

    return {
      grid: { left: 8, right: estreita ? 44 : 64, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number | string) =>
            `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        },
      },
      yAxis: {
        type: 'category',
        data: dados.map((l) => encurtar(l.nome_exibicao, estreita ? 16 : 30)),
        axisLabel: {
          width: estreita ? 92 : 200,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const l = dados[i]
          if (!l) return ''
          return [
            `<b>${l.nome_exibicao ?? 'Sem nome'}</b>`,
            `EAN ${l.cod_barras}`,
            `Preço médio: ${fmtMoeda(l.preco_medio)}`,
            `Faixa: ${fmtMoeda(l.preco_min)} – ${fmtMoeda(l.preco_max)}`,
            `Amplitude: ${fmtPercent(l.amplitude_pct)} em ${fmtInteiro(
              l.estabelecimentos,
            )} lojas`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: dados.map((l) => num(l.preco_medio) ?? 0),
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [0, 3, 3, 0],
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: T.goldDim },
                { offset: 1, color: T.goldBright },
              ],
            },
          },
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: unknown }) => fmtMoeda(Number(p.value)),
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
          },
        },
      ],
    }
  }, [precoPorProduto, estreita])

  // ------------------------------------------------- graficos: giro (NFC-e)
  const linhasFrequencia = frequencia.data ?? []
  const linhasFreqDim = frequenciaDim.data ?? []

  const giroTop = useMemo(() => linhasFrequencia.slice(0, 15), [linhasFrequencia])

  /** Referencia das barras de participacao. Nunca zero: seria divisao por 0. */
  const maiorShare = useMemo(
    () => Math.max(1, ...giroTop.map((l) => num(l.share_pct) ?? 0)),
    [giroTop],
  )

  const opGiroProduto = useMemo<EChartsOption>(() => {
    const dados = [...giroTop].reverse()

    return {
      grid: { left: 8, right: estreita ? 48 : 72, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { formatter: (v: number | string) => fmtInteiro(Number(v)) },
      },
      yAxis: {
        type: 'category',
        data: dados.map((l) => encurtar(l.nome_exibicao, estreita ? 16 : 30)),
        axisLabel: {
          width: estreita ? 92 : 200,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const l = dados[i]
          if (!l) return ''
          return [
            `<b>${l.nome_exibicao ?? 'Sem nome'}</b>`,
            `EAN ${l.cod_barras}`,
            `<b>${fmtInteiro(l.nfce)}</b> NFC-e · ${fmtPercent(l.share_pct)} das aparições`,
            `Presente em ${fmtPercent(l.penetracao_pct)} dos cupons do recorte`,
            `${fmtInteiro(l.estabelecimentos)} lojas · ${fmtInteiro(
              l.cidades,
            )} cidades · ${fmtInteiro(l.bairros)} bairros`,
            `Preço médio: ${fmtMoeda(l.preco_medio)}`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: dados.map((l) => l.nfce),
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [0, 3, 3, 0],
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: T.goldDim },
                { offset: 1, color: T.goldBright },
              ],
            },
          },
          label: {
            show: true,
            position: 'right',
            // Contagem e share juntos: o numero absoluto sozinho nao diz se 46
            // cupons e muito, e o percentual sozinho esconde o tamanho da
            // amostra que o sustenta.
            formatter: (p: { dataIndex: number; value: unknown }) => {
              const l = dados[p.dataIndex]
              return l === undefined
                ? fmtInteiro(Number(p.value))
                : `${fmtInteiro(l.nfce)}  ·  ${fmtPercent(l.share_pct, 0)}`
            },
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
          },
        },
      ],
    }
  }, [giroTop, estreita])

  const giroDimTop = useMemo(() => linhasFreqDim.slice(0, 12), [linhasFreqDim])

  const opGiroDimensao = useMemo<EChartsOption>(() => {
    const dados = [...giroDimTop].reverse()
    // Com um EAN filtrado o produto e sempre o mesmo e repeti-lo em cada
    // rotulo seria ruido; sem filtro, o local sozinho seria ambiguo (o mesmo
    // bairro aparece uma vez por produto).
    const rotulo = (l: (typeof dados)[number]) =>
      filtros.ean !== null
        ? encurtar(l.chave, estreita ? 16 : 34)
        : `${encurtar(l.nome_exibicao, estreita ? 10 : 22)} · ${encurtar(
            l.chave,
            estreita ? 10 : 22,
          )}`

    return {
      grid: { left: 8, right: estreita ? 48 : 72, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { formatter: (v: number | string) => fmtInteiro(Number(v)) },
      },
      yAxis: {
        type: 'category',
        data: dados.map(rotulo),
        axisLabel: {
          width: estreita ? 110 : 280,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const l = dados[i]
          if (!l) return ''
          return [
            `<b>${l.chave}</b>`,
            l.contexto ?? '',
            `${l.nome_exibicao ?? 'Sem nome'}`,
            '',
            `<b>${fmtInteiro(l.nfce)}</b> NFC-e`,
            `${fmtPercent(l.share_produto_pct)} do giro deste produto`,
            `${fmtPercent(l.share_local_pct)} do giro deste local`,
            `Preço médio: ${fmtMoeda(l.preco_medio)}`,
          ]
            .filter((s) => s !== '')
            .join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: dados.map((l) => l.nfce),
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [0, 3, 3, 0],
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#33507F' },
                { offset: 1, color: '#5B8FF9' },
              ],
            },
          },
          label: {
            show: true,
            position: 'right',
            formatter: (p: { dataIndex: number; value: unknown }) => {
              const l = dados[p.dataIndex]
              return l === undefined
                ? fmtInteiro(Number(p.value))
                : `${fmtInteiro(l.nfce)}  ·  ${fmtPercent(l.share_produto_pct, 0)}`
            },
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
          },
        },
      ],
    }
  }, [giroDimTop, estreita, filtros.ean])

  // -------------------------------------------------------- grafico: categoria
  const opCategoria = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: linhasCategoria.map((c) => encurtar(c.ncm_grupo, estreita ? 12 : 22)),
        axisLabel: { interval: 0, fontSize: estreita ? 10 : 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number | string) =>
            `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0
          const c = linhasCategoria[i]
          if (!c) return ''
          return [
            `<b>${c.ncm_grupo}</b>`,
            `Preço médio: ${fmtMoeda(c.preco_medio)}`,
            `Faixa: ${fmtMoeda(c.preco_min)} – ${fmtMoeda(c.preco_max)}`,
            `Amplitude típica: ${fmtPercent(c.amplitude_mediana_pct)}`,
            `${fmtInteiro(c.produtos)} produtos · ${fmtInteiro(c.estabelecimentos)} lojas`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          data: linhasCategoria.map((c) => Number(c.preco_medio ?? 0)),
          barMaxWidth: 56,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: T.goldBright },
                { offset: 1, color: T.goldDim },
              ],
            },
            borderRadius: [3, 3, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: (p: { value: unknown }) => fmtMoeda(Number(p.value)),
            color: T.ink2,
            fontFamily: T.fontMono,
            fontSize: 11,
          },
        },
      ],
    }),
    [linhasCategoria, estreita],
  )

  // ------------------------------------------------------------------ contexto
  const cidadesTexto =
    k?.total_cidades != null
      ? `${fmtInteiro(k.total_cidades)} ${k.total_cidades === 1 ? 'cidade' : 'cidades'}`
      : null
  const lojasTexto =
    k?.total_estabelecimentos != null
      ? `${fmtInteiro(k.total_estabelecimentos)} estabelecimentos monitorados`
      : null
  const periodoTexto =
    pontos.length > 0
      ? `${fmtData(pontos[0]?.dia)} – ${fmtData(pontos[pontos.length - 1]?.dia)}`
      : null

  const precoMedio = num(k?.preco_medio)
  const precoMediano = num(k?.preco_mediano)

  const carregandoTudo = kpis.isPending

  return (
    <div>
      <CabecalhoPagina
        titulo="Visão Geral"
        contexto={[nomeContratante, cidadesTexto, periodoTexto, lojasTexto]}
        selo={
          k?.ultima_coleta != null ? (
            <TagSecao>
              <span className="num">Atualizado em {fmtDataHora(k.ultima_coleta)}</span>
            </TagSecao>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-5">
        {/* ------------------------------------------------------------- KPIs */}
        <GradeKpi>
          <CardKpi
            rotulo="Produtos monitorados"
            valor={fmtInteiro(k?.total_produtos)}
            delta="por código de barras"
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="Estabelecimentos"
            valor={fmtInteiro(k?.total_estabelecimentos)}
            delta="com preço vigente"
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="Cidades"
            valor={fmtInteiro(k?.total_cidades)}
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="Bairros"
            valor={fmtInteiro(k?.total_bairros)}
            delta="com preço vigente"
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="NFC-e analisadas"
            valor={fmtInteiro(k?.total_nfce)}
            delta="cupons distintos na amostra"
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="Preço médio"
            valor={fmtMoeda(k?.preco_medio)}
            delta="cesta monitorada"
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="Preço mediano"
            valor={fmtMoeda(k?.preco_mediano)}
            // A distancia entre media e mediana e informacao, nao curiosidade:
            // media bem acima da mediana significa cauda de itens caros
            // puxando o numero que a maioria olha.
            delta={
              precoMedio !== null && precoMediano !== null
                ? precoMedio > precoMediano
                  ? 'metade dos itens custa menos que isso'
                  : 'acima da média — cauda de itens baratos'
                : 'valor central da cesta'
            }
            carregando={carregandoTudo}
          />
          <CardKpi
            rotulo="Amplitude média"
            valor={fmtPercent(k?.amplitude_media_pct)}
            delta="entre lojas, por produto"
            tom={Number(k?.amplitude_media_pct ?? 0) >= 50 ? 'negativo' : 'neutro'}
            carregando={carregandoTudo}
            destaque
          />
        </GradeKpi>

        {/* -------------------------------------------------------- destaques */}
        {(maiorOportunidade !== null || maisBarata !== null) && (
          <div className="grid gap-3.5 md:grid-cols-3">
            {maiorOportunidade !== null && (
              <Destaque
                Icone={Target}
                eyebrow="Maior oportunidade"
                titulo={maiorOportunidade.nome_exibicao ?? 'Produto sem nome'}
                valor={fmtPercent(maiorOportunidade.amplitude_pct)}
                tom="atencao"
                descricao={
                  <>
                    Varia de {fmtMoeda(maiorOportunidade.preco_min)} a{' '}
                    {fmtMoeda(maiorOportunidade.preco_max)} entre{' '}
                    {fmtInteiro(maiorOportunidade.estabelecimentos)} lojas.
                  </>
                }
              />
            )}

            {maisBarata !== null && (
              <Destaque
                Icone={ArrowDownRight}
                eyebrow="Loja mais competitiva"
                titulo={maisBarata.nome_estabelecimento ?? '—'}
                valor={fmtPercent(
                  (1 - Number(maisBarata.indice_competitividade ?? 1)) * 100,
                )}
                tom="bom"
                descricao={
                  <>
                    Abaixo da média de mercado em{' '}
                    {fmtInteiro(maisBarata.produtos_comparados)} produtos comparados.
                  </>
                }
              />
            )}

            {maisCara !== null && (
              <Destaque
                Icone={ArrowUpRight}
                eyebrow="Loja mais cara"
                titulo={maisCara.nome_estabelecimento ?? '—'}
                valor={fmtPercent(
                  (Number(maisCara.indice_competitividade ?? 1) - 1) * 100,
                )}
                tom="ruim"
                descricao={
                  <>
                    Acima da média de mercado em{' '}
                    {fmtInteiro(maisCara.produtos_comparados)} produtos comparados.
                  </>
                }
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------- amplitude */}
        <Secao
          eyebrow="Oportunidades"
          titulo="Onde o preço mais varia entre lojas"
          descricao="Amplitude é a distância entre o menor e o maior preço vigente do mesmo produto. Acima de 100% significa que o maior preço é mais que o dobro do menor — é onde há espaço para negociar ou corrigir posicionamento."
          acessorio={
            dispersaoTop.length > 0 ? (
              <TagSecao>
                top <span className="num">{dispersaoTop.length}</span> produtos
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opAmplitude}
            altura={Math.max(240, dispersaoTop.length * 38)}
            carregando={dispersao.isPending}
            erro={dispersao.isError ? dispersao.error.message : null}
            vazio={dispersao.isSuccess && dispersaoTop.length === 0}
            mensagemVazio="Nenhum produto aparece em duas ou mais lojas neste recorte. Amplie o período ou remova filtros para comparar."
            onTentarNovamente={() => void dispersao.refetch()}
          />

          {/* Os numeros por tras das barras. O grafico ordena e compara; a
              tabela e onde se le o EAN para levar a uma negociacao. */}
          {dispersaoTop.length > 0 && (
            <div className="mt-6 border-t border-line-soft pt-5">
              <Tabela>
                <thead>
                  <tr>
                    <Th>Produto</Th>
                    <Th numerica>EAN</Th>
                    <Th numerica>Lojas</Th>
                    <Th numerica>Menor preço</Th>
                    <Th numerica>Preço médio</Th>
                    <Th numerica>Maior preço</Th>
                    <Th numerica>Amplitude</Th>
                    <Th numerica>Amplitude %</Th>
                  </tr>
                </thead>
                <tbody>
                  {dispersaoTop.map((l) => {
                    const minimo = num(l.preco_min)
                    const maximo = num(l.preco_max)
                    // Amplitude absoluta: quantos reais separam a loja mais
                    // barata da mais cara. O percentual diz a proporcao; este
                    // diz o dinheiro em jogo por unidade.
                    const amplitudeRs =
                      minimo === null || maximo === null ? null : maximo - minimo
                    const amp = num(l.amplitude_pct) ?? 0
                    return (
                      <Tr key={l.cod_barras}>
                        <Td forte>
                          <span className="block max-w-70 truncate">
                            {l.nome_exibicao ?? 'Sem nome'}
                          </span>
                        </Td>
                        <Td numerica>{l.cod_barras}</Td>
                        <Td numerica>{fmtInteiro(l.estabelecimentos)}</Td>
                        <Td numerica className="text-success-txt">
                          {fmtMoeda(minimo)}
                        </Td>
                        <Td numerica>{fmtMoeda(l.preco_medio)}</Td>
                        <Td numerica className="text-danger-txt">
                          {fmtMoeda(maximo)}
                        </Td>
                        <Td numerica forte>
                          {fmtMoeda(amplitudeRs)}
                        </Td>
                        <Td numerica>
                          {amp >= 80 ? (
                            <Etiqueta tom="critico">{fmtPercent(amp)}</Etiqueta>
                          ) : amp >= 40 ? (
                            <Etiqueta tom="alerta">{fmtPercent(amp)}</Etiqueta>
                          ) : (
                            <Etiqueta tom="neutro">{fmtPercent(amp)}</Etiqueta>
                          )}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Tabela>
            </div>
          )}
        </Secao>

        {/* ------------------------------------------------------ distribuição */}
        <Secao
          eyebrow="Distribuição"
          titulo="Como os preços se distribuem"
          descricao="Cada barra conta quantos preços vigentes caem naquela faixa de valor. Barras concentradas à esquerda com cauda à direita indicam uma cesta de itens baratos com poucos produtos caros puxando a média — por isso a linha da mediana costuma ficar abaixo do preço médio."
          acessorio={
            faixas.length > 0 ? (
              <TagSecao>
                mediana <span className="num">{fmtMoeda(precoMediano)}</span> · média{' '}
                <span className="num">{fmtMoeda(precoMedio)}</span>
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opDistribuicao}
            altura={300}
            carregando={distribuicao.isPending}
            erro={distribuicao.isError ? distribuicao.error.message : null}
            vazio={distribuicao.isSuccess && faixas.length === 0}
            mensagemVazio="Não há variação de preço suficiente no recorte para montar uma distribuição. Amplie o período ou remova filtros."
            onTentarNovamente={() => void distribuicao.refetch()}
          />
        </Secao>

        {/* -------------------------------------------------- competitividade */}
        <Secao
          eyebrow="Concorrência"
          titulo={
            filtros.ean !== null
              ? 'Dispersão de preço do produto entre as lojas'
              : 'Lojas acima e abaixo do mercado'
          }
          descricao={
            filtros.ean !== null
              ? 'Com um produto selecionado, cada barra é o quanto aquela loja cobra acima ou abaixo da média de mercado deste item. Verdes à esquerda estão mais baratas; vermelhas à direita, mais caras.'
              : 'Para cada loja, comparamos o preço dela com a média de mercado do mesmo produto e tiramos a média dessas comparações. Barras verdes à esquerda praticam preços abaixo do mercado; vermelhas à direita, acima.'
          }
          acessorio={
            linhasRanking.length > 0 ? (
              <TagSecao>
                <span className="num">{linhasRanking.length}</span> lojas comparáveis
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opRanking}
            altura={Math.max(240, extremos.length * 38)}
            carregando={ranking.isPending}
            erro={ranking.isError ? ranking.error.message : null}
            vazio={ranking.isSuccess && linhasRanking.length === 0}
            mensagemVazio="Nenhum produto deste recorte aparece em duas ou mais lojas, então não há com o que comparar. Amplie o período ou remova filtros."
            onTentarNovamente={() => void ranking.refetch()}
          />
        </Secao>

        {/* ------------------------------------------- preço médio por produto */}
        <Secao
          eyebrow="Produtos"
          titulo="Preço médio por produto"
          descricao="Média dos preços vigentes de cada item no recorte, do mais caro para o mais barato. Serve para enxergar o patamar do catálogo; a comparação entre lojas do mesmo item está nos blocos acima."
          acessorio={
            precoPorProduto.length > 0 ? (
              <TagSecao>
                {linhasDispersao.length > precoPorProduto.length ? (
                  <>
                    top <span className="num">{precoPorProduto.length}</span> de{' '}
                    <span className="num">{linhasDispersao.length}</span>
                  </>
                ) : (
                  <>
                    <span className="num">{precoPorProduto.length}</span> produtos
                  </>
                )}
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opPrecoProduto}
            altura={Math.max(240, precoPorProduto.length * 34)}
            carregando={dispersao.isPending}
            erro={dispersao.isError ? dispersao.error.message : null}
            vazio={dispersao.isSuccess && precoPorProduto.length === 0}
            mensagemVazio="Nenhum produto com preço no recorte atual. Amplie o período ou remova filtros."
            onTentarNovamente={() => void dispersao.refetch()}
          />
        </Secao>

        {/* ------------------------------------------------- giro por produto */}
        <Secao
          eyebrow="Giro"
          titulo="Quantidade de NFC-e por produto"
          descricao="Quantos cupons fiscais distintos trouxeram cada item no período. Como a fonte não informa quantidade vendida, esta contagem é o proxy de participação: um produto que aparece em mais notas está girando mais. O share soma 100% entre os produtos; a penetração diz em que fatia dos cupons o item aparece."
          acessorio={
            k?.total_nfce != null ? (
              <TagSecao>
                <span className="num">{fmtInteiro(k.total_nfce)}</span> NFC-e no recorte
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opGiroProduto}
            altura={Math.max(240, giroTop.length * 34)}
            carregando={frequencia.isPending}
            erro={frequencia.isError ? frequencia.error.message : null}
            vazio={frequencia.isSuccess && giroTop.length === 0}
            mensagemVazio="Nenhuma NFC-e no recorte atual. Amplie o período ou remova filtros."
            onTentarNovamente={() => void frequencia.refetch()}
          />

          {giroTop.length > 0 && (
            <div className="mt-6 border-t border-line-soft pt-5">
              <Tabela>
                <thead>
                  <tr>
                    <Th>Produto</Th>
                    <Th numerica>EAN</Th>
                    <Th numerica>NFC-e</Th>
                    <Th numerica>Share</Th>
                    <Th>Participação</Th>
                    <Th numerica>Penetração</Th>
                    <Th numerica>Lojas</Th>
                    <Th numerica>Cidades</Th>
                    <Th numerica>Preço médio</Th>
                  </tr>
                </thead>
                <tbody>
                  {giroTop.map((l) => (
                    <Tr key={l.cod_barras}>
                      <Td forte>
                        <span className="block max-w-70 truncate">
                          {l.nome_exibicao ?? 'Sem nome'}
                        </span>
                      </Td>
                      <Td numerica>{l.cod_barras}</Td>
                      <Td numerica forte>
                        {fmtInteiro(l.nfce)}
                      </Td>
                      <Td numerica>{fmtPercent(l.share_pct)}</Td>
                      <Td>
                        <div className="w-24">
                          {/* Proporcional ao MAIOR share, nao a 100%: com 23
                              produtos o topo fica em ~15%, e uma barra de 15%
                              cheia de vazio nao compara nada. O percentual
                              exato esta na coluna ao lado e no title. */}
                          <BarraInline
                            proporcao={(num(l.share_pct) ?? 0) / maiorShare}
                            titulo={`${fmtPercent(l.share_pct)} das aparições`}
                          />
                        </div>
                      </Td>
                      <Td numerica>{fmtPercent(l.penetracao_pct)}</Td>
                      <Td numerica>{fmtInteiro(l.estabelecimentos)}</Td>
                      <Td numerica>{fmtInteiro(l.cidades)}</Td>
                      <Td numerica>{fmtMoeda(l.preco_medio)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>
            </div>
          )}
        </Secao>

        {/* --------------------------------------------- giro por dimensão */}
        <Secao
          eyebrow="Giro por região"
          titulo="Quantidade de NFC-e por produto e local"
          descricao="A mesma contagem de cupons, agora quebrada por estabelecimento, cidade ou bairro. Serve para ver onde um item concentra o giro — e, com um produto filtrado na barra superior, a leitura fica direta: o gráfico passa a mostrar só a distribuição daquele EAN."
          acessorio={<SeletorDimensao valor={dimensao} aoTrocar={setDimensao} />}
        >
          <Grafico
            option={opGiroDimensao}
            altura={Math.max(240, giroDimTop.length * 34)}
            carregando={frequenciaDim.isPending}
            erro={frequenciaDim.isError ? frequenciaDim.error.message : null}
            vazio={frequenciaDim.isSuccess && giroDimTop.length === 0}
            mensagemVazio="Nenhuma NFC-e no recorte atual. Amplie o período ou remova filtros."
            onTentarNovamente={() => void frequenciaDim.refetch()}
          />

          {linhasFreqDim.length > 0 && (
            <div className="mt-6 border-t border-line-soft pt-5">
              <Tabela>
                <thead>
                  <tr>
                    <Th>
                      {dimensao === 'estabelecimento'
                        ? 'Estabelecimento'
                        : dimensao === 'cidade'
                          ? 'Cidade'
                          : 'Bairro'}
                    </Th>
                    {dimensao !== 'cidade' && <Th>Local</Th>}
                    <Th>Produto</Th>
                    <Th numerica>NFC-e</Th>
                    <Th numerica>Do produto</Th>
                    <Th numerica>Do local</Th>
                    <Th numerica>Preço médio</Th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFreqDim.slice(0, 20).map((l) => (
                    <Tr key={`${l.cod_barras}-${l.chave_id}`}>
                      <Td forte>
                        <span className="block max-w-60 truncate">{l.chave}</span>
                      </Td>
                      {dimensao !== 'cidade' && <Td>{l.contexto ?? '—'}</Td>}
                      <Td>
                        <span className="block max-w-60 truncate">
                          {l.nome_exibicao ?? 'Sem nome'}
                        </span>
                      </Td>
                      <Td numerica forte>
                        {fmtInteiro(l.nfce)}
                      </Td>
                      <Td numerica>{fmtPercent(l.share_produto_pct)}</Td>
                      <Td numerica>{fmtPercent(l.share_local_pct)}</Td>
                      <Td numerica>{fmtMoeda(l.preco_medio)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>

              {linhasFreqDim.length > 20 && (
                <p className="mt-3 text-[12px] text-ink-3">
                  Mostrando os <span className="num text-ink-2">20</span> pares de maior
                  giro
                  {/* Se o retorno bateu no teto, o total real e desconhecido —
                      dizer "de 300" seria inventar um numero. */}
                  {linhasFreqDim.length >= LIMITE_DIM ? (
                    <>
                      , de mais de{' '}
                      <span className="num text-ink-2">{fmtInteiro(LIMITE_DIM)}</span>
                    </>
                  ) : (
                    <>
                      , de{' '}
                      <span className="num text-ink-2">
                        {fmtInteiro(linhasFreqDim.length)}
                      </span>
                    </>
                  )}
                  . Filtre por produto ou cidade na barra superior para reduzir a lista.
                </p>
              )}
            </div>
          )}
        </Secao>

        {/* --------------------------------------------------------- categoria */}
        <div className="grid gap-5 xl:grid-cols-2">
          <Secao
            eyebrow="Categorias"
            titulo="Preço médio por grupo NCM"
            descricao="A amplitude típica é a mediana da variação dos produtos dentro da categoria — não a diferença entre o item mais barato e o mais caro, que só refletiria o sortimento."
          >
            <Grafico
              option={opCategoria}
              altura={280}
              carregando={categorias.isPending}
              erro={categorias.isError ? categorias.error.message : null}
              vazio={categorias.isSuccess && linhasCategoria.length === 0}
              onTentarNovamente={() => void categorias.refetch()}
            />

            {linhasCategoria.length > 0 && (
              <div className="mt-4">
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Categoria</Th>
                      <Th numerica>Produtos</Th>
                      <Th numerica>Amplitude típica</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasCategoria.map((c) => (
                      <Tr key={c.ncm_grupo}>
                        <Td forte>{c.ncm_grupo}</Td>
                        <Td numerica>{fmtInteiro(c.produtos)}</Td>
                        <Td numerica>
                          {c.amplitude_mediana_pct === null ? (
                            '—'
                          ) : (
                            <Etiqueta
                              tom={
                                Number(c.amplitude_mediana_pct) >= 100
                                  ? 'critico'
                                  : Number(c.amplitude_mediana_pct) >= 50
                                    ? 'alerta'
                                    : 'ok'
                              }
                            >
                              {fmtPercent(c.amplitude_mediana_pct)}
                            </Etiqueta>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Tabela>
              </div>
            )}
          </Secao>

          {/* -------------------------------------------------------- geografia */}
          <Secao
            eyebrow="Geografia"
            titulo="Bairros acima e abaixo do mercado"
            descricao="Mesmo cálculo do ranking de lojas, agora por região: a média das comparações produto a produto. Assim um bairro que só vende itens caros não aparece caro por causa do sortimento."
          >
            {geo.isPending && (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}

            {geo.isSuccess && linhasGeo.length > 0 && (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Bairro</Th>
                    <Th>Cidade</Th>
                    <Th numerica>Lojas</Th>
                    <Th numerica>Preço médio</Th>
                    <Th numerica>vs. mercado</Th>
                  </tr>
                </thead>
                <tbody>
                  {linhasGeo.slice(0, 14).map((g) => {
                    const desvio = (Number(g.indice_competitividade ?? 1) - 1) * 100
                    return (
                      <Tr key={`${g.cidade}-${g.bairro}`}>
                        <Td forte>{g.bairro}</Td>
                        <Td>{g.cidade}</Td>
                        <Td numerica>{fmtInteiro(g.estabelecimentos)}</Td>
                        <Td numerica>{fmtMoeda(g.preco_medio)}</Td>
                        <Td numerica>
                          <Etiqueta tom={desvio <= 0 ? 'ok' : 'critico'}>
                            {desvio > 0 ? '+' : ''}
                            {fmtPercent(desvio, 0)}
                          </Etiqueta>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Tabela>
            )}

            {geo.isSuccess && linhasGeo.length === 0 && (
              <p className="py-10 text-center text-[12.5px] text-ink-2">
                Nenhum bairro tem produtos suficientes para uma comparação justa neste
                recorte.
              </p>
            )}
          </Secao>
        </div>
      </div>
    </div>
  )
}

