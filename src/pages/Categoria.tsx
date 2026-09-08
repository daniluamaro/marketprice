import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { ArrowRight } from 'lucide-react'
import { buscarCategorias } from '@/lib/rpc'
import { chaveCache, useFiltros } from '@/store/filtros'
import { fmtInteiro, fmtMoeda, fmtPercent, num } from '@/lib/format'
import { encurtar, useTelaEstreita } from '@/lib/tela'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { CardKpi } from '@/components/ui/kpi'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Grafico } from '@/components/ui/Grafico'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { Etiqueta } from '@/components/ui/etiqueta'
import { BarraInline } from '@/components/ui/barra'
import { EstadoErro, EstadoVazio, Skeleton } from '@/components/ui/estados'
import { Button } from '@/components/ui/button'
import { T } from '@/lib/tokens'

/**
 * Analise por Categoria (§9.6) — agregados por `ncm_grupo`.
 *
 * Ponto importante herdado da migration de correcao: a amplitude da categoria e
 * a MEDIANA das amplitudes dos produtos dela, nunca (max − min) da categoria
 * inteira. Comparar o item mais caro da categoria com o mais barato mede a
 * diferenca entre dois produtos DIFERENTES — dava numeros como 1894%, que nao
 * significam nada. A mediana responde a pergunta certa: "quanto varia, em
 * media, o mesmo item dentro desta categoria".
 */
export default function Categoria() {
  const estreita = useTelaEstreita()
  const navigate = useNavigate()
  const filtros = useFiltros()
  const definir = useFiltros((s) => s.definir)
  const chave = chaveCache(filtros)

  const consulta = useQuery({
    queryKey: ['categoria-tela', chave],
    queryFn: () => buscarCategorias(filtros),
  })

  const linhas = consulta.data ?? []

  const totalProdutos = linhas.reduce((s, l) => s + l.produtos, 0)
  const maisVolatil = useMemo(
    () =>
      [...linhas].sort(
        (a, b) => (num(b.amplitude_mediana_pct) ?? 0) - (num(a.amplitude_mediana_pct) ?? 0),
      )[0] ?? null,
    [linhas],
  )
  const maisCara = useMemo(
    () =>
      [...linhas].sort((a, b) => (num(b.preco_medio) ?? 0) - (num(a.preco_medio) ?? 0))[0] ??
      null,
    [linhas],
  )

  /** Abre a tela de amplitude ja recortada nesta categoria. */
  function explorar(grupo: string) {
    definir('ncmGrupo', grupo)
    navigate('/amplitude')
  }

  const opcao = useMemo<EChartsOption>(() => {
    const dados = [...linhas]
      .sort((a, b) => (num(a.preco_medio) ?? 0) - (num(b.preco_medio) ?? 0))
      .slice(-14)

    return {
      grid: { left: 8, right: 30, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0]
          if (p === undefined) return ''
          const l = dados[p.dataIndex]
          if (l === undefined) return ''
          return [
            `<strong>${l.ncm_grupo}</strong>`,
            `Preço médio: ${fmtMoeda(l.preco_medio)}`,
            `Faixa: ${fmtMoeda(l.preco_min)} – ${fmtMoeda(l.preco_max)}`,
            `${fmtInteiro(l.produtos)} produtos · ${fmtInteiro(l.estabelecimentos)} lojas`,
            `Amplitude mediana: ${fmtPercent(l.amplitude_mediana_pct)}`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number | string) => fmtMoeda(Number(v)) },
      },
      yAxis: {
        type: 'category',
        data: dados.map((l) => encurtar(l.ncm_grupo, estreita ? 16 : 34)),
        axisLabel: {
          width: estreita ? 92 : 240,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 18,
          data: dados.map((l) => num(l.preco_medio) ?? 0),
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
            show: !estreita,
            position: 'right',
            formatter: (p: { value: unknown }) => fmtMoeda(Number(p.value)),
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
          },
        },
      ],
    }
  }, [linhas, estreita])

  return (
    <div>
      <CabecalhoPagina
        titulo="Análise por Categoria"
        contexto={[
          linhas.length > 0 ? `${fmtInteiro(linhas.length)} categorias (NCM)` : null,
          totalProdutos > 0 ? `${fmtInteiro(totalProdutos)} produtos` : null,
        ]}
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <CardKpi
            rotulo="Categoria mais cara"
            valor={fmtMoeda(maisCara?.preco_medio)}
            delta={encurtar(maisCara?.ncm_grupo ?? null, 30)}
            carregando={consulta.isPending}
            destaque
          />
          <CardKpi
            rotulo="Maior variação interna"
            valor={fmtPercent(maisVolatil?.amplitude_mediana_pct)}
            delta={encurtar(maisVolatil?.ncm_grupo ?? null, 30)}
            tom="negativo"
            carregando={consulta.isPending}
          />
          <CardKpi
            rotulo="Categorias monitoradas"
            valor={fmtInteiro(linhas.length)}
            delta={`${fmtInteiro(totalProdutos)} produtos no total`}
            carregando={consulta.isPending}
          />
        </div>

        <Secao
          eyebrow="Patamar de preço"
          titulo="Preço médio por categoria"
          descricao="Média dos preços vigentes dos produtos de cada grupo NCM. Serve para entender o patamar da categoria — a comparação entre lojas é feita item a item, nas outras telas."
          acessorio={
            linhas.length > 14 ? (
              <TagSecao>
                top <span className="num">14</span> de {linhas.length}
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opcao}
            altura={Math.max(260, Math.min(14, linhas.length) * 34)}
            carregando={consulta.isPending}
            erro={consulta.isError ? consulta.error.message : null}
            vazio={consulta.isSuccess && linhas.length === 0}
            mensagemVazio="Nenhuma categoria com preço no recorte atual."
            onTentarNovamente={() => void consulta.refetch()}
          />
        </Secao>

        <Secao
          eyebrow="Detalhe"
          titulo="Categorias em números"
          descricao="A amplitude mediana é a variação típica de um MESMO produto dentro da categoria — não a diferença entre o item mais caro e o mais barato dela, que compararia coisas distintas."
        >
          {consulta.isPending && (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
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

          {consulta.isSuccess && linhas.length === 0 && <EstadoVazio />}

          {consulta.isSuccess && linhas.length > 0 && (
            <Tabela>
              <thead>
                <tr>
                  <Th>Categoria (NCM)</Th>
                  <Th numerica>Produtos</Th>
                  <Th numerica>Lojas</Th>
                  <Th numerica>Mínimo</Th>
                  <Th numerica>Médio</Th>
                  <Th numerica>Máximo</Th>
                  <Th numerica>Amplitude mediana</Th>
                  <Th className="w-27.5">Variação</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const amp = num(l.amplitude_mediana_pct) ?? 0
                  const referencia = num(maisVolatil?.amplitude_mediana_pct) ?? 1
                  return (
                    <Tr key={l.ncm_grupo}>
                      <Td forte>
                        <span className="block max-w-75 truncate">{l.ncm_grupo}</span>
                      </Td>
                      <Td numerica>{fmtInteiro(l.produtos)}</Td>
                      <Td numerica>{fmtInteiro(l.estabelecimentos)}</Td>
                      <Td numerica className="text-success-txt">
                        {fmtMoeda(l.preco_min)}
                      </Td>
                      <Td numerica forte>
                        {fmtMoeda(l.preco_medio)}
                      </Td>
                      <Td numerica className="text-danger-txt">
                        {fmtMoeda(l.preco_max)}
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
                      <Td>
                        <BarraInline
                          proporcao={referencia === 0 ? 0 : amp / referencia}
                          tom={amp >= 80 ? 'critico' : amp >= 40 ? 'alerta' : 'marca'}
                          titulo={`Amplitude mediana de ${fmtPercent(amp)}`}
                        />
                      </Td>
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => explorar(l.ncm_grupo)}
                          aria-label={`Ver oportunidades em ${l.ncm_grupo}`}
                        >
                          Explorar
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Button>
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
