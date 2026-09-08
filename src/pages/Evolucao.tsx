import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { X } from 'lucide-react'
import { buscarEvolucaoProduto, type PontoEvolucaoProduto } from '@/lib/rpc'
import { chaveCache, useFiltros } from '@/store/filtros'
import { useNomeEstabelecimento, useNomeProduto } from '@/lib/catalogo'
import { fmtData, fmtDelta, fmtInteiro, fmtMoeda, num } from '@/lib/format'
import { encurtar, useTelaEstreita } from '@/lib/tela'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { SeletorProduto } from '@/components/SeletorProduto'
import { CardKpi } from '@/components/ui/kpi'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Grafico } from '@/components/ui/Grafico'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { Button } from '@/components/ui/button'
import { PALETA_SERIES, T } from '@/lib/tokens'

/** Quantas lojas entram no grafico por padrao; o resto fica na legenda. */
const MAX_SERIES = 6

/**
 * Evolucao de Precos (§9.4) — a serie temporal de um produto.
 *
 * A RPC ja devolve, alem de uma serie por loja, uma serie com
 * `cnpj_estabelecimento = null` que e a media de mercado do dia. Ela vira a
 * linha de referencia: sem ela, subir 3% num mes em que o mercado subiu 8%
 * pareceria uma alta, quando na verdade foi um ganho de competitividade.
 */
export default function Evolucao() {
  const estreita = useTelaEstreita()
  const filtros = useFiltros()
  const definir = useFiltros((s) => s.definir)
  const chave = chaveCache(filtros)
  const nomeProduto = useNomeProduto(filtros.ean)
  const nomeLoja = useNomeEstabelecimento(filtros.estabelecimento)

  const consulta = useQuery({
    queryKey: ['evolucao-produto', chave],
    queryFn: () => buscarEvolucaoProduto(filtros),
    enabled: filtros.ean !== null,
  })

  const pontos = consulta.data ?? []

  // ------------------------------------------------------- separa as series
  const { dias, mercado, lojas } = useMemo(() => {
    const diasUnicos = [...new Set(pontos.map((p) => p.dia))].sort()

    const porLoja = new Map<string, { nome: string; pontos: PontoEvolucaoProduto[] }>()
    const serieMercado: PontoEvolucaoProduto[] = []

    for (const p of pontos) {
      if (p.cnpj_estabelecimento === null) {
        serieMercado.push(p)
        continue
      }
      const atual = porLoja.get(p.cnpj_estabelecimento)
      if (atual === undefined) {
        porLoja.set(p.cnpj_estabelecimento, {
          nome: p.nome_estabelecimento ?? 'Sem nome',
          pontos: [p],
        })
      } else {
        atual.pontos.push(p)
      }
    }

    // Ordena por quantidade de dias com coleta: uma loja com um ponto so vira
    // um ponto solto no grafico e nao conta historia nenhuma.
    const ordenadas = [...porLoja.entries()].sort(
      (a, b) => b[1].pontos.length - a[1].pontos.length,
    )

    return { dias: diasUnicos, mercado: serieMercado, lojas: ordenadas }
  }, [pontos])

  // -------------------------------------------------------------- variacao
  const variacaoMercado = useMemo(() => {
    const ordenada = [...mercado].sort((a, b) => a.dia.localeCompare(b.dia))
    const primeiro = num(ordenada[0]?.preco_medio)
    const ultimo = num(ordenada[ordenada.length - 1]?.preco_medio)
    if (primeiro === null || ultimo === null || primeiro === 0) return null
    return ((ultimo - primeiro) / primeiro) * 100
  }, [mercado])

  const precoAtual = useMemo(() => {
    const ordenada = [...mercado].sort((a, b) => a.dia.localeCompare(b.dia))
    return num(ordenada[ordenada.length - 1]?.preco_medio)
  }, [mercado])

  const opcao = useMemo<EChartsOption>(() => {
    const visiveis = lojas.slice(0, MAX_SERIES)
    const cor = (i: number): string =>
      PALETA_SERIES[(i + 1) % PALETA_SERIES.length] ?? T.ink2
    const porDia = (ps: PontoEvolucaoProduto[]) => {
      const mapa = new Map(ps.map((p) => [p.dia, num(p.preco_medio)]))
      return dias.map((d) => mapa.get(d) ?? null)
    }

    return {
      // bottom reserva a faixa da legenda: com o padrao (8) ela era desenhada
      // por cima dos rotulos de data. right evita o corte do ultimo rotulo.
      grid: { left: 8, right: 34, top: 12, bottom: 46, containLabel: true },
      legend: {
        type: 'scroll' as const,
        bottom: 0,
        itemWidth: 14,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { fontSize: 11, color: T.ink2 },
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: unknown) => (v === null ? '—' : fmtMoeda(Number(v))),
      },
      xAxis: {
        type: 'category',
        data: dias.map((d) => fmtData(d)),
        boundaryGap: false,
        axisLabel: { fontSize: estreita ? 10 : 11, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { formatter: (v: number | string) => fmtMoeda(Number(v)) },
      },
      series: [
        {
          name: 'Média de mercado',
          type: 'line',
          data: porDia(mercado),
          smooth: false,
          symbol: 'circle',
          symbolSize: 6,
          connectNulls: true,
          z: 10,
          lineStyle: { width: 2.5, color: T.gold, type: 'dashed' },
          itemStyle: { color: T.gold },
        },
        ...visiveis.map(([cnpj, loja], i) => ({
          name: encurtar(loja.nome, 24),
          type: 'line' as const,
          data: porDia(loja.pontos),
          smooth: false,
          symbol: 'circle',
          symbolSize: 5,
          connectNulls: true,
          lineStyle: { width: 1.6, color: cor(i) },
          itemStyle: { color: cor(i) },
          id: cnpj,
        })),
      ],
    }
  }, [dias, mercado, lojas, estreita])

  // ------------------------------------------------------------------ render
  const cabecalho = (
    <CabecalhoPagina
      titulo="Evolução de Preços"
      contexto={[
        nomeProduto,
        filtros.ean !== null ? `EAN ${filtros.ean}` : null,
        nomeLoja,
        dias.length > 0 ? `${fmtInteiro(dias.length)} dias com coleta` : null,
      ]}
      selo={
        filtros.ean !== null ? (
          <Button variant="outline" size="sm" onClick={() => definir('ean', null)}>
            <X className="size-3.5" aria-hidden />
            Trocar de produto
          </Button>
        ) : undefined
      }
    />
  )

  if (filtros.ean === null) {
    return (
      <div>
        {cabecalho}
        <SeletorProduto
          titulo="Escolha um produto para acompanhar"
          descricao="A série temporal é de um item por vez. Busque pelo nome ou digite o EAN."
        />
      </div>
    )
  }

  return (
    <div>
      {cabecalho}

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <CardKpi
            rotulo="Preço médio na última coleta"
            valor={fmtMoeda(precoAtual)}
            delta={
              dias.length > 0
                ? `em ${fmtData(dias[dias.length - 1] ?? null)}`
                : 'sem coleta no recorte'
            }
            carregando={consulta.isPending}
            destaque
          />
          <CardKpi
            rotulo="Variação no período"
            valor={fmtDelta(variacaoMercado)}
            delta="da primeira à última coleta"
            tom={
              variacaoMercado === null
                ? 'neutro'
                : variacaoMercado > 0
                  ? 'negativo'
                  : 'positivo'
            }
            carregando={consulta.isPending}
          />
          <CardKpi
            rotulo="Lojas acompanhadas"
            valor={fmtInteiro(lojas.length)}
            delta={
              lojas.length > MAX_SERIES
                ? `${MAX_SERIES} no gráfico, todas na tabela`
                : 'com preço deste item'
            }
            carregando={consulta.isPending}
          />
        </div>

        <Secao
          eyebrow="Série temporal"
          titulo="Preço ao longo do tempo"
          descricao={`A linha dourada tracejada é a média de mercado do dia — a referência para saber se um movimento foi da loja ou do mercado inteiro. São mostradas as ${MAX_SERIES} lojas com mais dias de coleta; clique na legenda para ligar e desligar cada uma.`}
          acessorio={
            dias.length > 0 ? (
              <TagSecao>
                <span className="num">{dias.length}</span> dias
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opcao}
            altura={estreita ? 320 : 400}
            carregando={consulta.isPending}
            erro={consulta.isError ? consulta.error.message : null}
            vazio={consulta.isSuccess && pontos.length === 0}
            mensagemVazio="Não há coletas deste produto no recorte atual. Amplie o período ou remova o filtro de loja."
            onTentarNovamente={() => void consulta.refetch()}
          />
        </Secao>

        {lojas.length > 0 && (
          <Secao
            eyebrow="Por loja"
            titulo="Primeiro e último preço de cada estabelecimento"
            descricao="A variação compara a coleta mais antiga com a mais recente daquela loja dentro do recorte. Lojas com um único dia de coleta não têm variação a mostrar."
          >
            <Tabela>
              <thead>
                <tr>
                  <Th>Estabelecimento</Th>
                  <Th numerica>Dias</Th>
                  <Th numerica>Primeiro</Th>
                  <Th numerica>Último</Th>
                  <Th numerica>Mínimo</Th>
                  <Th numerica>Máximo</Th>
                  <Th numerica>Variação</Th>
                </tr>
              </thead>
              <tbody>
                {lojas.map(([cnpj, loja]) => {
                  const ord = [...loja.pontos].sort((a, b) => a.dia.localeCompare(b.dia))
                  const pri = num(ord[0]?.preco_medio)
                  const ult = num(ord[ord.length - 1]?.preco_medio)
                  const minimo = ord.reduce<number | null>((m, p) => {
                    const v = num(p.preco_min)
                    return v === null ? m : m === null ? v : Math.min(m, v)
                  }, null)
                  const maximo = ord.reduce<number | null>((m, p) => {
                    const v = num(p.preco_max)
                    return v === null ? m : m === null ? v : Math.max(m, v)
                  }, null)
                  const varPct =
                    pri === null || ult === null || pri === 0
                      ? null
                      : ((ult - pri) / pri) * 100

                  return (
                    <Tr key={cnpj}>
                      <Td forte>{loja.nome}</Td>
                      <Td numerica>{fmtInteiro(ord.length)}</Td>
                      <Td numerica>{fmtMoeda(pri)}</Td>
                      <Td numerica>{fmtMoeda(ult)}</Td>
                      <Td numerica>{fmtMoeda(minimo)}</Td>
                      <Td numerica>{fmtMoeda(maximo)}</Td>
                      <Td
                        numerica
                        className={
                          varPct === null || varPct === 0
                            ? undefined
                            : varPct > 0
                              ? 'text-danger-txt'
                              : 'text-success-txt'
                        }
                      >
                        {ord.length < 2 ? '—' : fmtDelta(varPct)}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Tabela>
          </Secao>
        )}
      </div>
    </div>
  )
}
