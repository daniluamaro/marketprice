import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  buscarAbaixoMercado,
  buscarIpp,
  buscarRanking,
  type LinhaRanking,
} from '@/lib/rpc'
import { chaveCache, useFiltros } from '@/store/filtros'
import { fmtDelta, fmtInteiro, fmtMoeda, fmtPercent, num } from '@/lib/format'
import { FAIXAS_IPP, faixaIpp, fmtIpp } from '@/lib/ipp'
import { encurtar, useTelaEstreita } from '@/lib/tela'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { CardKpi } from '@/components/ui/kpi'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Grafico } from '@/components/ui/Grafico'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { Etiqueta } from '@/components/ui/etiqueta'
import { EstadoErro, EstadoVazio, Skeleton } from '@/components/ui/estados'
import { Button } from '@/components/ui/button'
import { T } from '@/lib/tokens'

/**
 * Ranking de Estabelecimentos (§9.3) — indice de competitividade por loja.
 *
 * O indice e a MEDIA DAS RAZOES (preco da loja ÷ media de mercado daquele EAN),
 * nunca a razao das medias. A diferenca importa: uma loja que so vende itens
 * caros teria "preco medio alto" sem cobrar um centavo a mais que as outras —
 * o indice neutraliza o sortimento e mede so a politica de preco.
 *
 *   < 1,00 = mais barata que o mercado    > 1,00 = mais cara
 */

type Coluna =
  | 'nome_estabelecimento'
  | 'cidade'
  | 'produtos_comparados'
  | 'preco_medio_loja'
  | 'indice_competitividade'

/**
 * Minimo de produtos em comum para uma loja entrar no comparativo.
 *
 * Era um seletor (1/3/5/10) na interface; virou constante em 1 a pedido do
 * Danilo. Com 1, qualquer loja que tenha ao menos um item comparavel aparece —
 * o que e o comportamento certo quando se filtra um produto especifico no topo,
 * caso em que um corte maior zerava a tela inteira.
 */
const MIN_PRODUTOS_COMUM = 1

/**
 * Tamanho da pagina da tabela de IPP.
 *
 * A paginacao aqui e no CLIENTE, ao contrario da tela de Dados Detalhados, que
 * pagina no servidor. O motivo e que o heatmap desta mesma tela precisa da
 * matriz inteira de uma vez — os dados ja estao na memoria, e pedi-los de novo
 * fatiados seria uma ida a rede por pagina sem ganho nenhum.
 */
const POR_PAGINA = 20

export default function Ranking() {
  const estreita = useTelaEstreita()
  const filtros = useFiltros()
  const chave = chaveCache(filtros)

  const [ordem, setOrdem] = useState<{ coluna: Coluna; asc: boolean }>({
    coluna: 'indice_competitividade',
    asc: true,
  })

  const [buscaIpp, setBuscaIpp] = useState('')
  const [paginaIpp, setPaginaIpp] = useState(0)

  const consulta = useQuery({
    queryKey: ['ranking-tela', chave],
    queryFn: () =>
      buscarRanking(filtros, { minProdutos: MIN_PRODUTOS_COMUM, limite: 200 }),
  })

  const abaixo = useQuery({
    queryKey: ['abaixo-mercado', chave],
    queryFn: () => buscarAbaixoMercado(filtros),
  })

  const ipp = useQuery({
    queryKey: ['ipp', chave],
    queryFn: () => buscarIpp(filtros),
  })

  const linhas = consulta.data ?? []
  const celulas = ipp.data ?? []

  const maisBarata = linhas[0] ?? null
  const maisCara = linhas.length > 1 ? (linhas[linhas.length - 1] ?? null) : null

  const mediana = useMemo(() => {
    const vals = linhas
      .map((l) => num(l.indice_competitividade))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
    if (vals.length === 0) return null
    const meio = Math.floor(vals.length / 2)
    return vals.length % 2 === 0
      ? ((vals[meio - 1] ?? 0) + (vals[meio] ?? 0)) / 2
      : (vals[meio] ?? null)
  }, [linhas])

  // ------------------------------------------------------------------ tabela
  const ordenadas = useMemo(() => {
    const copia = [...linhas]
    const { coluna, asc } = ordem
    copia.sort((a, b) => {
      const va = valorDe(a, coluna)
      const vb = valorDe(b, coluna)
      if (va === null) return 1
      if (vb === null) return -1
      const cmp =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb, 'pt-BR')
          : Number(va) - Number(vb)
      return asc ? cmp : -cmp
    })
    return copia
  }, [linhas, ordem])

  function alternar(coluna: Coluna) {
    setOrdem((o) =>
      o.coluna === coluna ? { coluna, asc: !o.asc } : { coluna, asc: true },
    )
  }

  const dir = (c: Coluna) =>
    ordem.coluna === c ? (ordem.asc ? ('asc' as const) : ('desc' as const)) : null

  // ------------------------------------------ grafico: itens abaixo do mercado
  const linhasAbaixo = abaixo.data ?? []
  const topAbaixo = useMemo(() => linhasAbaixo.slice(0, 15), [linhasAbaixo])

  const opAbaixo = useMemo<EChartsOption>(() => {
    // Eixo de categoria cresce de baixo para cima: invertido, o campeao fica
    // no topo.
    const dados = [...topAbaixo].reverse()

    return {
      grid: { left: 8, right: estreita ? 44 : 96, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { formatter: (v: number | string) => fmtInteiro(Number(v)) },
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
          return [
            `<b>${l.nome_estabelecimento ?? 'Sem nome'}</b>`,
            [l.bairro, l.cidade].filter(Boolean).join(' · '),
            `<b>${fmtInteiro(l.itens_abaixo)}</b> de ${fmtInteiro(
              l.itens_comparados,
            )} itens abaixo da média (${fmtPercent(l.pct_abaixo)})`,
            `Desconto médio onde ganha: ${fmtMoeda(l.economia_media)}`,
            `IPP médio da loja: ${fmtIpp(num(l.ipp_medio))}`,
          ]
            .filter((s) => s !== '')
            .join('<br/>')
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: dados.map((l) => l.itens_abaixo),
          itemStyle: {
            borderRadius: [0, 3, 3, 0],
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#1F7A57' },
                { offset: 1, color: T.success },
              ],
            },
          },
          label: {
            show: !estreita,
            position: 'right',
            // O rotulo traz o denominador porque "13 itens abaixo" significa
            // coisas opostas em 13 de 13 e em 13 de 40.
            formatter: (p: { dataIndex: number }) => {
              const l = dados[p.dataIndex]
              if (!l) return ''
              return `${l.itens_abaixo} de ${l.itens_comparados}`
            },
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.successTxt,
          },
        },
      ],
    }
  }, [topAbaixo, estreita])

  // --------------------------------------------------------------- heatmap IPP
  /**
   * A matriz produto x loja e MUITO esparsa: 20 produtos por 90 lojas dariam
   * 1.800 celulas para ~330 preços reais, ou seja, mais de 80% de buraco. Um
   * heatmap assim nao mostra padrao nenhum — mostra ausencia de dado.
   *
   * A saida e recortar o bloco mais denso: os produtos presentes em mais lojas
   * e as lojas que cobrem mais desses produtos. A leitura fica sobre quem
   * realmente da para comparar, e a tabela abaixo continua com tudo.
   */
  const matriz = useMemo(() => {
    if (celulas.length === 0) {
      return { produtos: [], lojas: [], pontos: [], desvioMax: 20, densidade: 0 }
    }

    const porProduto = new Map<number, { nome: string; n: number }>()
    for (const c of celulas) {
      const at = porProduto.get(c.cod_barras)
      if (at === undefined) {
        porProduto.set(c.cod_barras, {
          nome: c.nome_exibicao ?? String(c.cod_barras),
          n: 1,
        })
      } else at.n += 1
    }
    const produtos = [...porProduto.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 12)
    const idsProduto = new Set(produtos.map(([id]) => id))

    // As lojas sao escolhidas pela cobertura DENTRO dos produtos ja escolhidos:
    // uma loja campea em itens que ficaram de fora nao ajudaria a preencher.
    const porLoja = new Map<string, { nome: string; n: number }>()
    for (const c of celulas) {
      if (!idsProduto.has(c.cod_barras)) continue
      const at = porLoja.get(c.cnpj_estabelecimento)
      if (at === undefined) {
        porLoja.set(c.cnpj_estabelecimento, {
          nome: c.nome_estabelecimento ?? c.cnpj_estabelecimento,
          n: 1,
        })
      } else at.n += 1
    }
    const lojas = [...porLoja.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 18)
    const idxLoja = new Map(lojas.map(([cnpj], i) => [cnpj, i]))
    const idxProduto = new Map(produtos.map(([id], i) => [id, i]))

    const pontos: [number, number, number][] = []
    let desvioMax = 8
    for (const c of celulas) {
      const x = idxLoja.get(c.cnpj_estabelecimento)
      const y = idxProduto.get(c.cod_barras)
      const v = num(c.ipp)
      if (x === undefined || y === undefined || v === null) continue
      pontos.push([x, y, v])
      desvioMax = Math.max(desvioMax, Math.abs(v - 100))
    }

    return {
      produtos,
      lojas,
      pontos,
      // Escala simetrica em torno de 100 e limitada a 60: sem o teto, um unico
      // item 300% acima achataria todo o resto para o mesmo tom neutro.
      desvioMax: Math.min(Math.ceil(desvioMax / 5) * 5, 60),
      densidade:
        produtos.length * lojas.length === 0
          ? 0
          : (pontos.length / (produtos.length * lojas.length)) * 100,
    }
  }, [celulas])

  const opHeatmap = useMemo<EChartsOption>(() => {
    const { produtos, lojas, pontos, desvioMax } = matriz

    return {
      grid: { left: 8, right: 12, top: 8, bottom: 56, containLabel: true },
      xAxis: {
        type: 'category',
        data: lojas.map(([, l]) => encurtar(l.nome, estreita ? 10 : 18)),
        axisLabel: {
          rotate: 45,
          fontSize: estreita ? 8.5 : 9.5,
          interval: 0,
        },
        splitArea: { show: true, areaStyle: { color: ['transparent'] } },
      },
      yAxis: {
        type: 'category',
        data: produtos.map(([, p]) => encurtar(p.nome, estreita ? 14 : 26)),
        axisLabel: { fontSize: estreita ? 9 : 10.5 },
      },
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number] }
          const [x, y, v] = p.data
          const loja = lojas[x]?.[1].nome ?? ''
          const prod = produtos[y]?.[1].nome ?? ''
          const f = faixaIpp(v)
          return [
            `<b>${prod}</b>`,
            loja,
            `IPP <span style="font-family:${T.fontMono}">${fmtIpp(v)}</span> — ${
              f?.rotulo ?? '—'
            }`,
            `${v > 100 ? '+' : ''}${(v - 100).toFixed(1)}% vs. média do item`,
          ].join('<br/>')
        },
      },
      visualMap: {
        min: 100 - desvioMax,
        max: 100 + desvioMax,
        calculable: false,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 0,
        itemHeight: estreita ? 110 : 180,
        itemWidth: 11,
        precision: 0,
        textStyle: { color: T.ink2, fontSize: 10 },
        text: ['mais caro', 'mais barato'],
        inRange: {
          color: [T.success, T.successTxt, T.ink3, T.dangerTxt, T.danger],
        },
      },
      series: [
        {
          type: 'heatmap',
          data: pontos,
          progressive: 0,
          label: {
            show: !estreita,
            formatter: (p: { data: unknown }) =>
              fmtIpp((p.data as [number, number, number])[2]),
            fontFamily: T.fontMono,
            fontSize: 9.5,
            color: T.base,
          },
          itemStyle: { borderColor: T.panel, borderWidth: 1, borderRadius: 2 },
          emphasis: { itemStyle: { borderColor: T.goldBright, borderWidth: 1.5 } },
        },
      ],
    }
  }, [matriz, estreita])

  // ------------------------------------------------------------- tabela do IPP
  const celulasFiltradas = useMemo(() => {
    const termo = buscaIpp.trim().toLowerCase()
    const base =
      termo === ''
        ? celulas
        : celulas.filter((c) =>
            `${c.nome_exibicao ?? ''} ${c.cod_barras} ${c.nome_estabelecimento ?? ''}`
              .toLowerCase()
              .includes(termo),
          )
    // Do mais caro para o mais barato: o topo da lista e onde ha o que corrigir.
    return [...base].sort((a, b) => (num(b.ipp) ?? 0) - (num(a.ipp) ?? 0))
  }, [celulas, buscaIpp])

  // Buscar ou trocar o recorte invalida a pagina atual: ficar na pagina 8 de um
  // resultado que agora tem 2 mostraria um vazio que nao existe.
  useEffect(() => {
    setPaginaIpp(0)
  }, [buscaIpp, chave])

  const totalPaginasIpp = Math.max(1, Math.ceil(celulasFiltradas.length / POR_PAGINA))
  const paginaAtualIpp = Math.min(paginaIpp, totalPaginasIpp - 1)
  const celulasPagina = celulasFiltradas.slice(
    paginaAtualIpp * POR_PAGINA,
    (paginaAtualIpp + 1) * POR_PAGINA,
  )
  const primeiraIpp = celulasFiltradas.length === 0 ? 0 : paginaAtualIpp * POR_PAGINA + 1
  const ultimaIpp = Math.min(celulasFiltradas.length, (paginaAtualIpp + 1) * POR_PAGINA)

  const resumoFaixas = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const c of celulas) {
      const f = faixaIpp(num(c.ipp))
      if (f === null) continue
      contagem.set(f.rotulo, (contagem.get(f.rotulo) ?? 0) + 1)
    }
    return contagem
  }, [celulas])

  // ------------------------------------------------------------------ grafico
  // Com muitas lojas o grafico deixa de ser legivel; a tabela abaixo cobre a
  // lista inteira, entao aqui ficam apenas os extremos.
  const extremos = useMemo(() => {
    if (linhas.length <= 16) return linhas
    return [...linhas.slice(0, 8), ...linhas.slice(-8)]
  }, [linhas])

  const opcao = useMemo<EChartsOption>(() => {
    const dados = [...extremos].reverse()
    const maior = dados.reduce((m, l) => {
      const d = Math.abs(((num(l.indice_competitividade) ?? 1) - 1) * 100)
      return d > m ? d : m
    }, 5)
    const limite = Math.ceil((maior * 1.25) / 5) * 5

    return {
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0]
          if (p === undefined) return ''
          const l = dados[p.dataIndex]
          if (l === undefined) return ''
          return [
            `<strong>${l.nome_estabelecimento ?? 'Sem nome'}</strong>`,
            [l.bairro, l.cidade].filter(Boolean).join(' · '),
            `Índice: <span style="font-family:${T.fontMono}">${(
              num(l.indice_competitividade) ?? 0
            ).toFixed(3)}</span>`,
            `Preço médio: ${fmtMoeda(l.preco_medio_loja)} (mercado ${fmtMoeda(
              l.preco_medio_mercado,
            )})`,
            `${fmtInteiro(l.produtos_comparados)} produtos comparados`,
          ]
            .filter((s) => s !== '')
            .join('<br/>')
        },
      },
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
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: dados.map((l) => {
            const desvio = ((num(l.indice_competitividade) ?? 1) - 1) * 100
            return {
              value: desvio,
              itemStyle: {
                color: desvio > 0 ? T.danger : T.success,
                borderRadius: 3,
              },
              label: {
                // A cor PRECISA vir por item. Sem ela o ECharts aplica o
                // default dele — texto preto com contorno branco — que nao tem
                // nada a ver com o tema e fica ilegivel sobre o fundo escuro.
                color: desvio <= 0 ? T.successTxt : T.dangerTxt,
                // A posicao tambem vai por item porque o tipo do ECharts nao
                // aceita funcao aqui, e barra divergente precisa do rotulo do
                // lado de fora da barra, dos dois lados do zero.
                position: desvio < 0 ? ('left' as const) : ('right' as const),
              },
            }
          }),
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

  return (
    <div>
      <CabecalhoPagina
        titulo="Ranking de Estabelecimentos"
        contexto={[
          linhas.length > 0 ? `${fmtInteiro(linhas.length)} lojas comparáveis` : null,
          celulas.length > 0 ? `${fmtInteiro(celulas.length)} pares produto × loja` : null,
        ]}
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <CardKpi
            rotulo="Loja mais competitiva"
            valor={fmtDelta(((num(maisBarata?.indice_competitividade) ?? 1) - 1) * 100)}
            delta={encurtar(maisBarata?.nome_estabelecimento ?? null, 30)}
            tom="positivo"
            carregando={consulta.isPending}
            destaque
          />
          <CardKpi
            rotulo="Índice mediano"
            valor={mediana === null ? '—' : mediana.toFixed(3).replace('.', ',')}
            delta="1,000 = exatamente na média do mercado"
            carregando={consulta.isPending}
          />
          <CardKpi
            rotulo="Loja mais cara"
            valor={fmtDelta(((num(maisCara?.indice_competitividade) ?? 1) - 1) * 100)}
            delta={encurtar(maisCara?.nome_estabelecimento ?? null, 30)}
            tom="negativo"
            carregando={consulta.isPending}
          />
        </div>

        <Secao
          eyebrow="Competitividade"
          titulo="Quem está acima e abaixo do mercado"
          descricao="Para cada loja comparamos o preço dela com a média de mercado do mesmo produto, item a item, e tiramos a média dessas comparações. Assim o sortimento da loja não distorce o resultado."
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
            altura={Math.max(240, extremos.length * 34)}
            carregando={consulta.isPending}
            erro={consulta.isError ? consulta.error.message : null}
            vazio={consulta.isSuccess && linhas.length === 0}
            mensagemVazio="Nenhuma loja atinge o mínimo de produtos em comum neste recorte. Reduza o mínimo ou amplie o período."
            onTentarNovamente={() => void consulta.refetch()}
          />
        </Secao>

        {/* ---------------------------------------------- itens abaixo da média */}
        <Secao
          eyebrow="Cobertura competitiva"
          titulo="Lojas com mais itens abaixo da média de mercado"
          descricao="Conta em quantos produtos cada loja pratica preço menor que a média de mercado daquele item. É uma leitura diferente do índice acima: lá se mede o quanto a loja é barata; aqui, em quantos itens ela ganha. Uma loja pode ser muito barata em três produtos e cara no resto."
          acessorio={
            linhasAbaixo.length > 0 ? (
              <TagSecao>
                {linhasAbaixo.length > topAbaixo.length ? (
                  <>
                    top <span className="num">{topAbaixo.length}</span> de{' '}
                    <span className="num">{linhasAbaixo.length}</span> lojas
                  </>
                ) : (
                  <>
                    <span className="num">{linhasAbaixo.length}</span> lojas
                  </>
                )}
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opAbaixo}
            altura={Math.max(240, topAbaixo.length * 34)}
            carregando={abaixo.isPending}
            erro={abaixo.isError ? abaixo.error.message : null}
            vazio={abaixo.isSuccess && linhasAbaixo.length === 0}
            mensagemVazio="Nenhum produto aparece em duas ou mais lojas neste recorte, então não há média de mercado para comparar."
            onTentarNovamente={() => void abaixo.refetch()}
          />

          {linhasAbaixo.length > 0 && (
            <div className="mt-6 border-t border-line-soft pt-5">
              <Tabela>
                <thead>
                  <tr>
                    <Th>Estabelecimento</Th>
                    <Th>Local</Th>
                    <Th numerica>Itens comparados</Th>
                    <Th numerica>Abaixo da média</Th>
                    <Th numerica>Acima da média</Th>
                    <Th numerica>% abaixo</Th>
                    <Th numerica>Desconto médio</Th>
                    <Th numerica>IPP médio</Th>
                  </tr>
                </thead>
                <tbody>
                  {linhasAbaixo.map((l) => {
                    const pct = num(l.pct_abaixo) ?? 0
                    return (
                      <Tr key={l.cnpj_estabelecimento}>
                        <Td forte>
                          <span className="block max-w-70 truncate">
                            {l.nome_estabelecimento ?? 'Sem nome'}
                          </span>
                        </Td>
                        <Td>
                          <span className="block max-w-55 truncate">
                            {[l.bairro, l.cidade].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </Td>
                        <Td numerica>{fmtInteiro(l.itens_comparados)}</Td>
                        <Td numerica forte className="text-success-txt">
                          {fmtInteiro(l.itens_abaixo)}
                        </Td>
                        <Td numerica className="text-danger-txt">
                          {fmtInteiro(l.itens_acima)}
                        </Td>
                        <Td numerica>
                          {pct >= 75 ? (
                            <Etiqueta tom="ok">{fmtPercent(pct)}</Etiqueta>
                          ) : pct >= 40 ? (
                            <Etiqueta tom="neutro">{fmtPercent(pct)}</Etiqueta>
                          ) : (
                            <Etiqueta tom="critico">{fmtPercent(pct)}</Etiqueta>
                          )}
                        </Td>
                        <Td numerica>{fmtMoeda(l.economia_media)}</Td>
                        <Td numerica>{fmtIpp(num(l.ipp_medio))}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Tabela>
            </div>
          )}
        </Secao>

        {/* ------------------------------------------------------- heatmap IPP */}
        <Secao
          eyebrow="Posicionamento"
          titulo="Mapa de competitividade por produto e loja"
          descricao={`Cada célula é o Índice de Posicionamento de Preço (IPP) de um produto numa loja: o preço dela dividido pela média de mercado do mesmo item, vezes 100. Verde está mais barato que o mercado, vermelho mais caro, cinza alinhado. Célula vazia significa que aquela loja não vende o item. São mostrados os ${matriz.produtos.length} produtos com maior cobertura e as ${matriz.lojas.length} lojas que mais os vendem.`}
          acessorio={
            matriz.pontos.length > 0 ? (
              <TagSecao>
                <span className="num">{matriz.pontos.length}</span> células ·{' '}
                <span className="num">{matriz.densidade.toFixed(0)}%</span> preenchida
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opHeatmap}
            altura={Math.max(300, matriz.produtos.length * 30 + 150)}
            carregando={ipp.isPending}
            erro={ipp.isError ? ipp.error.message : null}
            vazio={ipp.isSuccess && matriz.pontos.length === 0}
            mensagemVazio="Nenhum produto aparece em duas ou mais lojas neste recorte, então não há posicionamento a comparar."
            onTentarNovamente={() => void ipp.refetch()}
          />

          {/* Legenda das faixas — a mesma classificação usada na tabela. */}
          {matriz.pontos.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft pt-4">
              {FAIXAS_IPP.map(({ faixa, descricao }) => (
                <span key={faixa.rotulo} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-badge"
                    style={{ background: faixa.cor }}
                    aria-hidden
                  />
                  <span className="text-[11.5px] text-ink-2">
                    {faixa.rotulo}{' '}
                    <span className="num text-ink-3">({descricao})</span>
                  </span>
                  <span className="num text-[11.5px] font-semibold text-ink">
                    {fmtInteiro(resumoFaixas.get(faixa.rotulo) ?? 0)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </Secao>

        {/* ---------------------------------------------------- tabela do IPP */}
        <Secao
          eyebrow="Índice de Posicionamento"
          titulo="IPP de cada produto em cada loja"
          descricao="Uma linha por par produto × estabelecimento, do mais caro para o mais barato em relação ao mercado. Só entram itens vendidos por duas lojas ou mais — com uma única loja, a média de mercado seria o próprio preço dela e o índice sairia 100 sempre."
          acessorio={
            <div className="flex flex-wrap items-center gap-2">
              {celulas.length > 0 && (
                <TagSecao>
                  <span className="num">{fmtInteiro(celulasFiltradas.length)}</span> pares
                </TagSecao>
              )}
              <div className="flex items-center gap-2 rounded-chip border border-line bg-elevated px-3 py-1.5 focus-within:border-gold/45">
                <Search className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                <input
                  value={buscaIpp}
                  onChange={(e) => setBuscaIpp(e.target.value)}
                  placeholder="Buscar produto, EAN ou loja..."
                  aria-label="Buscar na tabela de IPP"
                  className="w-47.5 bg-transparent text-[12px] text-ink placeholder:text-ink-3 focus:outline-none"
                />
              </div>
            </div>
          }
        >
          {ipp.isPending && (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}

          {ipp.isError && (
            <EstadoErro
              descricao={ipp.error.message}
              onTentarNovamente={() => void ipp.refetch()}
            />
          )}

          {ipp.isSuccess && celulasFiltradas.length === 0 && (
            <EstadoVazio
              descricao={
                buscaIpp.trim() === ''
                  ? 'Nenhum produto aparece em duas ou mais lojas neste recorte.'
                  : `Nada encontrado para “${buscaIpp}”.`
              }
            />
          )}

          {ipp.isSuccess && celulasFiltradas.length > 0 && (
            <>
              <Tabela>
                <thead>
                  <tr>
                    <Th>Produto</Th>
                    <Th numerica>EAN</Th>
                    <Th>Estabelecimento</Th>
                    <Th numerica>Preço</Th>
                    <Th numerica>Média mercado</Th>
                    <Th numerica>Índice</Th>
                    <Th>Posição</Th>
                  </tr>
                </thead>
                <tbody>
                  {celulasPagina.map((c) => {
                    const v = num(c.ipp)
                    const f = faixaIpp(v)
                    return (
                      <Tr key={`${c.cod_barras}-${c.cnpj_estabelecimento}`}>
                        <Td forte>
                          <span className="block max-w-55 truncate">
                            {c.nome_exibicao ?? 'Sem nome'}
                          </span>
                        </Td>
                        <Td numerica>{c.cod_barras}</Td>
                        <Td>
                          <span className="block max-w-55 truncate">
                            {c.nome_estabelecimento ?? 'Sem nome'}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] text-ink-3">
                            {[c.bairro, c.cidade].filter(Boolean).join(' · ')}
                          </span>
                        </Td>
                        <Td numerica forte>
                          {fmtMoeda(c.preco)}
                        </Td>
                        <Td numerica>{fmtMoeda(c.preco_medio_mercado)}</Td>
                        <Td
                          numerica
                          className={
                            v === null
                              ? undefined
                              : v < 97
                                ? 'text-success-txt'
                                : v > 103
                                  ? 'text-danger-txt'
                                  : undefined
                          }
                        >
                          {fmtIpp(v)}
                        </Td>
                        <Td>
                          {f === null ? '—' : <Etiqueta tom={f.tom}>{f.rotulo}</Etiqueta>}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Tabela>

              {/* ------------------------------------------------ paginação */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <p className="text-[12px] text-ink-2">
                  Mostrando{' '}
                  <span className="num text-ink">
                    {fmtInteiro(primeiraIpp)}–{fmtInteiro(ultimaIpp)}
                  </span>{' '}
                  de{' '}
                  <span className="num text-ink">
                    {fmtInteiro(celulasFiltradas.length)}
                  </span>{' '}
                  pares
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaIpp((p) => Math.max(0, p - 1))}
                    disabled={paginaAtualIpp === 0}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                    Anterior
                  </Button>
                  <span className="num text-[12px] text-ink-2">
                    {paginaAtualIpp + 1} / {totalPaginasIpp}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPaginaIpp((p) => Math.min(totalPaginasIpp - 1, p + 1))
                    }
                    disabled={paginaAtualIpp >= totalPaginasIpp - 1}
                    aria-label="Próxima página"
                  >
                    Próxima
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Secao>

        <Secao
          eyebrow="Detalhe"
          titulo="Todas as lojas comparáveis"
          descricao="Clique em qualquer cabeçalho para reordenar. O preço médio da loja é comparável ao do mercado porque considera apenas os produtos que ela realmente vende."
          acessorio={
            linhas.length > 0 ? (
              <TagSecao>
                <span className="num">{linhas.length}</span> lojas
              </TagSecao>
            ) : undefined
          }
        >
          {consulta.isPending && (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}

          {consulta.isError && (
            <EstadoErro
              descricao={consulta.error.message}
              onTentarNovamente={() => void consulta.refetch()}
            />
          )}

          {consulta.isSuccess && linhas.length === 0 && (
            <EstadoVazio descricao="Nenhuma loja atinge o mínimo de produtos em comum neste recorte." />
          )}

          {consulta.isSuccess && linhas.length > 0 && (
            <Tabela>
              <thead>
                <tr>
                  <Th
                    ordenavel
                    direcao={dir('nome_estabelecimento')}
                    onClick={() => alternar('nome_estabelecimento')}
                  >
                    Estabelecimento
                  </Th>
                  <Th ordenavel direcao={dir('cidade')} onClick={() => alternar('cidade')}>
                    Local
                  </Th>
                  <Th
                    numerica
                    ordenavel
                    direcao={dir('produtos_comparados')}
                    onClick={() => alternar('produtos_comparados')}
                  >
                    Produtos
                  </Th>
                  <Th
                    numerica
                    ordenavel
                    direcao={dir('preco_medio_loja')}
                    onClick={() => alternar('preco_medio_loja')}
                  >
                    Preço médio
                  </Th>
                  <Th numerica>Mercado</Th>
                  <Th
                    numerica
                    ordenavel
                    direcao={dir('indice_competitividade')}
                    onClick={() => alternar('indice_competitividade')}
                  >
                    Índice
                  </Th>
                  <Th>Posição</Th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((l) => {
                  const indice = num(l.indice_competitividade)
                  const desvio = indice === null ? null : (indice - 1) * 100
                  return (
                    <Tr key={l.cnpj_estabelecimento}>
                      <Td forte>{l.nome_estabelecimento ?? 'Sem nome'}</Td>
                      <Td>{[l.bairro, l.cidade].filter(Boolean).join(' · ') || '—'}</Td>
                      <Td numerica>{fmtInteiro(l.produtos_comparados)}</Td>
                      <Td numerica>{fmtMoeda(l.preco_medio_loja)}</Td>
                      <Td numerica>{fmtMoeda(l.preco_medio_mercado)}</Td>
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
                        {indice === null ? '—' : indice.toFixed(3).replace('.', ',')}
                      </Td>
                      <Td>
                        {desvio === null ? (
                          '—'
                        ) : desvio <= -5 ? (
                          <Etiqueta tom="ok">{fmtDelta(desvio)}</Etiqueta>
                        ) : desvio >= 5 ? (
                          <Etiqueta tom="critico">{fmtDelta(desvio)}</Etiqueta>
                        ) : (
                          <Etiqueta tom="neutro">{fmtDelta(desvio)}</Etiqueta>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Tabela>
          )}
        </Secao>
      </div>
    </div>
  )
}

function valorDe(l: LinhaRanking, c: Coluna): string | number | null {
  switch (c) {
    case 'nome_estabelecimento':
      return l.nome_estabelecimento
    case 'cidade':
      return l.cidade
    case 'produtos_comparados':
      return l.produtos_comparados
    case 'preco_medio_loja':
      return num(l.preco_medio_loja)
    case 'indice_competitividade':
      return num(l.indice_competitividade)
  }
}
