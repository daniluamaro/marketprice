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
          'flex items-center gap-3 rounded-chip border border-transparent px-3 py-2.5',
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
        <p className="mb-7 ml-11 mt-0.5 text-[10.5px] uppercase tracking-[1.2px] text-ink-3">
          Inteligência de Preços
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <p className="mx-2.5 mb-2 mt-1 text-[10px] uppercase tracking-[1.3px] text-ink-3">
          Relatórios
        </p>
        {RELATORIOS.map((item) => (
          <LinkNav key={item.to} item={item} onNavegar={() => setMenuAberto(false)} />
        ))}

        {itensGestao.length > 0 && (
          <>
            <p className="mx-2.5 mb-2 mt-5 text-[10px] uppercase tracking-[1.3px] text-ink-3">
              Gestão
            </p>
            {itensGestao.map((item) => (
              <LinkNav key={item.to} item={item} onNavegar={() => setMenuAberto(false)} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-4 border-t border-line-soft pt-4">
        <div className="rounded-chip border border-line bg-elevated px-3 py-2.5">
          <p className="truncate text-[12.5px] font-semibold text-ink">
            {perfil?.nome_contratante ?? 'Empresa'}
          </p>
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
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line-soft bg-panel px-5 py-7 lg:flex">
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
          <aside className="relative flex h-full w-67.5 flex-col border-r border-line-soft bg-panel px-5 py-7">
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
          A faixa do topo sangra de ponta a ponta (a borda inferior precisa
          cruzar a tela inteira), mas o CONTEUDO dela usa o mesmo contêiner de
          1280px do <main>. Sem isso o botao "Sair" ficava colado na borda da
          janela, adiantado em relacao aos cartoes logo abaixo.
        */}
        <header className="sticky top-0 z-30 border-b border-line-soft bg-base/85 px-5 py-3 backdrop-blur-md lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <button
              onClick={() => setMenuAberto(true)}
              className="rounded-chip p-2 text-ink-2 hover:bg-hover hover:text-ink lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-4.5" aria-hidden />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">
                {perfil?.nome_contratante ?? '—'}
              </p>
              <p className="truncate text-[11px] text-ink-3">{perfil?.email ?? ''}</p>
            </div>

            <button
              onClick={() => void sair()}
              className="flex items-center gap-2 rounded-chip border border-line bg-elevated px-3 py-2 text-[12.5px] text-ink-2 transition-colors hover:border-gold/30 hover:text-ink"
            >
              <LogOut className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
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
