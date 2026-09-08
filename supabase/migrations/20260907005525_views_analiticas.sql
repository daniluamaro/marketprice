-- =============================================================================
-- Fase 1.3 — Views analiticas
-- Contrato: CLAUDE.md §6.1, §6.2, §6.3
--
-- Todas com security_invoker = true: a view executa com os privilegios de QUEM
-- CONSULTA, entao a RLS de database_coleta e aplicada. Sem isso, a view rodaria
-- como o dono (postgres) e vazaria dados de outros tenants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1 Dimensao de produto.
-- Nome de exibicao = nome_produto MAIS FREQUENTE por EAN.
-- Desempate: maior frequencia -> nome mais curto -> ordem alfabetica.
-- (a fonte nao normaliza nome_produto; o mesmo EAN aparece escrito de formas
-- diferentes por loja, entao a comparacao de produto e sempre por cod_barras)
-- -----------------------------------------------------------------------------
create or replace view public.v_produtos with (security_invoker = true) as
with contagem as (
  select
    cod_barras,
    nome_produto,
    count(*)          as freq,
    max(ncm_grupo)    as ncm_grupo,
    max(classe_item)  as classe_item
  from public.database_coleta
  where cod_barras is not null
  group by cod_barras, nome_produto
)
select distinct on (cod_barras)
  cod_barras,
  nome_produto as nome_exibicao,
  ncm_grupo,
  classe_item
from contagem
order by cod_barras, freq desc, length(nome_produto) asc, nome_produto asc;

comment on view public.v_produtos is
  'Dimensao de produto por EAN. nome_exibicao = nome_produto mais frequente (desempate: mais curto, depois alfabetico).';

-- -----------------------------------------------------------------------------
-- 6.2 Preco vigente = registro mais recente por data_nf para cada par
--     (cod_barras, cnpj_estabelecimento).
-- -----------------------------------------------------------------------------
create or replace view public.v_preco_vigente with (security_invoker = true) as
select distinct on (cod_barras, cnpj_estabelecimento)
  cod_barras,
  cnpj_estabelecimento,
  nome_estabelecimento,
  bairro,
  cidade,
  cod_cidade,
  preco_liquido,
  data_nf
from public.database_coleta
where cod_barras           is not null
  and cnpj_estabelecimento is not null
  and preco_liquido        is not null
order by cod_barras, cnpj_estabelecimento, data_nf desc;

comment on view public.v_preco_vigente is
  'Preco vigente (ultimo data_nf) por produto x estabelecimento, sem recorte de periodo.';

-- -----------------------------------------------------------------------------
-- 6.3 Fato enriquecido: base da tela Dados Detalhados e de todas as RPCs.
-- -----------------------------------------------------------------------------
create or replace view public.v_precos_base with (security_invoker = true) as
select
  f.cod_barras,
  p.nome_exibicao,
  f.nome_produto as nome_original,
  p.ncm_grupo,
  p.classe_item,
  f.cnpj_estabelecimento,
  f.nome_estabelecimento,
  f.bairro,
  f.cidade,
  f.cod_cidade,
  f.preco_liquido,
  f.data_nf,
  f.data_consulta
from public.database_coleta f
join public.v_produtos p using (cod_barras);

comment on view public.v_precos_base is
  'Fato enriquecido com o nome de exibicao canonico do produto. Base das RPCs e da tela de dados detalhados.';

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.v_produtos       from anon;
revoke all on public.v_preco_vigente  from anon;
revoke all on public.v_precos_base    from anon;

grant select on public.v_produtos       to authenticated, service_role;
grant select on public.v_preco_vigente  to authenticated, service_role;
grant select on public.v_precos_base    to authenticated, service_role;
