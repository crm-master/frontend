import { prisma } from "../db.js";
import { proximoPassoQualificacao, fecharQualificacao } from "./qualificationEngine.js";
import { enviarMensagemWhatsApp } from "./whatsappService.js";

/**
 * Gera e persiste o próximo turno da qualificação de um lead:
 * 1) pergunta a IA (Claude, com fallback Gemini) o que responder,
 * 2) salva a mensagem da IA e envia via WhatsApp,
 * 3) se a IA sinalizar que a qualificação terminou, fecha o lead com
 *    score/temperatura (com double-check do segundo provedor).
 *
 * @param {string} leadId
 * @param {{enviarWhatsApp?: boolean}} opts  desliga o envio real em testes locais
 */
export async function avancarConversa(leadId, opts = {}) {
  const enviarWhatsApp = opts.enviarWhatsApp !== false;

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { mensagens: { orderBy: { criadoEm: "asc" } } },
  });

  const historico = lead.mensagens.map((m) => ({ de: m.de, texto: m.texto }));
  const passo = await proximoPassoQualificacao(lead, historico);

  const mensagemIA = await prisma.mensagem.create({
    data: { leadId: lead.id, de: "ia", texto: passo.mensagem, provedorIA: passo.provedor },
  });

  if (enviarWhatsApp) {
    try {
      await enviarMensagemWhatsApp(lead.telefone, passo.mensagem);
    } catch (erro) {
      console.error(`[WhatsApp] Falha ao enviar mensagem para ${lead.telefone}:`, erro.message);
    }
  }

  if (!passo.prontoParaEncerrar) {
    const atualizado = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        estagio: "qualificando",
        qualificando: true,
        orcamento: passo.orcamento ?? lead.orcamento,
        urgencia: passo.urgencia ?? lead.urgencia,
        interesse: passo.interesse ?? lead.interesse,
      },
    });
    return { lead: atualizado, mensagem: mensagemIA, encerrado: false };
  }

  const fechamento = await fecharQualificacao(
    lead,
    [...historico, { de: "ia", texto: passo.mensagem }],
    passo
  );

  const novoEstagio = fechamento.temperatura === "frio" ? "perdido" : "qualificado";

  const atualizado = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      estagio: novoEstagio,
      qualificando: false,
      orcamento: fechamento.orcamento,
      urgencia: fechamento.urgencia,
      interesse: fechamento.interesse,
      score: fechamento.score,
      temperatura: fechamento.temperatura,
    },
  });

  return { lead: atualizado, mensagem: mensagemIA, encerrado: true, auditoria: fechamento.auditoria };
}
