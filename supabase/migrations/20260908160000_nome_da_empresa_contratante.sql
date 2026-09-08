-- =============================================================================
-- Separa "quem e a empresa" de "quem e a pessoa"
--
-- Ate aqui `profiles.nome_contratante` acumulava os dois papeis, e a interface
-- o exibia como empresa (no chip lateral, ao lado do CNPJ) enquanto o cadastro
-- vinha sendo preenchido com o nome da PESSOA. O resultado era o chip do
-- contratante mostrando um nome de gente ao lado de um CNPJ.
--
-- A partir daqui:
--   nome_empresa      -> a empresa dona do CNPJ  (chip lateral, contexto das telas)
--   nome_contratante  -> a pessoa que usa o acesso (topo, ao lado do e-mail)
--
-- Nulavel de proposito: os acessos ja existentes nao tem o campo, e recusar
-- null aqui quebraria o login deles antes do preenchimento. A obrigatoriedade
-- fica no formulario, onde da para orientar quem preenche.
-- =============================================================================

alter table public.profiles
  add column if not exists nome_empresa text;

comment on column public.profiles.nome_empresa is
  'Empresa dona do CNPJ contratante. Diferente de nome_contratante, que e a pessoa do acesso.';

-- Preenche o que ja da para saber: a tabela de fatos ja carrega o nome da
-- empresa por CNPJ, entao os acessos existentes nao precisam ser digitados de
-- novo. Somente leitura sobre database_coleta (§4.1).
update public.profiles p
set    nome_empresa = f.nome
from (
  select distinct on (("CNPJ_contratante")::bigint::text)
         ("CNPJ_contratante")::bigint::text as cnpj,
         nome_contratante                   as nome
  from   public.database_coleta
  where  "CNPJ_contratante" is not null
    and  nome_contratante is not null
) f
where p.cnpj_contratante = f.cnpj
  and p.nome_empresa is null;
