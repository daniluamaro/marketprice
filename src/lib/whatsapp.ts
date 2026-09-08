/**
 * Canal de suporte (§7): nao ha servidor de e-mail no produto, entao tudo o que
 * depende de uma pessoa — recuperar senha, pedir cadastro, solicitar produtos —
 * sai por aqui.
 *
 * O numero mora NESTE arquivo e em nenhum outro. Quando ele mudar, muda em um
 * lugar so; espalhado pelas telas, a primeira troca deixaria alguma para tras.
 */
const WHATSAPP = '5573998417554'

/** Monta o link do WhatsApp com a mensagem ja escrita para o usuario. */
export function linkWhatsapp(texto: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`
}
