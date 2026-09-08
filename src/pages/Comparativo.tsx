import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { X } from 'lucide-react'
import {
  buscarBoxplot,
  buscarComparativo,
  buscarMatrizDispersao,
  type LinhaComparativo,
} from '@/lib/rpc'
import { chaveCache, useFiltros } from '@/store/filtros'
import { useNomeProduto } from '@/lib/catalogo'
import { fmtData, fmtDelta, fmtInteiro, fmtMoeda, fmtPercent, num } from '@/lib/format'
import { ORDEM_QUADRANTES, QUADRANTES } from '@/lib/quadrantes'
import { encurtar, useTelaEstreita } from '@/lib/tela'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { SeletorProduto } from '@/components/SeletorProduto'
import { CardKpi } from '@/components/ui/kpi'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Grafico } from '@/components/ui/Grafico'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { Etiqueta } from '@/components/ui/etiqueta'
import { Button } from '@/components/ui/button'
import { T } from '@/lib/tokens'

/**
 * Arredonda para cima ate um valor "redondo" (1, 2, 2.5 ou 5 x potencia de 10).
 *
 * Existe por causa de uma regra dura da §10.6: numero cru nao chega a tela. Ao
 * fixar `max` num eixo do ECharts, ele desenha um rotulo EXATAMENTE nesse
 * valor — e um maximo calculado como `103.9 * 1.12` virava
 * "116.36800000000002%" no canto do grafico. Fixar o maximo e obrigatorio
 * (a markArea dos quadrantes precisa de uma coordenada superior conhecida),
 * entao o jeito e fazer o maximo ja nascer redondo.
 */
function tetoBonito(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(valor))
  // Escada fina de proposito. Com [1, 2, 5, 10], um maximo de 110 subia para
  // 200 e achatava todos os pontos no rodape do grafico; os degraus
  // intermediarios mantem o teto colado nos dados sem abrir mao do numero
  // redondo.
  const passo = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(
    (p) => p * magnitude >= valor,
  )
  return (passo ?? 10) * magnitude
}

/**
 * Comparativo de Precos (§9.2) — um produto, todas as lojas.
 *
 * Le o preco VIGENTE de cada estabelecimento (ultimo `data_nf`), nunca a media
 * historica: a pergunta desta tela e "quanto custa hoje, onde", e uma media de
 * varias coletas responderia outra coisa.
 */
export default function Comparativo() {
  const estreita = useTelaEstreita()
  const filtros = useFiltros()
  const definir = useFiltros((s) => s.definir)
  const chave = chaveCache(filtros)
  const nomeProduto = useNomeProduto(filtros.ean)

  const consulta = useQuery({
    queryKey: ['comparativo', chave],
    queryFn: () => buscarComparativo(filtros),
    enabled: filtros.ean !== null,
  })

  // As duas consultas abaixo nao FILTRAM pelo EAN — elas leem o recorte
  // inteiro (ver comentario em buscarBoxplot). A matriz por isso nem carrega o
  // EAN na chave de cache: trocar de produto reaproveita o resultado. O
  // boxplot carrega, porque ali o EAN ORDENA (p_ean_destaque) e um resultado
  // cacheado de outro produto viria com a caixa errada no topo.
  const chaveSemEan = [
    filtros.dataIni,
    filtros.dataFim,
    filtros.cidade,
    filtros.ncmGrupo,
  ].join('|')

  const boxplot = useQuery({
    queryKey: ['boxplot', chaveSemEan, filtros.ean],
    queryFn: () => buscarBoxplot(filtros, { limite: 12 }),
  })
  const matriz = useQuery({
    queryKey: ['matriz-dispersao', chaveSemEan],
    queryFn: () => buscarMatrizDispersao(filtros),
  })

  const linhas = consulta.data ?? []
  const caixas = boxplot.data ?? []
  const pontos = matriz.data ?? []
  const primeira: LinhaComparativo | null = linhas[0] ?? null

  // As estatisticas vem repetidas em toda linha (a RPC faz cross join com o
  // agregado), entao basta ler a primeira.
  const precoMin = num(primeira?.preco_min)
  const precoMedio = num(primeira?.preco_medio)
  const precoMax = num(primeira?.preco_max)
  const spread = num(primeira?.spread_pct)

  const maisBarata = linhas[0] ?? null
  const maisCara = linhas.length > 1 ? (linhas[linhas.length - 1] ?? null) : null

  const opcao = useMemo<EChartsOption>(() => {
    // Barras horizontais: da mais cara no topo para a mais barata embaixo — o
    // eixo de categoria do ECharts cresce de baixo para cima.
    const dados = [...linhas].reverse()
    const media = precoMedio ?? 0

    return {
      // top folgado: o rotulo da linha de media e desenhado acima do grid.
      grid: { left: 8, right: 24, top: 26, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0]
          if (p === undefined) return ''
          const l = dados[p.dataIndex]
          if (l === undefined) return ''
          const desvio = num(l.desvio_media_pct)
          return [
            `<strong>${l.nome_estabelecimento ?? 'Sem nome'}</strong>`,
            [l.bairro, l.cidade].filter(Boolean).join(' · '),
            `${fmtMoeda(l.preco)} &nbsp; <span style="color:${
              desvio !== null && desvio > 0 ? T.dangerTxt : T.successTxt
            }">${fmtDelta(desvio)} vs. média</span>`,
            `Coleta: ${fmtData(l.data_nf)}`,
          ]
            .filter((s) => s !== '')
            .join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => fmtMoeda(v) },
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
      series: [
        {
          type: 'bar',
          barMaxWidth: 20,
          data: dados.map((l) => {
            const desvio = num(l.desvio_media_pct) ?? 0
            return {
              value: num(l.preco),
              itemStyle: {
                // Cor semantica: abaixo da media do mercado e uma oportunidade
                // de compra; acima, um alerta de preco.
                color: desvio > 0 ? T.danger : T.success,
                borderRadius: [0, 3, 3, 0],
              },
            }
          }),
          label: {
            show: !estreita,
            position: 'right',
            formatter: (p: { value: unknown }) => fmtMoeda(Number(p.value)),
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: T.gold, type: 'dashed', width: 1.5 },
            label: {
              formatter: `Média ${fmtMoeda(media)}`,
              color: T.goldBright,
              fontFamily: T.fontMono,
              fontSize: 10.5,
              // Sem `rotate: 0` o ECharts escreve o rotulo na vertical, ao
              // longo da linha — ilegivel e por cima dos valores das barras.
              rotate: 0,
              position: 'end',
              distance: 6,
            },
            data: [{ xAxis: media }],
          },
        },
      ],
    }
  }, [linhas, precoMedio, estreita])

  // ------------------------------------------------------------- boxplot
  const opBoxplot = useMemo<EChartsOption>(() => {
    // Eixo de categoria cresce de baixo para cima; invertendo, o produto em
    // destaque (que a RPC devolve em primeiro) fica no topo.
    const dados = [...caixas].reverse()

    // Outliers viram uma serie de pontos: eles ficam FORA dos whiskers por
    // definicao, entao desenha-los dentro da caixa seria contradizer a conta.
    const foraDaCerca: [number, number][] = []
    dados.forEach((c, i) => {
      c.outliers.forEach((v) => foraDaCerca.push([v, i]))
    })

    return {
      grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        // scale: true impede o eixo de comecar no zero — com precos entre
        // R$ 15 e R$ 30, ancorar no zero espremeria todas as caixas na direita.
        scale: true,
        axisLabel: { formatter: (v: number) => fmtMoeda(v) },
      },
      yAxis: {
        type: 'category',
        data: dados.map((c) => encurtar(c.nome_exibicao, estreita ? 16 : 30)),
        axisLabel: {
          width: estreita ? 92 : 200,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { seriesType?: string; dataIndex: number; value: unknown }

          if (p.seriesType === 'scatter') {
            const v = p.value as [number, number]
            const c = dados[v[1]]
            return [
              `<b>${c?.nome_exibicao ?? 'Sem nome'}</b>`,
              `Preço atípico: <b>${fmtMoeda(v[0])}</b>`,
              `<span style="color:${T.ink3}">Fora das cercas de Tukey (1,5 × IQR)</span>`,
            ].join('<br/>')
          }

          const c = dados[p.dataIndex]
          if (c === undefined) return ''
          return [
            `<b>${c.nome_exibicao ?? 'Sem nome'}</b>`,
            `EAN ${c.cod_barras}`,
            '',
            `Máximo: ${fmtMoeda(c.maximo)}`,
            `3º quartil: ${fmtMoeda(c.q3)}`,
            `<b>Mediana: ${fmtMoeda(c.mediana)}</b>`,
            `1º quartil: ${fmtMoeda(c.q1)}`,
            `Mínimo: ${fmtMoeda(c.minimo)}`,
            '',
            `${fmtInteiro(c.lojas)} lojas · amplitude ${fmtPercent(c.amplitude_pct)}`,
            c.outliers.length > 0
              ? `<span style="color:${T.dangerTxt}">${c.outliers.length} preço(s) atípico(s)</span>`
              : '',
          ]
            .filter((s) => s !== '')
            .join('<br/>')
        },
      },
      series: [
        {
          type: 'boxplot',
          layout: 'horizontal',
          boxWidth: [8, 26],
          data: dados.map((c) => {
            const destaque = String(c.cod_barras) === filtros.ean
            return {
              // A caixa desenha os WHISKERS (extremos dentro da cerca), nao o
              // min/max absolutos — senao o outlier seria contado duas vezes:
              // esticando o traco e como ponto solto.
              value: [
                num(c.whisker_inf) ?? 0,
                num(c.q1) ?? 0,
                num(c.mediana) ?? 0,
                num(c.q3) ?? 0,
                num(c.whisker_sup) ?? 0,
              ],
              itemStyle: {
                color: destaque ? 'rgba(212,175,55,0.20)' : 'rgba(91,143,249,0.10)',
                borderColor: destaque ? T.goldBright : T.ink3,
                borderWidth: destaque ? 2 : 1,
              },
            }
          }),
        },
        {
          type: 'scatter',
          symbolSize: 7,
          data: foraDaCerca,
          itemStyle: { color: T.danger, borderColor: T.panel, borderWidth: 1 },
          tooltip: { show: true },
        },
      ],
    }
  }, [caixas, estreita, filtros.ean])

  // -------------------------------------------------------------- matriz
  const opMatriz = useMemo<EChartsOption>(() => {
    if (pontos.length === 0) return {}

    // Os cortes vem repetidos em toda linha (cross join com as medianas do
    // recorte); basta ler a primeira.
    const cortePreco = num(pontos[0]?.corte_preco) ?? 0
    const corteDisp = num(pontos[0]?.corte_dispersao) ?? 0

    const xs = pontos.map((p) => num(p.preco_medio) ?? 0)
    const ys = pontos.map((p) => num(p.dispersao_pct) ?? 0)
    // A folga entra ANTES do arredondamento para que o ponto mais extremo nunca
    // encoste na borda do grid.
    const xMax = tetoBonito(Math.max(...xs) * 1.06)
    const yMax = tetoBonito(Math.max(...ys) * 1.06)

    return {
      // top folgado: o nome do eixo Y e escrito acima do grid e, apertado,
      // ele monta em cima do rotulo do valor maximo.
      grid: { left: 8, right: 28, top: 40, bottom: 34, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: xMax,
        name: 'Preço médio',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: T.ink3, fontSize: 11 },
        axisLabel: {
          formatter: (v: number | string) =>
            `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax,
        name: 'Dispersão',
        nameLocation: 'end',
        nameGap: 16,
        nameTextStyle: { color: T.ink3, fontSize: 11, align: 'left' },
        axisLabel: { formatter: (v: number | string) => `${v}%` },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { dataIndex: number }
          const d = pontos[p.dataIndex]
          if (d === undefined) return ''
          const q = QUADRANTES[d.quadrante]
          return [
            `<b>${d.nome_exibicao ?? 'Sem nome'}</b>`,
            `EAN ${d.cod_barras}`,
            `<span style="color:${q.cor}">■</span> ${q.rotulo}`,
            '',
            `Preço médio: ${fmtMoeda(d.preco_medio)}`,
            `Faixa: ${fmtMoeda(d.preco_min)} – ${fmtMoeda(d.preco_max)}`,
            `Dispersão: ${fmtPercent(d.dispersao_pct)} · amplitude ${fmtPercent(
              d.amplitude_pct,
            )}`,
            `${fmtInteiro(d.lojas)} lojas`,
          ].join('<br/>')
        },
      },
      series: [
        {
          type: 'scatter',
          data: pontos.map((d) => {
            const destaque = String(d.cod_barras) === filtros.ean
            const q = QUADRANTES[d.quadrante]
            return {
              value: [num(d.preco_medio) ?? 0, num(d.dispersao_pct) ?? 0],
              // O tamanho do ponto carrega a CONFIANCA: um item medido em 40
              // lojas nao vale o mesmo que um medido em 2, e o grafico
              // precisaria mentir para trata-los igual.
              symbolSize: Math.min(24, Math.max(8, 5 + Math.sqrt(d.lojas) * 2.8)),
              itemStyle: {
                color: q.cor,
                opacity: destaque ? 1 : 0.72,
                borderColor: destaque ? T.goldBright : 'transparent',
                borderWidth: destaque ? 2.5 : 0,
              },
              ...(destaque
                ? {
                    label: {
                      show: true,
                      position: 'top' as const,
                      formatter: encurtar(d.nome_exibicao, 22),
                      color: T.goldBright,
                      fontSize: 11,
                      fontWeight: 'bold' as const,
                    },
                  }
                : {}),
            }
          }),
          markArea: {
            silent: true,
            data: [
              [
                {
                  xAxis: cortePreco,
                  yAxis: corteDisp,
                  itemStyle: { color: QUADRANTES.oportunidade.fundo },
                },
                { xAxis: xMax, yAxis: yMax },
              ],
              [
                {
                  xAxis: cortePreco,
                  yAxis: 0,
                  itemStyle: { color: QUADRANTES.caro_estavel.fundo },
                },
                { xAxis: xMax, yAxis: corteDisp },
              ],
              [
                {
                  xAxis: 0,
                  yAxis: corteDisp,
                  itemStyle: { color: QUADRANTES.competitivo.fundo },
                },
                { xAxis: cortePreco, yAxis: yMax },
              ],
              [
                {
                  xAxis: 0,
                  yAxis: 0,
                  itemStyle: { color: QUADRANTES.consolidado.fundo },
                },
                { xAxis: cortePreco, yAxis: corteDisp },
              ],
            ],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: T.line, type: 'dashed' as const, width: 1 },
            label: { show: false },
            data: [{ xAxis: cortePreco }, { yAxis: corteDisp }],
          },
        },
      ],
    }
  }, [pontos, filtros.ean])

  /** Quantos produtos caem em cada quadrante — o resumo estratégico. */
  const resumoQuadrantes = useMemo(
    () =>
      ORDEM_QUADRANTES.map((id) => ({
        def: QUADRANTES[id],
        total: pontos.filter((p) => p.quadrante === id).length,
        temSelecionado: pontos.some(
          (p) => p.quadrante === id && String(p.cod_barras) === filtros.ean,
        ),
      })),
    [pontos, filtros.ean],
  )

  // ------------------------------------------------------------------ render
  const cabecalho = (
    <CabecalhoPagina
      titulo="Comparativo de Preços"
      contexto={[
        nomeProduto,
        filtros.ean !== null ? `EAN ${filtros.ean}` : null,
        linhas.length > 0 ? `${fmtInteiro(linhas.length)} lojas com preço vigente` : null,
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
        <SeletorProduto />
      </div>
    )
  }

  return (
    <div>
      {cabecalho}

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          <CardKpi
            rotulo="Menor preço"
            valor={fmtMoeda(precoMin)}
            delta={encurtar(maisBarata?.nome_estabelecimento ?? null, 26)}
            tom="positivo"
            carregando={consulta.isPending}
            destaque
          />
          <CardKpi
            rotulo="Preço médio"
            valor={fmtMoeda(precoMedio)}
            delta="entre as lojas que vendem o item"
            carregando={consulta.isPending}
          />
          <CardKpi
            rotulo="Maior preço"
            valor={fmtMoeda(precoMax)}
            delta={encurtar(maisCara?.nome_estabelecimento ?? null, 26)}
            tom="negativo"
            carregando={consulta.isPending}
          />
          <CardKpi
            rotulo="Spread"
            valor={fmtPercent(spread)}
            delta="do menor para o maior preço"
            tom={spread !== null && spread > 30 ? 'negativo' : 'neutro'}
            carregando={consulta.isPending}
          />
        </div>

        <Secao
          eyebrow="Preço vigente"
          titulo="Quanto cada loja está cobrando"
          descricao="Último preço coletado por estabelecimento, do mais barato ao mais caro. Verde está abaixo da média de mercado do item; vermelho, acima. A linha dourada marca a média."
          acessorio={
            linhas.length > 0 ? (
              <TagSecao>
                <span className="num">{linhas.length}</span> lojas
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opcao}
            altura={Math.max(260, linhas.length * 34)}
            carregando={consulta.isPending}
            erro={consulta.isError ? consulta.error.message : null}
            vazio={consulta.isSuccess && linhas.length === 0}
            mensagemVazio="Nenhuma loja tem preço deste produto no recorte atual. Amplie o período ou remova o filtro de cidade."
            onTentarNovamente={() => void consulta.refetch()}
          />
        </Secao>

        {linhas.length > 0 && (
          <Secao
            eyebrow="Detalhe"
            titulo="Preço por estabelecimento"
            descricao="A coluna de desvio compara o preço da loja com a média de mercado deste produto. Use a data da coleta para saber o quanto o preço é recente."
          >
            <Tabela>
              <thead>
                <tr>
                  <Th>Estabelecimento</Th>
                  <Th>Local</Th>
                  <Th numerica>Preço</Th>
                  <Th numerica>vs. média</Th>
                  <Th numerica>Coleta</Th>
                  <Th>Posição</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const desvio = num(l.desvio_media_pct)
                  return (
                    <Tr key={l.cnpj_estabelecimento}>
                      <Td forte>{l.nome_estabelecimento ?? 'Sem nome'}</Td>
                      <Td>{[l.bairro, l.cidade].filter(Boolean).join(' · ') || '—'}</Td>
                      <Td numerica forte>
                        {fmtMoeda(l.preco)}
                      </Td>
                      <Td
                        numerica
                        className={
                          desvio === null
                            ? undefined
                            : desvio > 0
                              ? 'text-danger-txt'
                              : 'text-success-txt'
                        }
                      >
                        {fmtDelta(desvio)}
                      </Td>
                      <Td numerica>{fmtData(l.data_nf)}</Td>
                      <Td>
                        {desvio === null ? (
                          '—'
                        ) : desvio <= -5 ? (
                          <Etiqueta tom="ok">Abaixo do mercado</Etiqueta>
                        ) : desvio >= 5 ? (
                          <Etiqueta tom="critico">Acima do mercado</Etiqueta>
                        ) : (
                          <Etiqueta tom="neutro">Na média</Etiqueta>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Tabela>
          </Secao>
        )}

        {/* --------------------------------------------------------- boxplot */}
        <Secao
          eyebrow="Distribuição"
          titulo="Boxplot de preço por produto"
          descricao="A caixa cobre a metade central das lojas (do 1º ao 3º quartil) e a linha interna é a mediana. Os traços vão até o menor e o maior preço dentro do normal estatístico; os pontos vermelhos são preços atípicos, fora de 1,5 × a altura da caixa. Ler a caixa em vez da média mostra se o preço está concentrado ou espalhado."
          acessorio={
            caixas.length > 0 ? (
              <TagSecao>
                <span className="num">{caixas.length}</span> produtos comparáveis
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opBoxplot}
            altura={Math.max(260, caixas.length * 40)}
            carregando={boxplot.isPending}
            erro={boxplot.isError ? boxplot.error.message : null}
            vazio={boxplot.isSuccess && caixas.length === 0}
            mensagemVazio="Nenhum produto aparece em duas ou mais lojas neste recorte, então não há distribuição para medir. Amplie o período ou remova filtros."
            onTentarNovamente={() => void boxplot.refetch()}
          />

          {caixas.length > 0 && (
            <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
              O produto selecionado aparece em destaque, no topo. Os demais estão
              aqui de propósito: uma caixa sozinha não tem com o que ser comparada.
            </p>
          )}
        </Secao>

        {/* ---------------------------------------------------------- matriz */}
        <Secao
          eyebrow="Mapa estratégico"
          titulo="Matriz Preço × Dispersão"
          descricao="Cada bolha é um produto: o eixo horizontal é o preço médio entre as lojas e o vertical, o quanto esse preço varia. As linhas tracejadas são as medianas do recorte — é o que separa “alto” de “baixo” aqui dentro, e por isso os quadrantes se ajustam quando você troca o filtro. O tamanho da bolha indica em quantas lojas o item foi medido."
          acessorio={
            pontos.length > 0 ? (
              <TagSecao>
                <span className="num">{pontos.length}</span> produtos mapeados
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opMatriz}
            altura={380}
            carregando={matriz.isPending}
            erro={matriz.isError ? matriz.error.message : null}
            vazio={matriz.isSuccess && pontos.length === 0}
            mensagemVazio="Nenhum produto tem preço em duas ou mais lojas neste recorte, então não há dispersão para mapear. Amplie o período ou remova filtros."
            onTentarNovamente={() => void matriz.refetch()}
          />

          {/* A legenda dos quadrantes e o resumo em um componente so: o numero
              de produtos ao lado do rotulo e o que transforma a legenda em
              leitura ("onde esta o meu catalogo?"). */}
          {pontos.length > 0 && (
            <div className="mt-5 grid gap-3 border-t border-line-soft pt-5 sm:grid-cols-2 xl:grid-cols-4">
              {resumoQuadrantes.map(({ def, total, temSelecionado }) => (
                <div
                  key={def.id}
                  className={`rounded-card border px-3.5 py-3 ${
                    temSelecionado
                      ? 'border-gold/45 bg-gold/5'
                      : 'border-line-soft bg-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-badge"
                      style={{ backgroundColor: def.cor }}
                      aria-hidden
                    />
                    <p className="text-[12.5px] font-semibold text-ink">{def.rotulo}</p>
                    <span className="num ml-auto text-[13px] font-bold text-ink">
                      {fmtInteiro(total)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] uppercase tracking-[0.4px] text-ink-3">
                    {def.criterio}
                  </p>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">
                    {def.leitura}
                  </p>
                  {temSelecionado && (
                    <p className="mt-2 text-[11px] font-semibold text-gold-bright">
                      O produto selecionado está aqui
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Secao>
      </div>
    </div>
  )
}
