-- =============================================================================
-- Fase 1.1 — Tabela de perfis, identidade de tenant e troca de senha
-- Contrato: CLAUDE.md §4.2, §5, §7
--
-- NADA aqui cria ou altera a tabela de fatos public.database_coleta.
-- =============================================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  cnpj_contratante  text not null,
  nome_contratante  text,
  role              text not null default 'user' check (role in ('user','admin')),
  ativo             boolean not null default true,       -- gate de acesso pago
  plano             text default 'padrao',               -- rotulo comercial
  senha_provisoria  boolean not null default true,       -- forca troca no 1o acesso
  created_at        timestamptz not null default now()
);

create index if not exists profiles_cnpj_contratante_idx
  on public.profiles (cnpj_contratante);

comment on table public.profiles is
  'Liga cada usuario do Auth a um unico CNPJ contratante. Controla papel, estado comercial (ativo) e senha provisoria.';

alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- current_cnpj(): tenant do usuario logado.
-- Usuario inativo => retorna NULL => a policy da tabela de fatos nao casa com
-- nenhuma linha => ele nao ve absolutamente nada. (CLAUDE.md §5)
-- -----------------------------------------------------------------------------
create or replace function public.current_cnpj()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.cnpj_contratante
  from public.profiles p
  where p.id = auth.uid()
    and p.ativo = true;
$$;

comment on function public.current_cnpj() is
  'CNPJ do tenant do usuario logado, ou NULL se inexistente/inativo. Usada pelas policies de RLS.';

-- -----------------------------------------------------------------------------
-- is_admin(): SECURITY DEFINER de proposito.
--
-- DIVERGENCIA TECNICA vs. o snippet do CLAUDE.md §5: a policy "admin_read_all"
-- escrita como `exists (select 1 from public.profiles ...)` consulta a propria
-- tabela protegida, o que faz o Postgres reavaliar a policy recursivamente e
-- aborta a query com "infinite recursion detected in policy for relation
-- profiles". Encapsular a checagem num SECURITY DEFINER quebra a recursao —
-- e o resultado funcional e identico ao pretendido pelo contrato.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.ativo = true
  );
$$;

comment on function public.is_admin() is
  'True se o usuario logado e admin ativo. SECURITY DEFINER para evitar recursao de RLS em profiles.';

-- -----------------------------------------------------------------------------
-- rpc_confirmar_troca_senha(): marca a senha como definitiva apos o 1o acesso.
-- Unica escrita em profiles permitida ao cliente, e restrita a propria linha.
-- (CLAUDE.md §7)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_confirmar_troca_senha()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set senha_provisoria = false
   where id = auth.uid();
$$;

comment on function public.rpc_confirmar_troca_senha() is
  'Marca senha_provisoria = false para o proprio usuario, apos supabase.auth.updateUser({password}).';

-- -----------------------------------------------------------------------------
-- Policies de profiles: SOMENTE leitura para o cliente.
-- Escrita (insert/update/delete) fica sem policy => so a Edge Function
-- admin-users (service_role) e o RPC acima conseguem escrever. (CLAUDE.md §5)
-- -----------------------------------------------------------------------------
drop policy if exists "self_read" on public.profiles;
create policy "self_read"
  on public.profiles
  for select
  to authenticated
  using ( id = auth.uid() );

drop policy if exists "admin_read_all" on public.profiles;
create policy "admin_read_all"
  on public.profiles
  for select
  to authenticated
  using ( public.is_admin() );

-- -----------------------------------------------------------------------------
-- Grants: anon nao toca em nada. authenticated so le.
-- -----------------------------------------------------------------------------
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

revoke all on function public.current_cnpj()             from public;
revoke all on function public.is_admin()                 from public;
revoke all on function public.rpc_confirmar_troca_senha() from public;

grant execute on function public.current_cnpj()             to authenticated, service_role;
grant execute on function public.is_admin()                 to authenticated, service_role;
grant execute on function public.rpc_confirmar_troca_senha() to authenticated, service_role;
