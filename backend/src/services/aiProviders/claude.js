import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.js";

const client = config.ai.anthropicApiKey ? new Anthropic({ apiKey: config.ai.anthropicApiKey }) : null;

const SYSTEM_PROMPT = `Você é a assistente de qualificação de leads da Fluxo CRM, conversando por WhatsApp em português do Brasil.
Seu objetivo é, em no máximo 4 mensagens suas, descobrir:
1) qual problema o lead quer resolver,
2) se já existe orçamento definido (alto, médio ou baixo),
3) a urgência (imediata, em até 30 dias, ou sem previsão),
4) o nível de interesse geral (0 a 10).

Regras:
- Uma pergunta objetiva por mensagem, tom humano e cordial, nunca robótico.
- Nunca invente respostas do lead — baseie-se só no histórico da conversa.
- Quando já tiver informação suficiente sobre os 4 pontos (ou o lead claramente não tiver orçamento/urgência),
  marque pronto_para_encerrar = true e escreva uma mensagem de encerramento adequada:
  se o lead parecer qualificado, diga que vai encaminhar para um consultor humano;
  se não parecer qualificado agora, agradeça e diga que o contato foi registrado.
- Se ainda faltar informação, pronto_para_encerrar = false e a mensagem deve ser a próxima pergunta.`;

const TOOL = {
  name: "responder_lead",
  description: "Registra a próxima mensagem a enviar ao lead e os dados de qualificação extraídos até agora.",
  input_schema: {
    type: "object",
    properties: {
      mensagem: { type: "string", description: "Texto a ser enviado ao lead via WhatsApp." },
      orcamento: { type: "string", enum: ["alto", "medio", "baixo", "desconhecido"] },
      urgencia: { type: "string", enum: ["imediata", "30dias", "sem_previsao", "desconhecido"] },
      interesse: { type: "integer", minimum: 0, maximum: 10 },
      pronto_para_encerrar: { type: "boolean" },
    },
    required: ["mensagem", "orcamento", "urgencia", "interesse", "pronto_para_encerrar"],
  },
};

/**
 * @param {{nome: string}} lead
 * @param {{de: "lead"|"ia"|"humano", texto: string}[]} historico
 * @returns {Promise<{mensagem:string, orcamento:string, urgencia:string, interesse:number, prontoParaEncerrar:boolean, provedor:"claude"}>}
 */
export async function qualificarComClaude(lead, historico) {
  if (!client) throw new Error("ANTHROPIC_API_KEY não configurada");

  const messages = historico.map((m) => ({
    role: m.de === "lead" ? "user" : "assistant",
    content: m.texto,
  }));
  if (messages.length === 0) {
    messages.push({ role: "user", content: `[Início da conversa com ${lead.nome}. Envie a mensagem de abertura.]` });
  }

  const response = await client.messages.create({
    model: config.ai.anthropicModel,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "responder_lead" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude não retornou o resultado estruturado esperado");

  const out = toolUse.input;
  return {
    mensagem: out.mensagem,
    orcamento: out.orcamento === "desconhecido" ? null : out.orcamento,
    urgencia: out.urgencia === "desconhecido" ? null : out.urgencia,
    interesse: out.interesse,
    prontoParaEncerrar: !!out.pronto_para_encerrar,
    provedor: "claude",
  };
}

/**
 * Revalida um score/qualificação já fechada, como segunda opinião.
 * Usado pelo qualificationEngine como "double-check" antes de fechar o lead.
 */
export async function revalidarComClaude(lead, historico) {
  if (!client) throw new Error("ANTHROPIC_API_KEY não configurada");

  const transcricao = historico.map((m) => `${m.de === "lead" ? "Lead" : "Assistente"}: ${m.texto}`).join("\n");

  const response = await client.messages.create({
    model: config.ai.anthropicModel,
    max_tokens: 300,
    system: "Você audita qualificações de leads de vendas a partir da transcrição de uma conversa de WhatsApp. Responda apenas com a ferramenta fornecida.",
    messages: [{ role: "user", content: `Transcrição:\n${transcricao}\n\nClassifique orçamento, urgência e interesse (0-10) com base apenas no que foi dito.` }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "responder_lead" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude não retornou o resultado estruturado esperado");
  const out = toolUse.input;
  return {
    orcamento: out.orcamento === "desconhecido" ? null : out.orcamento,
    urgencia: out.urgencia === "desconhecido" ? null : out.urgencia,
    interesse: out.interesse,
    provedor: "claude",
  };
}
