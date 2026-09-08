-- =============================================================================
-- Segunda barreira para a Administracao: senha exclusiva do dono
--
-- POR QUE EXISTE: hoje `role = 'admin'` sozinho libera criar clientes, resetar
-- senhas e desativar acessos. Quem obtiver a sessao do admin — notebook aberto,
-- token copiado — herda esse poder inteiro. Esta senha separa "estar logado"
-- de "poder administrar".
--
-- ONDE MORA O SEGREDO: aqui, e nao em variavel de ambiente, por um motivo de
-- produto: assim o dono troca a senha pela propria tela, sem precisar abrir o
-- painel do Supabase. O que se guarda e o HASH SHA-256, nunca a senha.
--
-- QUEM ALCANCA ESTA TABELA: ninguem, exceto a service_role.
--   * RLS ligada e ZERO policies  -> todo select/insert/update/delete de anon e
--     de authenticated devolve vazio ou erro, mesmo com grant.
--   * revoke all                  -> nem chega a tentar.
--   * a service_role ignora RLS por definicao, e ela so existe dentro da Edge
--     Function `admin-users`.
-- As duas travas juntas sao de proposito: se um grant futuro reabrir a tabela
-- por descuido, a RLS sem policy ainda segura.
--
-- A linha e unica (id fixo em 1). Um check impede que se criem varias
-- configuracoes e a funcao passe a ler a errada.
-- =============================================================================

create table if not exists public.admin_seguranca (
  id             smallint primary key default 1 check (id = 1),
  senha_hash     text        not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid        references auth.users(id) on delete set null
);

comment on table public.admin_seguranca is
  'Hash SHA-256 da senha de administracao. Acessivel somente pela service_role, dentro da Edge Function admin-users.';

alter table public.admin_seguranca enable row level security;

-- Nenhuma policy e criada de proposito: com RLS ligada, a ausencia de policy
-- significa "nada passa". Nao adicione policies aqui.

revoke all on public.admin_seguranca from anon, authenticated;
