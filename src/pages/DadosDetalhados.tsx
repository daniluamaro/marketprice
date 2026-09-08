import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  buscarDetalhes,
  buscarTodosParaExport,
  MAX_EXPORT,
  type ColunaOrdenavel,
  type LinhaDetalhe,
} from '@/lib/detalhados'
import { baixarCsv, gerarCsv, nomeArquivoCsv, type ColunaCsv } from '@/lib/csv'
import { chaveCache, contarAtivos, useFiltros } from '@/store/filtros'
import { fmtData, fmtDataHora, fmtInteiro, fmtMoeda, num } from '@/lib/format'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { Secao, TagSecao } from '@/components/ui/secao'
import { Tabela, Td, Th, Tr } from '@/components/ui/tabela'
import { EstadoErro, EstadoVazio, Skeleton } from '@/components/ui/estados'
import { Button } from '@/components/ui/button'

const TAMANHOS = [25, 50, 100, 250] as const

/**
 * Dados Detalhados (§9.8) — a tabela crua, com paginacao NO SERVIDOR.
 *
 * Baixar tudo e paginar no browser seria mais simples de escrever e erraria o
 * ponto: a base cresce continuamente pelo n8n, entao a quantidade de linhas nao
 * e conhecida e nao cabe na memoria da aba. `.range()` + `count: 'exact'` do
 * PostgREST resolvem isso, e a RLS continua valendo porque `v_precos_base` e
 * `security_invoker`.
 *
 * O CSV e a excecao controlada: ele PRECISA do recorte inteiro, entao busca em
 * lotes de mil linhas ate um teto (MAX_EXPORT) e mostra o progresso.
 */
export default function DadosDetalhados() {
  const filtros = useFiltros()
  const chave = chaveCache(filtros)

  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState<number>(50)
  const [ordem, setOrdem] = useState<{ coluna: ColunaOrdenavel; asc: boolean }>({
    coluna: 'data_nf',
    asc: false,
  })
  const [exportando, setExportando] = useState(false)
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null)
  const [erroExport, setErroExport] = useState<string | null>(null)

  // Trocar filtro, ordem ou tamanho de pagina invalida a pagina atual: manter a
  // pagina 7 de um resultado que agora tem 2 paginas mostraria um vazio falso.
  useEffect(() => {
    setPagina(0)
  }, [chave, porPagina, ordem.coluna, ordem.asc])

  const consulta = useQuery({
    queryKey: ['detalhes', chave, pagina, porPagina, ordem.coluna, ordem.asc],
    queryFn: () => buscarDetalhes(filtros, pagina, porPagina, ordem),
    // Sem isto a tabela pisca para skeleton a cada troca de pagina, e a pessoa
    // perde a referencia visual de onde estava.
    placeholderData: keepPreviousData,
  })

  const linhas = consulta.data?.linhas ?? []
  const total = consulta.data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const primeiraDaPagina = total === 0 ? 0 : pagina * porPagina + 1
  const ultimaDaPagina = Math.min(total, (pagina + 1) * porPagina)

  function alternar(coluna: ColunaOrdenavel) {
    setOrdem((o) =>
      o.coluna === coluna ? { coluna, asc: !o.asc } : { coluna, asc: false },
    )
  }

  const dir = (c: ColunaOrdenavel) =>
    ordem.coluna === c ? (ordem.asc ? ('asc' as const) : ('desc' as const)) : null

  async function exportar() {
    setExportando(true)
    setErroExport(null)
    setProgresso({ feito: 0, total: Math.min(total, MAX_EXPORT) })
    try {
      const todas = await buscarTodosParaExport(filtros, ordem, (feito, t) =>
        setProgresso({ feito, total: t }),
      )
      baixarCsv(nomeArquivoCsv('market-price'), gerarCsv(COLUNAS_CSV, todas))
    } catch (e) {
      setErroExport(
        e instanceof Error ? e.message : 'Falha ao gerar o arquivo. Tente novamente.',
      )
    } finally {
      setExportando(false)
      setProgresso(null)
    }
  }

  const ativos = contarAtivos(filtros)

  return (
    <div>
      <CabecalhoPagina
        titulo="Dados Detalhados"
        contexto={[
          total > 0 ? `${fmtInteiro(total)} registros no recorte` : null,
          ativos > 0 ? `${ativos} ${ativos === 1 ? 'filtro' : 'filtros'} ativos` : null,
        ]}
      />

      <Secao
        eyebrow="Registros"
        titulo="Todos os preços coletados"
        descricao="Cada linha é uma leitura de NFC-e: um produto, uma loja, uma data. Clique nos cabeçalhos para ordenar. A paginação acontece no servidor, então a tabela responde igual com mil ou com um milhão de linhas."
        acessorio={
          <div className="flex flex-wrap items-center gap-2">
            {total > 0 && (
              <TagSecao>
                <span className="num">{fmtInteiro(total)}</span> registros
              </TagSecao>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportar()}
              carregando={exportando}
              disabled={total === 0}
            >
              {!exportando && <Download className="size-3.5" aria-hidden />}
              {exportando
                ? progresso === null
                  ? 'Preparando...'
                  : `${fmtInteiro(progresso.feito)} de ${fmtInteiro(progresso.total)}`
                : 'Exportar CSV'}
            </Button>
          </div>
        }
      >
        {erroExport !== null && (
          <p
            role="alert"
            className="mb-4 rounded-chip border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger-txt"
          >
            {erroExport}
          </p>
        )}

        {total > MAX_EXPORT && (
          <p className="mb-4 rounded-chip border border-warning/25 bg-warning/8 px-3 py-2.5 text-[12px] text-warning-txt">
            O recorte tem {fmtInteiro(total)} registros e o export é limitado a{' '}
            {fmtInteiro(MAX_EXPORT)} linhas. Use os filtros acima para recortar o que
            interessa antes de exportar.
          </p>
        )}

        {consulta.isPending && (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 10 }, (_, i) => (
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

        {consulta.isSuccess && total === 0 && (
          <EstadoVazio
            titulo="Nenhum registro no recorte"
            descricao="Não há coletas para o período, a categoria, a cidade ou o produto selecionados. Remova algum filtro para ampliar a busca."
          />
        )}

        {consulta.isSuccess && total > 0 && (
          <>
            <div
              className={
                consulta.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'
              }
            >
              <Tabela>
                <thead>
                  <tr>
                    <Th
                      ordenavel
                      direcao={dir('data_nf')}
                      onClick={() => alternar('data_nf')}
                    >
                      Data
                    </Th>
                    <Th
                      ordenavel
                      direcao={dir('nome_exibicao')}
                      onClick={() => alternar('nome_exibicao')}
                    >
                      Produto
                    </Th>
                    <Th>Categoria</Th>
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
                      direcao={dir('preco_liquido')}
                      onClick={() => alternar('preco_liquido')}
                    >
                      Preço
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <Tr key={`${l.cod_barras}-${l.cnpj_estabelecimento}-${l.data_nf}-${i}`}>
                      <Td numerica className="whitespace-nowrap text-left">
                        {fmtData(l.data_nf)}
                      </Td>
                      <Td forte>
                        <span className="block max-w-65 truncate">
                          {l.nome_exibicao ?? l.nome_original ?? 'Sem nome'}
                        </span>
                        <span className="num mt-0.5 block text-[10.5px] text-ink-3">
                          {l.cod_barras}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-40 truncate">
                          {l.ncm_grupo ?? '—'}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-55 truncate">
                          {l.nome_estabelecimento ?? 'Sem nome'}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-45 truncate">
                          {[l.bairro, l.cidade].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </Td>
                      <Td numerica forte>
                        {fmtMoeda(l.preco_liquido)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>
            </div>

            {/* ------------------------------------------------- paginacao */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
              <p className="text-[12px] text-ink-2">
                Mostrando{' '}
                <span className="num text-ink">
                  {fmtInteiro(primeiraDaPagina)}–{fmtInteiro(ultimaDaPagina)}
                </span>{' '}
                de <span className="num text-ink">{fmtInteiro(total)}</span>
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[12px] text-ink-3">
                  Por página
                  <select
                    value={porPagina}
                    onChange={(e) => setPorPagina(Number(e.target.value))}
                    className="num rounded-chip border border-line bg-elevated px-2.5 py-1.5 text-[12px] text-ink focus:border-gold/50 focus:outline-none"
                  >
                    {TAMANHOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                    disabled={pagina === 0}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                    Anterior
                  </Button>
                  <span className="num text-[12px] text-ink-2">
                    {pagina + 1} / {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                    disabled={pagina >= totalPaginas - 1}
                    aria-label="Próxima página"
                  >
                    Próxima
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Secao>
    </div>
  )
}

/**
 * Colunas do CSV. Mais colunas que a tabela de propósito: o arquivo vai para
 * uma planilha, onde CNPJ e nome original do cupom sao exatamente o que se usa
 * para cruzar com o ERP do cliente.
 */
const COLUNAS_CSV: ColunaCsv<LinhaDetalhe>[] = [
  {
    cabecalho: 'Data da NFC-e',
    // O Intl pt-BR devolve "03/09/2026, 22:06"; a virgula faz o Excel tratar o
    // campo como texto. Sem ela, ele reconhece data e hora e permite ordenar,
    // filtrar por periodo e calcular diferenca — que e o motivo de exportar.
    valor: (l) => fmtDataHora(l.data_nf).replace(', ', ' '),
  },
  { cabecalho: 'EAN', valor: (l) => String(l.cod_barras) },
  { cabecalho: 'Produto', valor: (l) => l.nome_exibicao ?? '' },
  { cabecalho: 'Nome no cupom', valor: (l) => l.nome_original ?? '' },
  { cabecalho: 'Categoria (NCM)', valor: (l) => l.ncm_grupo ?? '' },
  { cabecalho: 'Classe', valor: (l) => l.classe_item ?? '' },
  { cabecalho: 'CNPJ do estabelecimento', valor: (l) => l.cnpj_estabelecimento ?? '' },
  { cabecalho: 'Estabelecimento', valor: (l) => l.nome_estabelecimento ?? '' },
  { cabecalho: 'Bairro', valor: (l) => l.bairro ?? '' },
  { cabecalho: 'Cidade', valor: (l) => l.cidade ?? '' },
  { cabecalho: 'Preço líquido (R$)', valor: (l) => num(l.preco_liquido) },
]
