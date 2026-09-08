import { RotateCcw } from 'lucide-react'
import { useCatalogo } from '@/lib/catalogo'
import { contarAtivos, useFiltros } from '@/store/filtros'
import { FiltroChip, FiltroEan, FiltroPeriodo, type Opcao } from './FiltroChip'
import { Skeleton } from '@/components/ui/estados'

/**
 * Barra de filtros globais (§9). As opcoes vem de uma unica RPC e respeitam a
 * RLS: cada cliente so ve as cidades, produtos e lojas do proprio CNPJ.
 */
export function BarraFiltros() {
  const filtros = useFiltros()
  const definir = useFiltros((s) => s.definir)
  const definirPeriodo = useFiltros((s) => s.definirPeriodo)
  const limpar = useFiltros((s) => s.limpar)

  const opcoes = useCatalogo()

  if (opcoes.isPending) {
    return (
      <div className="flex flex-wrap gap-2.5">
        {[150, 130, 190, 175, 170, 200].map((l) => (
          <Skeleton key={l} className="h-9" style={{ width: l }} />
        ))}
      </div>
    )
  }

  // Sem opcoes nao ha o que filtrar; esconder e melhor que mostrar 5 chips mortos.
  if (opcoes.isError || !opcoes.data) return null

  const { cidades, ncm_grupos, produtos, estabelecimentos, data_min, data_max } =
    opcoes.data

  const opcoesCidade: Opcao[] = cidades.map((c) => ({ valor: c, rotulo: c }))
  const opcoesCategoria: Opcao[] = ncm_grupos.map((g) => ({ valor: g, rotulo: g }))
  const opcoesProduto: Opcao[] = produtos.map((p) => ({
    valor: p.ean,
    rotulo: p.nome ?? p.ean,
    detalhe: `EAN ${p.ean}`,
  }))
  const opcoesEstab: Opcao[] = estabelecimentos.map((e) => ({
    valor: e.cnpj,
    rotulo: e.nome ?? e.cnpj,
    detalhe: [e.bairro, e.cidade].filter(Boolean).join(' · '),
  }))

  // O campo de EAN livre valida contra os codigos que o tenant realmente tem.
  const eansConhecidos = new Set(produtos.map((p) => p.ean))

  const ativos = contarAtivos(filtros)

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <FiltroPeriodo
        dataIni={filtros.dataIni}
        dataFim={filtros.dataFim}
        min={data_min ?? undefined}
        max={data_max ?? undefined}
        onMudar={definirPeriodo}
      />

      {/*
        limiteBusca={0} forca o campo de busca a aparecer sempre. Cidade e
        Categoria tem poucas opcoes hoje, mas a base cresce a cada coleta — e o
        habito de digitar para achar deve ser o mesmo em todos os filtros.
      */}
      <FiltroChip
        rotulo="Cidade"
        valor={filtros.cidade}
        opcoes={opcoesCidade}
        onEscolher={(v) => definir('cidade', v)}
        placeholder="Todas"
        limiteBusca={0}
      />

      <FiltroChip
        rotulo="Produto"
        valor={filtros.ean}
        opcoes={opcoesProduto}
        onEscolher={(v) => definir('ean', v)}
      />

      <FiltroEan
        valor={filtros.ean}
        eansConhecidos={eansConhecidos}
        onEscolher={(v) => definir('ean', v)}
      />

      <FiltroChip
        rotulo="Categoria"
        valor={filtros.ncmGrupo}
        opcoes={opcoesCategoria}
        onEscolher={(v) => definir('ncmGrupo', v)}
        placeholder="Todas"
        limiteBusca={0}
      />

      <FiltroChip
        rotulo="Estabelecimento"
        valor={filtros.estabelecimento}
        opcoes={opcoesEstab}
        onEscolher={(v) => definir('estabelecimento', v)}
      />

      {ativos > 0 && (
        <button
          type="button"
          onClick={limpar}
          className="flex h-9 items-center gap-1.5 rounded-chip px-3 text-[12.5px] text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Limpar {ativos === 1 ? 'filtro' : `${ativos} filtros`}
        </button>
      )}
    </div>
  )
}
