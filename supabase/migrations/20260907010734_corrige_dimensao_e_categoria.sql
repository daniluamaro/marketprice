-- =============================================================================
-- Fase 1.6 — Duas correcoes na camada analitica, achadas ao validar os numeros
-- =============================================================================
--
-- CORRECAO 1 — v_produtos: escolha de ncm_grupo / classe_item por EAN.
--
-- A fonte e inconsistente: 7 dos 23 EANs aparecem com ncm_grupo diferente entre
-- notas, e o EAN 7896098909720 aparece com os QUATRO grupos existentes
-- ('ARTIGOS DE LIMPEZA', 'HIGIENE PESSOAL', 'OUTROS PRODUTOS', 'SEM DEFINICAO').
--
-- A versao anterior usava max(ncm_grupo), copiado do rascunho do §6.1. max() em
-- texto e ordem alfabetica, e alfabeticamente 'SEM DEFINIÇÃO' vence todos os
-- outros — ou seja, o desempate escolhia sistematicamente o pior rotulo
-- possivel. Efeito colateral observado: dos 4 grupos do fato, so 2 chegavam a
-- dimensao, e a barra de filtros perdia categorias inteiras.
--
-- Agora ncm_grupo e classe_item seguem a MESMA regra que o §6.1 ja manda usar
-- para o nome de exibicao: o valor MAIS FREQUENTE por EAN — com 'SEM DEFINIÇÃO'
-- despriorizado explicitamente, porque e ausencia de classificacao, nao uma
-- categoria concorrente.
--
-- CORRECAO 2 — rpc_preco_categoria: a amplitude estava sem sentido.
--
-- Ela calculava (max - min) / min sobre TODOS os precos da categoria, ou seja,
-- comparava produtos diferentes entre si: dava 987% em ARTIGOS DE LIMPEZA e
-- 1.894% em OUTROS PRODUTOS, so porque a categoria tem itens de R$ 2,29 e de
-- R$ 45,68. Isso nao mede descontrole de preco, mede variedade de sortimento —
-- e exibido como "amplitude" enganaria o cliente.
--
-- Substituida por amplitude_mediana_pct: calcula a amplitude DE CADA PRODUTO e
-- tira a mediana dentro da categoria, considerando so produtos vendidos em 2+
-- estabelecimentos (com 1 loja a amplitude e sempre 0% e puxaria a mediana).
-- Responde a pergunta certa: "num produto tipico desta categoria, quanto o
-- preco varia entre lojas?".
-- =============================================================================


-- ---------- CORRECAO 1 -------------------------------------------------------
create or replace view public.v_produtos with (security_invoker = true) as
with nomes as (
  select cod_barras, nome_produto, count(*) as freq
  from public.database_coleta
  where cod_barras is not null and nome_produto is not null
  group by cod_barras, nome_produto
),
nome_escolhido as (
  select distinct on (cod_barras) cod_barras, nome_produto as nome_exibicao
  from nomes
  order by cod_barras, freq desc, length(nome_produto) asc, nome_produto asc
),
grupos as (
  select cod_barras, ncm_grupo, count(*) as freq
  from public.database_coleta
  where cod_barras is not null and ncm_grupo is not null
  group by cod_barras, ncm_grupo
),
grupo_escolhido as (
  select distinct on (cod_barras) cod_barras, ncm_grupo
  from grupos
  order by cod_barras,
           (ncm_grupo = 'SEM DEFINIÇÃO') asc,  -- false ordena antes de true
           freq desc,
           ncm_grupo asc
),
classes as (
  select cod_barras, classe_item, count(*) as freq
  from public.database_coleta
  where cod_barras is not null and classe_item is not null
  group by cod_barras, classe_item
),
classe_escolhida as (
  select distinct on (cod_barras) cod_barras, classe_item
  from classes
  order by cod_barras, freq desc, classe_item asc
)
select
  n.cod_barras,
  n.nome_exibicao,
  g.ncm_grupo,
  c.classe_item
from nome_escolhido n
left join grupo_escolhido  g using (cod_barras)
left join classe_escolhida c using (cod_barras);

comment on view public.v_produtos is
  'Dimensao de produto por EAN. nome_exibicao, ncm_grupo e classe_item = valor mais frequente por EAN (SEM DEFINICAO despriorizado). Desempate do nome: mais curto, depois alfabetico.';


-- ---------- CORRECAO 2 -------------------------------------------------------
-- drop necessario: a lista de colunas de retorno muda, e create or replace nao
-- consegue alterar a assinatura de retorno de uma funcao.
drop function if exists public.rpc_preco_categoria(date, date, text);

create function public.rpc_preco_categoria(
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_cidade    text default null
)
returns table (
  ncm_grupo              text,
  produtos               bigint,
  estabelecimentos       bigint,
  preco_min              numeric,
  preco_medio            numeric,
  preco_max              numeric,
  amplitude_mediana_pct  numeric
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select b.*
    from public.v_precos_base b
    where b.preco_liquido is not null
      and (p_data_ini is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
      and (p_data_fim is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
      and (p_cidade   is null or b.cidade = p_cidade)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  por_produto as (
    select
      coalesce(v.ncm_grupo, 'Sem categoria')                                                  as grupo,
      v.cod_barras,
      count(distinct v.cnpj_estabelecimento)                                                  as lojas,
      (max(v.preco_liquido) - min(v.preco_liquido)) / nullif(min(v.preco_liquido), 0) * 100   as amplitude
    from vigente v
    group by coalesce(v.ncm_grupo, 'Sem categoria'), v.cod_barras
  )
  agregado as (
    select
      coalesce(v.ncm_grupo, 'Sem categoria')  as grupo,
      count(distinct v.cod_barras)            as produtos,
      count(distinct v.cnpj_estabelecimento)  as estabelecimentos,
      min(v.preco_liquido)                    as preco_min,
      round(avg(v.preco_liquido), 2)          as preco_medio,
      max(v.preco_liquido)                    as preco_max
    from vigente v
    group by coalesce(v.ncm_grupo, 'Sem categoria')
  ),
  mediana as (
    select
      pp.grupo,
      round(percentile_cont(0.5) within group (order by pp.amplitude::double precision)::numeric, 2) as amp_mediana
    from por_produto pp
    where pp.lojas >= 2
    group by pp.grupo
  )
  select
    a.grupo,
    a.produtos,
    a.estabelecimentos,
    a.preco_min,
    a.preco_medio,
    a.preco_max,
    m.amp_mediana
  from agregado a
  left join mediana m on m.grupo = a.grupo
  order by a.produtos desc;
$$;

revoke all   on function public.rpc_preco_categoria(date, date, text) from public, anon;
grant execute on function public.rpc_preco_categoria(date, date, text) to authenticated, service_role;
