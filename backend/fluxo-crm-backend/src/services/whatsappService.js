import crypto from "node:crypto";
import { config } from "../config.js";

const { token, phoneNumberId, apiVersion, appSecret } = config.whatsapp;

/**
 * Envia uma mensagem de texto simples via WhatsApp Cloud API (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export async function enviarMensagemWhatsApp(paraTelefone, texto) {
  if (!token || !phoneNumberId) {
    throw new Error("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configurados");
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizarTelefone(paraTelefone),
      type: "text",
      text: { body: texto, preview_url: false },
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar mensagem WhatsApp (${res.status}): ${detalhe}`);
  }
  return res.json();
}

// Meta manda o telefone sem "+" e sem espaços; normalizamos os dois formatos.
export function normalizarTelefone(telefone) {
  return telefone.replace(/[^\d]/g, "");
}

/**
 * Valida a assinatura HMAC do webhook (header x-hub-signature-256), exigida
 * pela Meta pra confirmar que a requisição realmente veio do WhatsApp.
 * Precisa do rawBody da requisição — ver server.js.
 */
export function validarAssinaturaWebhook(rawBody, assinaturaHeader) {
  if (!appSecret) return true; // sem segredo configurado, pula validação (dev local)
  if (!assinaturaHeader) return false;

  const esperado = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(assinaturaHeader);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Extrai a primeira mensagem de texto recebida de um payload de webhook da Meta.
 * Retorna null se o payload não for uma mensagem de texto de usuário
 * (ex.: status de entrega, mensagem de mídia, etc.).
 */
export function extrairMensagemRecebida(payload) {
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== "text") return null;

    const contato = value.contacts?.[0];
    return {
      telefone: msg.from,
      nome: contato?.profile?.name || "Novo contato",
      texto: msg.text.body,
      whatsappMessageId: msg.id,
    };
  } catch {
    return null;
  }
}
