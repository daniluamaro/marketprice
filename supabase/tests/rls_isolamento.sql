-- =============================================================================
-- Teste de isolamento multi-tenant (CLAUDE.md §13, §14)
--
-- Valida as tres garantias que o produto vende:
--   A) tenant ativo ve SOMENTE as linhas do proprio CNPJ;
--   B) outro tenant ve ZERO linhas do CNPJ alheio;
--   C) usuario com ativo = false ve ZERO linhas (gate comercial).
-- E, de quebra, que o papel anon nao le a tabela de fatos.
--
-- COMO RODAR: execute os blocos em ordem. Os usuarios criados sao DESCARTAVEIS
-- (dominio @invalid.test) e o bloco final os remove. Eles nao sao contas de
-- login: existem so para satisfazer a FK profiles.id -> auth.users.id.
--
-- Resultado esperado (com a base de 06/09/2026, 331 linhas / 330 do tenant):
--   A -> cnpj 30580282000104, 330 linhas, 3 perfis visiveis (e admin)
--   B -> cnpj 12345678000199,   0 linhas, 1 perfil  visivel
--   C -> cnpj NULL,             0 linhas, 1 perfil  visivel
--   anon -> ERROR 42501 permission denied for table database_coleta
-- =============================================================================

-- ---------- SETUP ------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'teste.tenant.a@invalid.test', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'teste.tenant.b@invalid.test', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'teste.inativo@invalid.test',  'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, email, cnpj_contratante, nome_contratante, role, ativo, plano, senha_provisoria)
values
  ('11111111-1111-4111-8111-111111111111', 'teste.tenant.a@invalid.test', '30580282000104', 'Performar (tenant real)', 'admin', true,  'padrao', true),
  ('22222222-2222-4222-8222-222222222222', 'teste.tenant.b@invalid.test', '12345678000199', 'Concorrente Ficticio',    'user',  true,  'padrao', true),
  ('33333333-3333-4333-8333-333333333333', 'teste.inativo@invalid.test',  '30580282000104', 'Performar (suspenso)',    'user',  false, 'padrao', true)
on conflict (id) do update set
  cnpj_contratante = excluded.cnpj_contratante,
  ativo            = excluded.ativo,
  role             = excluded.role;


-- ---------- A) tenant real, ativo -------------------------------------------
begin;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
set local role authenticated;
select 'A · tenant real (ativo)'                     as persona,
       public.current_cnpj()                         as cnpj_visto,
       public.is_admin()                             as e_admin,
       (select count(*) from public.database_coleta) as linhas_fato,
       (select count(*) from public.v_precos_base)   as linhas_view_base,
       (select count(*) from public.profiles)        as perfis_visiveis;
commit;


-- ---------- B) outro tenant, ativo ------------------------------------------
begin;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
set local role authenticated;
select 'B · outro tenant (ativo)'                    as persona,
       public.current_cnpj()                         as cnpj_visto,
       public.is_admin()                             as e_admin,
       (select count(*) from public.database_coleta) as linhas_fato,
       (select count(*) from public.v_precos_base)   as linhas_view_base,
       (select count(*) from public.profiles)        as perfis_visiveis;
commit;


-- ---------- C) tenant real, SUSPENSO ----------------------------------------
begin;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
set local role authenticated;
select 'C · suspenso (ativo = false)'                as persona,
       public.current_cnpj()                         as cnpj_visto,
       public.is_admin()                             as e_admin,
       (select count(*) from public.database_coleta) as linhas_fato,
       (select count(*) from public.v_precos_base)   as linhas_view_base,
       (select count(*) from public.profiles)        as perfis_visiveis;
commit;


-- ---------- D) anon: deve FALHAR com 42501 ----------------------------------
begin;
set local role anon;
select count(*) from public.database_coleta;
rollback;


-- ---------- TEARDOWN --------------------------------------------------------
-- (o on delete cascade de profiles.id remove os perfis junto)
delete from auth.users where email like '%@invalid.test';
select count(*) as usuarios_restantes from auth.users;
