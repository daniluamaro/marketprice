-- ============================================================================
-- Exclusao do item "LA ACO ASSOLAN" (EAN 27896090100105) da base de fatos
--
-- Motivo: este codigo de barras mistura a unidade e o multipack sob o mesmo
-- EAN. Como toda a analitica compara por `cod_barras` (CLAUDE.md §4.1), o
-- produto aparece com amplitude de 1.887% — nao e oportunidade de mercado, e
-- ruido de cadastro na origem.
--
-- COMO USAR: Supabase → SQL Editor. Rode a ETAPA 1 sozinha e LEIA o resultado.
-- So depois rode a ETAPA 2. Elas sao independentes de proposito.
--
-- AVISO 1 — isto e DELETE, nao e reversivel pelo painel. A ETAPA 2 copia as
--           linhas para `manutencao.lixeira_coleta` antes de apagar, na mesma
--           transacao. E de la que se restaura (ETAPA 4), se precisar.
-- AVISO 2 — o fluxo do n8n continua alimentando a tabela. Se ele voltar a
--           coletar este EAN, as linhas voltam. Apagar resolve o relatorio de
--           hoje; nao resolve amanha. Ver a nota no fim do arquivo.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- ETAPA 1 — Conferencia. Rode isto primeiro, sozinho. Nao apaga nada.
--
-- Lista TODO EAN cujo nome contenha "ASSOLAN", com quantas linhas tem, o
-- intervalo de preco e a amplitude. Confirme que o EAN de 1.887% e mesmo o
-- 27896090100105 antes de seguir — se for outro, troque o codigo na ETAPA 2.
-- ---------------------------------------------------------------------------
select
  f.cod_barras,
  count(*)                                                   as linhas,
  count(distinct f."CNPJ_contratante")                        as tenants,
  count(distinct f.cnpj_estabelecimento)                      as lojas,
  min(f.preco_liquido)                                        as preco_min,
  max(f.preco_liquido)                                        as preco_max,
  round(
    (max(f.preco_liquido) - min(f.preco_liquido))
      / nullif(min(f.preco_liquido), 0) * 100
  , 1)                                                        as amplitude_pct,
  min(f.data_nf)                                              as primeira_nf,
  max(f.data_nf)                                              as ultima_nf,
  -- os nomes distintos sob o mesmo codigo: e aqui que a mistura aparece
  (
    select string_agg(distinct g.nome_produto, ' | ')
    from public.database_coleta g
    where g.cod_barras = f.cod_barras
  )                                                           as nomes_no_ean
from public.database_coleta f
where f.nome_produto ilike '%ASSOLAN%'
group by f.cod_barras
order by amplitude_pct desc nulls last;


-- ---------------------------------------------------------------------------
-- ETAPA 2 — Exclusao. So rode depois de conferir a ETAPA 1.
--
-- Tudo em UMA transacao: ou copia e apaga, ou nao faz nada. O bloco aborta
-- sozinho se o EAN nao existir (protege contra apagar por engano depois de
-- ja ter rodado, ou se o codigo estiver errado).
--
-- Escopo: por padrao apaga o EAN em TODOS os contratantes. Para limitar a um
-- CNPJ, descomente as duas linhas marcadas com [ESCOPO].
-- ---------------------------------------------------------------------------
begin;

-- Schema privado, fora do `public`: assim a lixeira NAO e exposta pela API do
-- PostgREST e nenhum cliente logado consegue ler o que foi apagado.
create schema if not exists manutencao;
revoke all on schema manutencao from anon, authenticated;

create table if not exists manutencao.lixeira_coleta as
  select f.*,
         now()::timestamptz as excluido_em,
         ''::text           as motivo
  from public.database_coleta f
  where false;

revoke all on manutencao.lixeira_coleta from anon, authenticated;

do $$
declare
  v_ean    text := '27896090100105';   -- <<< EAN a excluir (confira na ETAPA 1)
  v_cnpj   text := null;               -- [ESCOPO] ex.: '30580282000104'
  v_linhas int;
begin
  select count(*) into v_linhas
  from public.database_coleta f
  where f.cod_barras = v_ean
    and (v_cnpj is null or (f."CNPJ_contratante")::bigint::text = v_cnpj);

  if v_linhas = 0 then
    raise exception
      'Nada a excluir: nenhum registro com cod_barras = %  (escopo CNPJ: %). '
      'Verifique o EAN na ETAPA 1.', v_ean, coalesce(v_cnpj, 'todos');
  end if;

  insert into manutencao.lixeira_coleta
  select f.*, now(), 'EAN mistura unidade e multipack — amplitude irreal'
  from public.database_coleta f
  where f.cod_barras = v_ean
    and (v_cnpj is null or (f."CNPJ_contratante")::bigint::text = v_cnpj);

  delete from public.database_coleta f
  where f.cod_barras = v_ean
    and (v_cnpj is null or (f."CNPJ_contratante")::bigint::text = v_cnpj);

  raise notice 'Excluidas % linhas do EAN % (copia salva em manutencao.lixeira_coleta).',
    v_linhas, v_ean;
end $$;

commit;
-- Se algo parecer errado ANTES de rodar o commit, use:  rollback;


-- ---------------------------------------------------------------------------
-- ETAPA 3 — Verificacao. Deve retornar zero linhas na base e N na lixeira.
-- ---------------------------------------------------------------------------
select 'ainda na base'  as onde, count(*) as linhas
from public.database_coleta where cod_barras = '27896090100105'
union all
select 'na lixeira',              count(*)
from manutencao.lixeira_coleta   where cod_barras = '27896090100105';


-- ---------------------------------------------------------------------------
-- ETAPA 4 — Desfazer (so se precisar). Devolve as linhas e limpa a lixeira.
-- ---------------------------------------------------------------------------
-- As colunas sao listadas uma a uma de proposito: a lixeira tem duas colunas a
-- mais (excluido_em, motivo), entao um `select l.*` nao encaixaria na tabela.
--
-- begin;
--   insert into public.database_coleta (
--     pk_chave, "CNPJ_contratante", nome_contratante, cod_nfce, tipo_nfce,
--     cod_barras, nome_produto, classe_item, cod_ncm, ncm_grupo,
--     preco_bruto, preco_liquido, desconto, unidade,
--     cnpj_estabelecimento, nome_estabelecimento, bairro, cod_cidade, cidade,
--     telefone, data_nf, data_consulta
--   )
--   select
--     l.pk_chave, l."CNPJ_contratante", l.nome_contratante, l.cod_nfce, l.tipo_nfce,
--     l.cod_barras, l.nome_produto, l.classe_item, l.cod_ncm, l.ncm_grupo,
--     l.preco_bruto, l.preco_liquido, l.desconto, l.unidade,
--     l.cnpj_estabelecimento, l.nome_estabelecimento, l.bairro, l.cod_cidade, l.cidade,
--     l.telefone, l.data_nf, l.data_consulta
--   from manutencao.lixeira_coleta l
--   where l.cod_barras = '27896090100105';
--
--   delete from manutencao.lixeira_coleta where cod_barras = '27896090100105';
-- commit;


-- ============================================================================
-- NOTA — por que isto pode voltar
--
-- A `database_coleta` e alimentada pelo n8n. Enquanto aquele EAN estiver na
-- lista de coleta, cada nova captura reinsere as linhas e a amplitude de
-- 1.887% reaparece. O DELETE limpa o historico; nao filtra o futuro.
--
-- Para resolver de forma permanente ha dois caminhos, e nenhum e este script:
--   (a) tirar o EAN da coleta no proprio n8n — corrige na origem; ou
--   (b) uma lista de EANs ignorados, aplicada nas views analiticas, para o
--       item sumir dos relatorios sem apagar dado nenhum.
-- O (b) e reversivel e nao perde historico, mas depende de aprovacao — nao
-- foi implementado.
-- ============================================================================
