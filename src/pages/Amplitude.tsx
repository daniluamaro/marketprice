import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { ArrowRight, Search } from 'lucide-react'
import { buscarDispersao } from '@/lib/rpc'
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

const NO_GRAFICO = 15

/**
 * Amplitude & Oportunidades (§9.5).
 *
 * Amplitude = (maior preco − menor preco) ÷ menor preco, POR EAN. E a metrica
 * mais acionavel do produto: um item com 80% de amplitude significa que a mesma
 * mercadoria, com o mesmo codigo de barras, esta sendo vendida por quase o dobro
 * em alguma loja — e isso e margem de negociacao ou risco de perder venda,
 * dependendo do lado do balcao em que o cliente esta.
 *
 * Sem amplitude nao ha oportunidade: um produto que custa igual em todo lugar
 * nao da o que negociar, por isso a ordenacao padrao e da maior para a menor.
 */
export default function Amplitude() {
  const estreita = useTelaEstreita()
  const navigate = useNavigate()
  const filtros = useFiltros()
  const definir = useFiltros((s) => s.definir)
  const chave = chaveCache(filtros)
  const [busca, setBusca] = useState('')

  /**
   * Seleciona o produto no filtro global E leva para o comparativo. Marcar o
   * EAN sem sair daqui reduziria esta tela a uma linha so — o oposto do que a
   * pessoa quis ao clicar em "comparar".
   */
  function compararProduto(ean: string | number) {
    definir('ean', String(ean))
    navigate('/comparativo')
  }

  const consulta = useQuery({
    queryKey: ['amplitude', chave],
    queryFn: () => buscarDispersao(filtros, 200),
  })

  const todas = consulta.data ?? []

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (termo === '') return todas
    return todas.filter((l) =>
      `${l.nome_exibicao ?? ''} ${l.cod_barras} ${l.ncm_grupo ?? ''}`
        .toLowerCase()
        .includes(termo),
    )
  }, [todas, busca])

  const maior = todas[0] ?? null
  const amplitudeMediana = useMemo(() => {
    const vals = todas
      .map((l) => num(l.amplitude_pct))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
    if (vals.length === 0) return null
    const meio = Math.floor(vals.length / 2)
    return vals.length % 2 === 0
      ? ((vals[meio - 1] ?? 0) + (vals[meio] ?? 0)) / 2
      : (vals[meio] ?? null)
  }, [todas])

  const acimaDe50 = todas.filter((l) => (num(l.amplitude_pct) ?? 0) >= 50).length

  // ------------------------------------------------------------------ grafico
  const opcao = useMemo<EChartsOption>(() => {
    const dados = [...linhas].slice(0, NO_GRAFICO).reverse()

    return {
      grid: { left: 8, right: 30, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = params as { dataIndex: number }[]
          const p = arr[0]
          if (p === undefined) return ''
          const l = dados[p.dataIndex]
          if (l === undefined) return ''
          return [
            `<strong>${l.nome_exibicao ?? 'Sem nome'}</strong>`,
            `EAN ${l.cod_barras}`,
            `Mínimo: ${fmtMoeda(l.preco_min)}`,
            `Médio: ${fmtMoeda(l.preco_medio)}`,
            `Máximo: ${fmtMoeda(l.preco_max)}`,
            `Amplitude: <strong>${fmtPercent(l.amplitude_pct)}</strong> em ${fmtInteiro(
              l.estabelecimentos,
            )} lojas`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        scale: true,
        axisLabel: { formatter: (v: number | string) => fmtMoeda(Number(v)) },
      },
      yAxis: {
        type: 'category',
        data: dados.map((l) => encurtar(l.nome_exibicao, estreita ? 16 : 34)),
        axisLabel: {
          width: estreita ? 92 : 230,
          overflow: 'truncate',
          fontSize: estreita ? 10 : 11,
        },
      },
      series: [
        // Barra flutuante: a primeira barra e invisivel e serve so de
        // deslocamento ate o preco minimo; a segunda desenha a faixa
        // min→max. E como se faz um "range bar" no ECharts sem serie custom.
        {
          type: 'bar',
          stack: 'faixa',
          silent: true,
          itemStyle: { color: 'transparent' },
          data: dados.map((l) => num(l.preco_min) ?? 0),
        },
        {
          type: 'bar',
          stack: 'faixa',
          barMaxWidth: 16,
          data: dados.map((l) => {
            const min = num(l.preco_min) ?? 0
            const max = num(l.preco_max) ?? 0
            const amp = num(l.amplitude_pct) ?? 0
            return {
              value: Math.max(max - min, 0),
              itemStyle: {
                borderRadius: 3,
                // A cor codifica severidade, nao identidade: quanto maior a
                // amplitude, mais o item pede atencao.
                color:
                  amp >= 80
                    ? T.danger
                    : amp >= 40
                      ? T.warning
                      : T.gold,
                opacity: 0.85,
              },
            }
          }),
          label: {
            show: !estreita,
            position: 'right',
            formatter: (p: { dataIndex: number }) =>
              fmtPercent(dados[p.dataIndex]?.amplitude_pct),
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
          },
        },
        // Losango no preco medio: mostra se a faixa esta puxada para baixo
        // (muitas lojas baratas e uma cara) ou para cima.
        {
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 9,
          itemStyle: { color: T.ink, borderColor: T.panel, borderWidth: 1.5 },
          data: dados.map((l, i) => [num(l.preco_medio) ?? 0, i]),
          tooltip: { show: false },
        },
      ],
    }
  }, [linhas, estreita])

  return (
    <div>
      <CabecalhoPagina
        titulo="Amplitude & Oportunidades"
        contexto={[
          todas.length > 0 ? `${fmtInteiro(todas.length)} produtos comparáveis` : null,
          'ordenados da maior para a menor dispersão',
        ]}
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <CardKpi
            rotulo="Maior amplitude"
            valor={fmtPercent(maior?.amplitude_pct)}
            delta={encurtar(maior?.nome_exibicao ?? null, 30)}
            tom="negativo"
            carregando={consulta.isPending}
            destaque
          />
          <CardKpi
            rotulo="Amplitude mediana"
            valor={fmtPercent(amplitudeMediana)}
            delta="metade dos produtos varia menos que isso"
            carregando={consulta.isPending}
          />
          <CardKpi
            rotulo="Produtos acima de 50%"
            valor={fmtInteiro(acimaDe50)}
            delta="onde há mais espaço para negociar"
            tom={acimaDe50 > 0 ? 'negativo' : 'neutro'}
            carregando={consulta.isPending}
          />
        </div>

        <Secao
          eyebrow="Dispersão"
          titulo="Faixa de preço por produto"
          descricao="Cada barra vai do menor ao maior preço vigente do item; o losango marca a média. Quanto mais longa a barra, mais o mesmo produto custa coisas diferentes dependendo da loja."
          acessorio={
            linhas.length > 0 ? (
              <TagSecao>
                top <span className="num">{Math.min(NO_GRAFICO, linhas.length)}</span>
              </TagSecao>
            ) : undefined
          }
        >
          <Grafico
            option={opcao}
            altura={Math.max(280, Math.min(NO_GRAFICO, linhas.length) * 34)}
            carregando={consulta.isPending}
            erro={consulta.isError ? consulta.error.message : null}
            vazio={consulta.isSuccess && linhas.length === 0}
            mensagemVazio="Nenhum produto aparece em duas ou mais lojas neste recorte. Sem dois preços não há amplitude para medir."
            onTentarNovamente={() => void consulta.refetch()}
          />
        </Secao>

        <Secao
          eyebrow="Oportunidades"
          titulo="Todos os produtos por amplitude"
          descricao="Clique em um produto para abrir o comparativo entre lojas dele. A barra na coluna de amplitude é relativa ao produto de maior dispersão da lista."
          acessorio={
            <div className="flex items-center gap-2 rounded-chip border border-line bg-elevated px-3 py-1.5 focus-within:border-gold/45">
              <Search className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto ou EAN..."
                aria-label="Buscar produto na tabela"
                className="w-47.5 bg-transparent text-[12px] text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>
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
            <EstadoVazio
              descricao={
                busca.trim() === ''
                  ? 'Nenhum produto aparece em duas ou mais lojas neste recorte.'
                  : `Nenhum produto encontrado para “${busca}”.`
              }
            />
          )}

          {consulta.isSuccess && linhas.length > 0 && (
            <Tabela>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th>Categoria</Th>
                  <Th numerica>Lojas</Th>
                  <Th numerica>Mínimo</Th>
                  <Th numerica>Médio</Th>
                  <Th numerica>Máximo</Th>
                  <Th numerica>Amplitude R$</Th>
                  <Th numerica>Amplitude %</Th>
                  <Th className="w-27.5">Dispersão</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const amp = num(l.amplitude_pct) ?? 0
                  const referencia = num(maior?.amplitude_pct) ?? 1
                  const minimo = num(l.preco_min)
                  const maximo = num(l.preco_max)
                  // O percentual diz a proporcao; o absoluto diz o dinheiro em
                  // jogo por unidade — 50% num item de R$ 2 e outra conversa.
                  const amplitudeRs =
                    minimo === null || maximo === null ? null : maximo - minimo
                  return (
                    <Tr key={l.cod_barras}>
                      <Td forte>
                        <span className="block max-w-70 truncate">
                          {l.nome_exibicao ?? 'Sem nome'}
                        </span>
                        <span className="num mt-0.5 block text-[10.5px] text-ink-3">
                          {l.cod_barras}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-45 truncate">
                          {l.ncm_grupo ?? '—'}
                        </span>
                      </Td>
                      <Td numerica>{fmtInteiro(l.estabelecimentos)}</Td>
                      <Td numerica className="text-success-txt">
                        {fmtMoeda(l.preco_min)}
                      </Td>
                      <Td numerica>{fmtMoeda(l.preco_medio)}</Td>
                      <Td numerica className="text-danger-txt">
                        {fmtMoeda(l.preco_max)}
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
                      <Td>
                        <BarraInline
                          proporcao={referencia === 0 ? 0 : amp / referencia}
                          tom={amp >= 80 ? 'critico' : amp >= 40 ? 'alerta' : 'marca'}
                          titulo={`Amplitude de ${fmtPercent(amp)}`}
                        />
                      </Td>
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => compararProduto(l.cod_barras)}
                          aria-label={`Comparar ${l.nome_exibicao ?? 'produto'} entre lojas`}
                        >
                          Comparar
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
