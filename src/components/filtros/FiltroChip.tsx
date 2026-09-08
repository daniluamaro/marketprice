import { useEffect, useId, useRef, useState } from 'react'
import { Barcode, Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Opcao {
  valor: string
  rotulo: string
  /** Linha secundaria (bairro, cidade, EAN...). */
  detalhe?: string
}

/**
 * Chip de filtro: le como "Rótulo: Valor" e abre uma lista ao clicar.
 *
 * Quando ha muitas opcoes (90 estabelecimentos, por exemplo) um campo de busca
 * aparece automaticamente — rolar uma lista de 90 itens para achar uma loja
 * seria pior do que nao ter o filtro.
 */
export function FiltroChip({
  rotulo,
  valor,
  opcoes,
  onEscolher,
  placeholder = 'Todos',
  limiteBusca = 12,
}: {
  rotulo: string
  valor: string | null
  opcoes: Opcao[]
  onEscolher: (valor: string | null) => void
  placeholder?: string
  limiteBusca?: number
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const idLista = useId()

  useEffect(() => {
    if (!aberto) return

    const aoClicarFora = (e: MouseEvent) => {
      if (!container.current?.contains(e.target as Node)) setAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) setBusca('')
  }, [aberto])

  const selecionada = opcoes.find((o) => o.valor === valor) ?? null
  const mostrarBusca = opcoes.length > limiteBusca

  const filtradas =
    busca.trim() === ''
      ? opcoes
      : opcoes.filter((o) =>
          `${o.rotulo} ${o.detalhe ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase()),
        )

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idLista}
        className={cn(
          'flex h-9 max-w-70 items-center gap-2 rounded-chip border px-3.5 text-[12.5px] transition-colors',
          valor === null
            ? 'border-line bg-panel text-ink-2 hover:border-ink-3/60 hover:text-ink'
            : 'border-gold/40 bg-gold/8 text-ink',
        )}
      >
        <span className="shrink-0 text-ink-3">{rotulo}:</span>
        <span className="truncate font-semibold">
          {selecionada?.rotulo ?? placeholder}
        </span>
        {valor !== null ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Remover filtro de ${rotulo}`}
            onClick={(e) => {
              e.stopPropagation()
              onEscolher(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                e.preventDefault()
                onEscolher(null)
              }
            }}
            className="-mr-1 shrink-0 rounded p-0.5 text-ink-2 transition-colors hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </span>
        ) : (
          <ChevronDown className="-mr-1 size-3.5 shrink-0 opacity-70" aria-hidden />
        )}
      </button>

      {aberto && (
        <div
          id={idLista}
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-75 overflow-hidden rounded-card border border-line bg-elevated shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]"
        >
          {mostrarBusca && (
            <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5">
              <Search className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={`Buscar ${rotulo.toLowerCase()}...`}
                className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>
          )}

          <ul className="max-h-75 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onEscolher(null)
                  setAberto(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
              >
                {placeholder}
                {valor === null && <Check className="size-3.5 text-gold" aria-hidden />}
              </button>
            </li>

            {filtradas.map((o) => (
              <li key={o.valor}>
                <button
                  type="button"
                  onClick={() => {
                    onEscolher(o.valor)
                    setAberto(false)
                  }}
                  className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate text-[12.5px]',
                        o.valor === valor ? 'font-semibold text-gold-bright' : 'text-ink',
                      )}
                    >
                      {o.rotulo}
                    </span>
                    {o.detalhe !== undefined && (
                      <span className="mt-0.5 block truncate text-[11px] text-ink-3">
                        {o.detalhe}
                      </span>
                    )}
                  </span>
                  {o.valor === valor && (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
                  )}
                </button>
              </li>
            ))}

            {filtradas.length === 0 && (
              <li className="px-3 py-4 text-center text-[12px] text-ink-3">
                Nada encontrado para “{busca}”.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Busca livre por codigo de barras.
 *
 * O chip "Produto" so oferece o que ja esta na lista de opcoes; este campo
 * atende quem chega com o EAN na mao — vindo de uma planilha, de um pedido de
 * compra ou da propria embalagem — e nao quer rolar a lista atras do nome.
 *
 * Os dois escrevem no MESMO filtro global (`ean`), entao escolher pelo nome ou
 * digitar o codigo tem exatamente o mesmo efeito, e um reflete o outro.
 */
export function FiltroEan({
  valor,
  eansConhecidos,
  onEscolher,
}: {
  valor: string | null
  eansConhecidos: ReadonlySet<string>
  onEscolher: (valor: string | null) => void
}) {
  const [texto, setTexto] = useState(valor ?? '')
  const [aviso, setAviso] = useState<string | null>(null)
  const idAviso = useId()

  // O EAN tambem muda pelo chip "Produto" e pelo "Limpar filtros"; o campo
  // precisa espelhar o estado global, nao apenas o que foi digitado aqui.
  useEffect(() => {
    setTexto(valor ?? '')
    setAviso(null)
  }, [valor])

  function aplicar() {
    const limpo = texto.replace(/\D/g, '')

    if (limpo === '') {
      setAviso(null)
      if (valor !== null) onEscolher(null)
      return
    }

    // Aceitar um EAN inexistente esvaziaria o painel inteiro sem explicar o
    // motivo. E melhor recusar aqui, ao lado de quem acabou de digitar.
    if (!eansConhecidos.has(limpo)) {
      setAviso('EAN não encontrado nos seus dados.')
      return
    }

    setAviso(null)
    onEscolher(limpo)
  }

  const ativo = valor !== null && valor === texto.replace(/\D/g, '')

  return (
    <div className="relative">
      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-chip border px-3.5 text-[12.5px] transition-colors',
          aviso !== null
            ? 'border-danger/45 bg-danger/7'
            : ativo
              ? 'border-gold/40 bg-gold/8'
              : 'border-line bg-panel focus-within:border-gold/40',
        )}
      >
        <Barcode className="size-3.5 shrink-0 text-ink-3" aria-hidden />
        <span className="shrink-0 text-ink-3">EAN:</span>

        <input
          value={texto}
          inputMode="numeric"
          autoComplete="off"
          aria-label="Filtrar por código EAN"
          aria-invalid={aviso !== null}
          aria-describedby={aviso !== null ? idAviso : undefined}
          onChange={(e) => {
            setTexto(e.target.value.replace(/\D/g, ''))
            setAviso(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              aplicar()
            }
            if (e.key === 'Escape') {
              setTexto(valor ?? '')
              setAviso(null)
            }
          }}
          placeholder="código + Enter"
          className={cn(
            'w-31 bg-transparent text-[12.5px] text-ink',
            'placeholder:font-body placeholder:text-ink-3 focus:outline-none',
            texto !== '' && 'num',
          )}
        />

        {texto !== '' && (
          <button
            type="button"
            aria-label="Remover filtro de EAN"
            // mousedown, e nao click: o blur do input nao pode chegar antes.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTexto('')
              setAviso(null)
              if (valor !== null) onEscolher(null)
            }}
            className="-mr-1 shrink-0 rounded p-0.5 text-ink-2 transition-colors hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {aviso !== null && (
        <p
          id={idAviso}
          role="alert"
          className="absolute left-0 top-[calc(100%+5px)] z-40 whitespace-nowrap rounded-chip border border-danger/25 bg-elevated px-2.5 py-1.5 text-[11.5px] text-danger-txt shadow-[0_14px_36px_-16px_rgba(0,0,0,0.9)]"
        >
          {aviso}
        </p>
      )}
    </div>
  )
}

/** Variante para intervalo de datas — dois campos nativos dentro do chip. */
export function FiltroPeriodo({
  dataIni,
  dataFim,
  min,
  max,
  onMudar,
}: {
  dataIni: string | null
  dataFim: string | null
  min?: string | undefined
  max?: string | undefined
  onMudar: (ini: string | null, fim: string | null) => void
}) {
  const [aberto, setAberto] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const ativo = dataIni !== null || dataFim !== null

  useEffect(() => {
    if (!aberto) return
    const aoClicarFora = (e: MouseEvent) => {
      if (!container.current?.contains(e.target as Node)) setAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  const formatar = (iso: string | null) => {
    if (iso === null) return null
    const [a, m, d] = iso.split('-')
    return `${d}/${m}/${a}`
  }

  const texto = ativo
    ? `${formatar(dataIni) ?? 'início'} – ${formatar(dataFim) ?? 'hoje'}`
    : 'Todo o período'

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={cn(
          'flex h-9 items-center gap-2 rounded-chip border px-3.5 text-[12.5px] transition-colors',
          ativo
            ? 'border-gold/40 bg-gold/8 text-ink'
            : 'border-line bg-panel text-ink-2 hover:border-ink-3/60 hover:text-ink',
        )}
      >
        <span className="shrink-0 text-ink-3">Período:</span>
        <span className={cn('font-semibold', ativo && 'num')}>{texto}</span>
        {ativo ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Remover filtro de período"
            onClick={(e) => {
              e.stopPropagation()
              onMudar(null, null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                e.preventDefault()
                onMudar(null, null)
              }
            }}
            className="-mr-1 shrink-0 rounded p-0.5 text-ink-2 transition-colors hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </span>
        ) : (
          <ChevronDown className="-mr-1 size-3.5 shrink-0 opacity-70" aria-hidden />
        )}
      </button>

      {aberto && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-70 rounded-card border border-line bg-elevated p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[1.1px] text-ink-3">
                De
              </span>
              <input
                type="date"
                value={dataIni ?? ''}
                min={min}
                max={max}
                onChange={(e) => onMudar(e.target.value || null, dataFim)}
                className="num h-9 rounded-chip border border-line bg-panel px-2.5 text-[12.5px] text-ink focus:border-gold/50 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[1.1px] text-ink-3">
                Até
              </span>
              <input
                type="date"
                value={dataFim ?? ''}
                min={min}
                max={max}
                onChange={(e) => onMudar(dataIni, e.target.value || null)}
                className="num h-9 rounded-chip border border-line bg-panel px-2.5 text-[12.5px] text-ink focus:border-gold/50 focus:outline-none"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
