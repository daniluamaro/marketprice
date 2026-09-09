import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  PackagePlus,
  Ruler,
  Table2,
  Tags,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'
import { fmtCnpj } from '@/lib/format'
import { Marca } from '@/components/Marca'
import { Skeleton } from '@/components/ui/estados'

interface ItemNav {
  to: string
  rotulo: string
  Icone: LucideIcon
  soAdmin?: boolean
}

const RELATORIOS: ItemNav[] = [
  { to: '/', rotulo: 'Visão Geral', Icone: LayoutDashboard },
  { to: '/comparativo', rotulo: 'Comparativo de Preços', Icone: Tags },
  { to: '/ranking', rotulo: 'Ranking de Estabelecimentos', Icone: BarChart3 },
  { to: '/evolucao', rotulo: 'Evolução de Preços', Icone: TrendingUp },
  { to: '/amplitude', rotulo: 'Amplitude & Oportunidades', Icone: Ruler },
  { to: '/categoria', rotulo: 'Análise por Categoria', Icone: LayoutGrid },
  { to: '/geografico', rotulo: 'Análise Geográfica', Icone: MapPin },
  { to: '/dados', rotulo: 'Dados Detalhados', Icone: Table2 },
]

const GESTAO: ItemNav[] = [
  // Sem `soAdmin`: pedir a inclusao de um produto na coleta e necessidade de
  // todo cliente, nao acao privilegiada.
  { to: '/cadastro-produtos', rotulo: 'Cadastro de Produtos', Icone: PackagePlus },
  { to: '/admin', rotulo: 'Administração', Icone: Users, soAdmin: true },
]

function LinkNav({ item, onNavegar }: { item: ItemNav; onNavegar?: () => void }) {
  const { to, rotulo, Icone } = item
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavegar}
      className={({ isActive }) =>
        cn(
          // py-2 e nao py-2.5: o respiro vertical do item e a maior despesa da
          // coluna — 10 itens x 1px a menos de cada lado economiza 40px, mais do
          // que qualquer ajuste de fonte conseguiria (13px -> 12.5px poupa 6px
          // no total inteiro). O alvo de clique fica em ~34px de altura, que
          // segue confortavel para navegacao de mouse no desktop.
          'flex items-center gap-3 rounded-chip border border-transparent px-3 py-2',
          'text-[13px] font-medium leading-tight transition-colors duration-150',
          isActive
            ? 'border-gold/25 bg-linear-to-r from-gold/14 to-gold/3 text-gold-bright'
            : 'text-ink-2 hover:bg-hover hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icone
            className={cn('size-4 shrink-0', isActive ? 'opacity-100' : 'opacity-85')}
            aria-hidden
          />
          <span className="truncate">{rotulo}</span>
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const perfil = useAuth((s) => s.perfil)
  const sair = useAuth((s) => s.sair)
  const [menuAberto, setMenuAberto] = useState(false)

  const itensGestao = GESTAO.filter(
    (i) => i.soAdmin !== true || perfil?.role === 'admin',
  )

  const barraLateral = (
    <>
      <div>
        <Marca />
        <p className="mb-4 ml-11 mt-0.5 text-[10.5px] uppercase tracking-[1.2px] text-ink-3">
          Inteligência de Preços
        </p>
      </div>

      {/*
        `overflow-y-auto` continua aqui de proposito: por mais que a coluna
        caiba nas alturas comuns, existe janela baixa o bastante para estourar,
        e nesse caso rolar e melhor do que esconder item de menu. O que mudou e
        a densidade — a barra deixa de aparecer no caso comum — e a aparencia da
        barra quando ela precisa aparecer (`rolagem-discreta`).
      */}
      <nav className="rolagem-discreta flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <p className="mx-2.5 mb-1.5 text-[10px] uppercase tracking-[1.3px] text-ink-3">
          Relatórios
        </p>
        {RELATORIOS.map((item) => (
          <LinkNav key={item.to} item={item} onNavegar={() => setMenuAberto(false)} />
        ))}

        {itensGestao.length > 0 && (
          <>
            <p className="mx-2.5 mb-1.5 mt-4 text-[10px] uppercase tracking-[1.3px] text-ink-3">
              Gestão
            </p>
            {itensGestao.map((item) => (
              <LinkNav key={item.to} item={item} onNavegar={() => setMenuAberto(false)} />
            ))}
          </>
        )}
      </nav>

      {/*
        Rodape enxuto: a caixa com borda que envolvia empresa + CNPJ saiu. Ela
        custava altura (borda, respiro interno e margem propria) e era essa
        altura que empurrava a navegacao para o scroll — com 10 itens de menu, o
        rodape disputava espaco com o proprio menu.

        Sem a moldura, os tres dados viram um bloco unico de identidade:
        empresa (dona do CNPJ), e-mail (quem esta logado) e o CNPJ formatado.
        A borda superior do rodape ja separa esta area da navegacao; a caixa era
        uma segunda separacao em cima da primeira.
      */}
      <div className="mt-3 shrink-0 border-t border-line-soft pt-3">
        <button
          onClick={() => void sair()}
          className="flex w-full items-center justify-center gap-2 rounded-chip border border-line bg-elevated px-3 py-2 text-[12.5px] text-ink-2 transition-colors duration-150 hover:border-gold/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sair
        </button>

        <div className="mt-3 px-1">
          <p className="truncate text-[12.5px] font-semibold text-ink">
            {perfil?.nome_empresa ?? 'Empresa'}
          </p>
          <p className="truncate text-[11px] text-ink-3">{perfil?.email ?? ''}</p>
          <p className="num mt-0.5 text-[11px] text-ink-2">
            {fmtCnpj(perfil?.cnpj_contratante)}
          </p>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] tracking-[0.3px] text-ink-3">
          <span className="size-1.5 rounded-full bg-success shadow-[0_0_6px_var(--color-success)]" />
          Fonte: SEFAZ/BA · NFC-e
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[284px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line-soft bg-panel px-5 py-6 lg:flex">
        {barraLateral}
      </aside>

      {/* Sidebar mobile (drawer) */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex h-full w-67.5 flex-col border-r border-line-soft bg-panel px-5 py-6">
            <button
              onClick={() => setMenuAberto(false)}
              className="absolute right-3 top-3 rounded-chip p-1.5 text-ink-3 hover:bg-hover hover:text-ink"
              aria-label="Fechar menu"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            {barraLateral}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/*
          A faixa do topo saiu: identidade e "Sair" foram para o rodape da
          barra lateral, e o conteudo passou a comecar no alto da tela.

          Sobrou APENAS a versao mobile (`lg:hidden`), e nao por capricho: no
          celular a barra lateral e uma gaveta, e este botao era o unico jeito
          de abri-la. Sem ele, o telefone ficaria sem navegacao nenhuma.
        */}
        <header className="sticky top-0 z-30 border-b border-line-soft bg-base/85 px-5 py-2.5 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setMenuAberto(true)}
            className="rounded-chip p-2 text-ink-2 hover:bg-hover hover:text-ink"
            aria-label="Abrir menu"
          >
            <Menu className="size-4.5" aria-hidden />
          </button>
        </header>

        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-7xl">
            <Suspense
              fallback={
                <div className="flex flex-col gap-5">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-72 w-full" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
