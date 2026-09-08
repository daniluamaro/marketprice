import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import type { EChartsOption } from 'echarts'
import echarts, { TEMA } from '@/lib/echarts'
import { EstadoErro, EstadoVazio, Skeleton } from '@/components/ui/estados'

/**
 * Todo grafico do produto passa por aqui — §10.5.
 *
 * Centraliza as quatro situacoes que uma tela de dados sempre tem, e que sao
 * o que separa produto de protótipo: carregando (skeleton, nao spinner),
 * vazio (mensagem que orienta), erro (com acao de repetir) e sucesso.
 * Tambem respeita `prefers-reduced-motion`.
 */
export function Grafico({
  option,
  altura = 320,
  carregando = false,
  erro = null,
  vazio = false,
  mensagemVazio,
  onTentarNovamente,
}: {
  option: EChartsOption
  altura?: number
  carregando?: boolean
  erro?: string | null
  vazio?: boolean
  mensagemVazio?: string
  onTentarNovamente?: () => void
}) {
  const semMovimento = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const opcao = useMemo<EChartsOption>(
    () => ({ ...option, animation: !semMovimento }),
    [option, semMovimento],
  )

  if (carregando) {
    return (
      <div className="flex flex-col justify-end gap-2" style={{ height: altura }}>
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  if (erro !== null) {
    return (
      <div style={{ minHeight: altura }}>
        <EstadoErro descricao={erro} onTentarNovamente={onTentarNovamente} />
      </div>
    )
  }

  if (vazio) {
    return (
      <div style={{ minHeight: altura }}>
        <EstadoVazio
          {...(mensagemVazio === undefined ? {} : { descricao: mensagemVazio })}
        />
      </div>
    )
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={TEMA}
      option={opcao}
      style={{ height: altura, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
    />
  )
}
