import { lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/store/auth'
import { AppShell } from '@/components/AppShell'
import {
  ExigeAcessoLiberado,
  ExigeAdmin,
  ExigeBloqueio,
  ExigeTrocaPendente,
  SomenteDeslogado,
} from '@/routes/guards'
import Login from '@/pages/Login'
import DefinirSenha from '@/pages/DefinirSenha'
import AcessoSuspenso from '@/pages/AcessoSuspenso'
import NaoEncontrada from '@/pages/NaoEncontrada'

// Code-splitting: o ECharts sozinho passa de 600 kB. Sem isto, quem abre a tela
// de login baixa a biblioteca de graficos inteira para ver dois campos de texto.
// O limite de Suspense fica dentro do AppShell, para a sidebar nao piscar.
const VisaoGeral = lazy(() => import('@/pages/VisaoGeral'))
const Comparativo = lazy(() => import('@/pages/Comparativo'))
const Ranking = lazy(() => import('@/pages/Ranking'))
const Evolucao = lazy(() => import('@/pages/Evolucao'))
const Amplitude = lazy(() => import('@/pages/Amplitude'))
const Categoria = lazy(() => import('@/pages/Categoria'))
const Geografico = lazy(() => import('@/pages/Geografico'))
const DadosDetalhados = lazy(() => import('@/pages/DadosDetalhados'))
const Administracao = lazy(() => import('@/pages/Administracao'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dinamismo (§9): a base cresce continuamente pelo n8n, entao a janela de
      // "fresco" e curta e voltar para a aba revalida.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export default function App() {
  const iniciar = useAuth((s) => s.iniciar)

  useEffect(() => {
    iniciar()
  }, [iniciar])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<SomenteDeslogado />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Telas dos portoes. Cada uma sai sozinha quando deixa de ser
              necessaria — senao viram beco sem saida. */}
          <Route element={<ExigeTrocaPendente />}>
            <Route path="/definir-senha" element={<DefinirSenha />} />
          </Route>
          <Route element={<ExigeBloqueio />}>
            <Route path="/acesso-suspenso" element={<AcessoSuspenso />} />
          </Route>

          <Route element={<ExigeAcessoLiberado />}>
            <Route element={<AppShell />}>
              <Route index element={<VisaoGeral />} />
              <Route path="/comparativo" element={<Comparativo />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/evolucao" element={<Evolucao />} />
              <Route path="/amplitude" element={<Amplitude />} />
              <Route path="/categoria" element={<Categoria />} />
              <Route path="/geografico" element={<Geografico />} />
              <Route path="/dados" element={<DadosDetalhados />} />

              <Route element={<ExigeAdmin />}>
                <Route path="/admin" element={<Administracao />} />
              </Route>
            </Route>
          </Route>

          <Route path="/404" element={<NaoEncontrada />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
