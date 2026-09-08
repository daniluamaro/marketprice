import { MessageCircle, PackagePlus } from 'lucide-react'
import { CabecalhoPagina } from '@/components/CabecalhoPagina'
import { Secao } from '@/components/ui/secao'
import { linkWhatsapp } from '@/lib/whatsapp'

/**
 * Cadastro de Produtos — um pedido, nao um formulario.
 *
 * A coleta e feita por um fluxo externo (n8n) que precisa ser configurado por
 * pessoa: incluir um EAN significa apontar a coleta para ele. Nao existe, e nao
 * deve existir, um botao que insira produto na base direto pelo dashboard — o
 * cliente escreveria no banco de fatos, que e somente leitura (§4.1).
 *
 * Por isso esta tela e deliberadamente uma so acao: levar a conversa para o
 * suporte, do mesmo jeito que o login faz com senha e cadastro (§7). Um
 * formulario aqui daria a impressao de que o pedido entra sozinho na fila.
 */
const MENSAGEM = linkWhatsapp(
  'Olá! Gostaria de solicitar o cadastro de produtos para coleta de preços no Market Price.',
)

export default function CadastroProdutos() {
  return (
    <div>
      {/* Sem a barra de filtros: esta tela nao le dado nenhum, e um filtro de
          periodo ou cidade aqui nao mudaria coisa alguma — controle que nao faz
          nada ensina o usuario a desconfiar dos que fazem. */}
      <CabecalhoPagina
        titulo="Cadastro de Produtos"
        contexto={['Solicitação via equipe de suporte']}
        comFiltros={false}
      />

      <Secao
        eyebrow="Solicitação"
        titulo="Inclua novos produtos na sua coleta"
        descricao="Cada produto acompanhado é identificado pelo código de barras (EAN). Ao solicitar a inclusão, informe os EANs ou os nomes dos itens — a equipe configura a coleta e eles passam a aparecer nos relatórios nas próximas capturas."
      >
        <div className="flex flex-col items-center px-4 py-10 text-center sm:px-8 sm:py-14">
          <span
            className="flex size-14 items-center justify-center rounded-panel border border-gold/25 bg-gold/8"
            aria-hidden
          >
            <PackagePlus className="size-6 text-gold-bright" />
          </span>

          {/* O texto pedido, em destaque: e a unica mensagem da tela e precisa
              ser lido antes do botao, nao depois dele. */}
          <p className="mt-6 max-w-3xl font-display text-[19px] font-extrabold leading-snug tracking-[-0.2px] text-ink sm:text-[22px]">
            Faça solicitação de cadastro de produtos para coleta de dados de preços
            diretamente com a equipe de suporte
          </p>

          <a
            href={MENSAGEM}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-card bg-gold px-5 text-[14px] font-semibold text-[#0A0D14] transition-colors duration-150 hover:bg-gold-bright focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2"
          >
            <MessageCircle className="size-4" aria-hidden />
            Solicitar Cadastro
          </a>

          <p className="mt-4 text-[12px] text-ink-3">
            Abre uma conversa no WhatsApp com o suporte.
          </p>
        </div>
      </Secao>
    </div>
  )
}
