import { Router } from "express";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { validarAssinaturaWebhook, extrairMensagemRecebida, normalizarTelefone } from "../services/whatsappService.js";
import { avancarConversa } from "../services/conversationFlow.js";

export const whatsappRouter = Router();

// Passo 1 do setup do webhook na Meta: verificação via GET.
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started
whatsappRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Passo 2: a Meta faz POST aqui a cada mensagem recebida no número conectado.
whatsappRouter.post("/", async (req, res) => {
  // responde 200 imediatamente — a Meta reenvia o webhook se demorar/der erro,
  // e o processamento (IA + envio de resposta) pode levar alguns segundos.
  res.sendStatus(200);

  const assinatura = req.header("x-hub-signature-256");
  if (!validarAssinaturaWebhook(req.rawBody, assinatura)) {
    console.warn("[webhook] Assinatura inválida — ignorando payload");
    return;
  }

  const recebida = extrairMensagemRecebida(req.body);
  if (!recebida) return; // status de entrega, mídia não suportada, etc.

  try {
    const telefone = normalizarTelefone(recebida.telefone);
    let lead = await prisma.lead.findUnique({ where: { telefone } });

    if (!lead) {
      lead = await prisma.lead.create({
        data: { nome: recebida.nome, telefone, fonte: "WhatsApp orgânico" },
      });
    }

    await prisma.mensagem.create({
      data: { leadId: lead.id, de: "lead", texto: recebida.texto },
    });

    // Só segue com a IA se o lead ainda está em qualificação (ou é novo).
    // Depois de qualificado/negociação, a conversa passa a ser humana.
    if (["novo", "qualificando"].includes(lead.estagio)) {
      await avancarConversa(lead.id);
    }
  } catch (erro) {
    console.error("[webhook] erro ao processar mensagem recebida:", erro);
  }
});
