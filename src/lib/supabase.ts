import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Falha cedo e alto: sem isso o app so quebraria na primeira chamada de rede,
  // com um erro incompreensivel.
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de build.',
  )
}

/**
 * Cliente unico da aplicacao. Usa SOMENTE a anon key — publica por design.
 * Todo o isolamento entre clientes e garantido no servidor pela RLS; o
 * frontend nao tem, e nao deve ter, poder de decidir o que pode ler.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
