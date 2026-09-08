import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { buscarGeografico, buscarIndiceGeografico } from '@/lib/rpc'
import { chaveCache, useFiltros } from '@/store/filtros'
import { fmtDelta, fmtInteiro, fmtMoeda, num } from '@/lib/format'
import { encurtar, useTelaEstreita } from '@/lib/tela'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { CardKpi } from '@/components/ui/kpi'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Grafico } from '@/components/ui/Grafico'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { Etiqueta } from '@/components/ui/etiqueta'
import { EstadoErro, EstadoVazio, Skeleton } from '@/components/ui/estados'
import { T } from '@/lib/tokens'

/**
 * Analise Geografica (§9.7).
 *
 * Duas leituras diferentes, de proposito separadas:
 *
 * 1. PATAMAR (rpc_preco_geografico) — preco medio praticado na regiao. Mede o
 *    sortimento tanto quanto o preco: um bairro cheio de loja de conveniencia
 *    parece caro porque vende itens caros.
 * 2. COMPETITIVIDADE (rpc_indice_geografico) — media das razoes produto a
 *    produto contra o mercado. Esta sim isola a politica de preco da regiao.
 *
 * Mostrar so a primeira levaria o cliente a concluir "o bairro X e caro" quando
 * o que ele viu foi o mix de produtos daquele bairro.
 */
export default function Geografico() {
  const estreita = useTelaEstreita()
  const filtros = useFiltros()
  const chave = chaveCache(filtros)

  const indice = useQuery({
    queryKey: ['geo-indice', chave],
    queryFn: () => buscarIndiceGeografico(filtros, 1),
  })
  const patamar = useQuery({
    queryKey: ['geo-patamar', chave],
    queryFn: () => buscarGeografico(filtros),
  })

  const linhasIndice = indice.data ?? []
  const linhasPatamar = patamar.data ?? []

  const maisBarato = linhasIndice[0] ?? null
  const maisCaro =
    linhasIndice.length > 1 ? (linhasIndice[linhasIndice.length - 1] ?? null) : null

  const cidades = useMemo(() => {
    const mapa = new Map<
      string,
      { bairros: number; soma: number; peso: number; produtos: number }
    >()
    for (const l of linhasPatamar) {
      const atual = mapa.get(l.cidade) ?? { bairros: 0, soma: 0, peso: 0, produtos: 0 }
      atual.bairros += 1
      atual.produtos += l.produtos
      const p = num(l.preco_medio)
      if (p !== null) {
        // Media ponderada pelo numero de produtos: um bairro com 2 itens nao
        // pode pesar igual a um com 200.
        atual.soma += p * l.produtos
        atual.peso += l.produtos
      }
      mapa.set(l.cidade, atual)
    }
    return [...mapa.entries()]
      .map(([cidade, v]) => ({
        cidade,
        bairros: v.bairros,
        produtos: v.produtos,
        precoMedio: v.peso === 0 ? null : v.soma / v.peso,
      }))
      .sort((a, b) => (b.precoMedio ?? 0) - (a.precoMedio ?? 0))
  }, [linhasPatamar])

  // ------------------------------------------------------------------ grafico
  // Com 49 bairros o grafico passaria de 1600px de altura e ninguem leria o
  // meio dele. Aqui ficam os extremos — que e a leitura acionavel — e a tabela
  // abaixo continua com a lista inteira.
  const extremos = useMemo(() => {
    if (linhasIndice.length <= 20) return linhasIndice
    return [...linhasIndice.slice(0, 10), ...linhasIndice.slice(-10)]
  }, [linhasIndice])

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
            `<strong>${l.bairro}</strong> · ${l.cidade}`,
            `Índice: <span style="font-family:${T.fontMono}">${(
              num(l.indice_competitividade) ?? 0
            ).toFixed(3)}</span>`,
            `Preço médio: ${fmtMoeda(l.preco_medio)}`,
            `${fmtInteiro(l.estabelecimentos)} lojas · ${fmtInteiro(l.produtos)} produtos`,
          ].join('<br/>')
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
        data: dados.map((l) => encurtar(l.bairro, estreita ? 14 : 28)),
        axisLabel: {
          width: estreita ? 88 : 190,
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
              itemStyle: { color: desvio > 0 ? T.danger : T.success, borderRadius: 3 },
              label: {
                // Sem `color` por item o ECharts usa o rotulo padrao dele
                // (preto com contorno branco), que destoa do tema.
                color: desvio <= 0 ? T.successTxt : T.dangerTxt,
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
        titulo="Análise Geográfica"
        contexto={[
          cidades.length > 0 ? `${fmtInteiro(cidades.length)} cidades` : null,
          linhasPatamar.length > 0 ? `${fmtInteiro(linhasPatamar.length)} bairros` : null,
        ]}
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <CardKpi
            rotulo="Região mais competitiva"
            valor={fmtDelta(((num(maisBarato?.indice_competitividade) ?? 1) - 1) * 100)}
            delta={
              maisBarato === null
                ? undefined
                : `${encurtar(maisBarato.bairro, 22)} · ${maisBarato.cidade}`
            }
            tom="positivo"
            carregando={indice.isPending}
            destaque
          />
          <CardKpi
            rotulo="Região mais cara"
            valor={fmtDelta(((num(maisCaro?.indice_competitividade) ?? 1) - 1) * 100)}
            delta={
              maisCaro === null
                ? undefined
                : `${encurtar(maisCaro.bairro, 22)} · ${maisCaro.cidade}`
            }
            tom="negativo"
            carregando={indice.isPending}
          />
          <CardKpi
            rotulo="Bairros comparáveis"
            valor={fmtInteiro(linhasIndice.length)}
            delta="com produtos em comum com o mercado"
            carregando={indice.isPending}
          />
        </div>

        <Secao
          eyebrow="Competitividade"
          titulo="Bairros acima e abaixo do mercado"
          descricao={
            extremos.length < linhasIndice.length
              ? 'Para cada bairro comparamos o preço praticado com a média de mercado do mesmo produto e tiramos a média dessas razões. Isso neutraliza o sortimento. O gráfico mostra os 10 bairros mais baratos e os 10 mais caros; a lista completa está na tabela abaixo.'
              : 'Para cada bairro comparamos o preço praticado com a média de mercado do mesmo produto e tiramos a média dessas razões. Isso neutraliza o sortimento: um bairro só aparece caro se realmente cobrar mais pelos mesmos itens.'
          }
          acessorio={
            linhasIndice.length > 0 ? (
              <TagSecao>
                {extremos.length < linhasIndice.length ? (
                  <>
                    extremos de <span className="num">{linhasIndice.length}</span> bairros
                  </>
                ) : (
                  <>
                    <span className="num">{linhasIndice.length}</span> bairros
                  </>
                )}
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opcao}
            altura={Math.max(240, extremos.length * 34)}
            carregando={indice.isPending}
            erro={indice.isError ? indice.error.message : null}
            vazio={indice.isSuccess && linhasIndice.length === 0}
            mensagemVazio="Nenhum bairro tem produtos em comum com o resto do mercado neste recorte."
            onTentarNovamente={() => void indice.refetch()}
          />
        </Secao>

        <Secao
          eyebrow="Cidades"
          titulo="Patamar de preço por cidade"
          descricao="Preço médio ponderado pelo número de produtos de cada bairro. Leia como patamar da praça, não como competitividade — para isso use o índice acima."
        >
          {patamar.isPending && (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}
          {patamar.isError && (
            <EstadoErro
              descricao={patamar.error.message}
              onTentarNovamente={() => void patamar.refetch()}
            />
          )}
          {patamar.isSuccess && cidades.length === 0 && <EstadoVazio />}
          {patamar.isSuccess && cidades.length > 0 && (
            <Tabela>
              <thead>
                <tr>
                  <Th>Cidade</Th>
                  <Th numerica>Bairros</Th>
                  <Th numerica>Produtos</Th>
                  <Th numerica>Preço médio</Th>
                </tr>
              </thead>
              <tbody>
                {cidades.map((c) => (
                  <Tr key={c.cidade}>
                    <Td forte>{c.cidade}</Td>
                    <Td numerica>{fmtInteiro(c.bairros)}</Td>
                    <Td numerica>{fmtInteiro(c.produtos)}</Td>
                    <Td numerica forte>
                      {fmtMoeda(c.precoMedio)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Secao>

        <Secao
          eyebrow="Detalhe"
          titulo="Bairros em números"
          descricao="Faixa de preço praticada e índice de competitividade de cada bairro. O índice vem de uma comparação produto a produto; a faixa, dos preços vigentes da região."
        >
          {patamar.isPending && (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}
          {patamar.isError && (
            <EstadoErro
              descricao={patamar.error.message}
              onTentarNovamente={() => void patamar.refetch()}
            />
          )}
          {patamar.isSuccess && linhasPatamar.length === 0 && <EstadoVazio />}
          {patamar.isSuccess && linhasPatamar.length > 0 && (
            <Tabela>
              <thead>
                <tr>
                  <Th>Bairro</Th>
                  <Th>Cidade</Th>
                  <Th numerica>Lojas</Th>
                  <Th numerica>Produtos</Th>
                  <Th numerica>Mínimo</Th>
                  <Th numerica>Médio</Th>
                  <Th numerica>Máximo</Th>
                  <Th>Competitividade</Th>
                </tr>
              </thead>
              <tbody>
                {linhasPatamar.map((l) => {
                  const comp = linhasIndice.find(
                    (i) => i.bairro === l.bairro && i.cidade === l.cidade,
                  )
                  const ind = num(comp?.indice_competitividade)
                  const desvio = ind === null ? null : (ind - 1) * 100
                  return (
                    <Tr key={`${l.cidade}:${l.bairro}`}>
                      <Td forte>{l.bairro}</Td>
                      <Td>{l.cidade}</Td>
                      <Td numerica>{fmtInteiro(l.estabelecimentos)}</Td>
                      <Td numerica>{fmtInteiro(l.produtos)}</Td>
                      <Td numerica className="text-success-txt">
                        {fmtMoeda(l.preco_min)}
                      </Td>
                      <Td numerica>{fmtMoeda(l.preco_medio)}</Td>
                      <Td numerica className="text-danger-txt">
                        {fmtMoeda(l.preco_max)}
                      </Td>
                      <Td>
                        {desvio === null ? (
                          <span className="text-ink-3">sem comparação</span>
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
