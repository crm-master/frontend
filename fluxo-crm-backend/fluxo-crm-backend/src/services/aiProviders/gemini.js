import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { config } from "../../config.js";

const genAI = config.ai.googleApiKey ? new GoogleGenerativeAI(config.ai.googleApiKey) : null;

const SYSTEM_PROMPT = `Você é a assistente de qualificação de leads da Fluxo CRM, conversando por WhatsApp em português do Brasil.
Seu objetivo é, em no máximo 4 mensagens suas, descobrir:
1) qual problema o lead quer resolver,
2) se já existe orçamento definido (alto, médio ou baixo),
3) a urgência (imediata, em até 30 dias, ou sem previsão),
4) o nível de interesse geral (0 a 10).

Regras:
- Uma pergunta objetiva por mensagem, tom humano e cordial, nunca robótico.
- Nunca invente respostas do lead — baseie-se só no histórico da conversa.
- Quando já tiver informação suficiente (ou o lead claramente não tiver orçamento/urgência),
  marque pronto_para_encerrar = true e escreva uma mensagem de encerramento adequada.
- Responda SOMENTE no formato JSON definido pelo schema.`;

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    mensagem: { type: SchemaType.STRING },
    orcamento: { type: SchemaType.STRING, enum: ["alto", "medio", "baixo", "desconhecido"] },
    urgencia: { type: SchemaType.STRING, enum: ["imediata", "30dias", "sem_previsao", "desconhecido"] },
    interesse: { type: SchemaType.INTEGER },
    pronto_para_encerrar: { type: SchemaType.BOOLEAN },
  },
  required: ["mensagem", "orcamento", "urgencia", "interesse", "pronto_para_encerrar"],
};

function getModel() {
  if (!genAI) throw new Error("GOOGLE_API_KEY não configurada");
  return genAI.getGenerativeModel({
    model: config.ai.geminiModel,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });
}

export async function qualificarComGemini(lead, historico) {
  const model = getModel();

  const contents = historico.map((m) => ({
    role: m.de === "lead" ? "user" : "model",
    parts: [{ text: m.texto }],
  }));
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: `[Início da conversa com ${lead.nome}. Envie a mensagem de abertura.]` }] });
  }

  const result = await model.generateContent({ contents });
  const out = JSON.parse(result.response.text());

  return {
    mensagem: out.mensagem,
    orcamento: out.orcamento === "desconhecido" ? null : out.orcamento,
    urgencia: out.urgencia === "desconhecido" ? null : out.urgencia,
    interesse: out.interesse,
    prontoParaEncerrar: !!out.pronto_para_encerrar,
    provedor: "gemini",
  };
}

export async function revalidarComGemini(lead, historico) {
  const model = getModel();
  const transcricao = historico.map((m) => `${m.de === "lead" ? "Lead" : "Assistente"}: ${m.texto}`).join("\n");

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{ text: `Audite esta transcrição de qualificação de vendas e classifique orçamento, urgência e interesse (0-10) com base apenas no que foi dito:\n\n${transcricao}` }],
    }],
  });
  const out = JSON.parse(result.response.text());
  return {
    orcamento: out.orcamento === "desconhecido" ? null : out.orcamento,
    urgencia: out.urgencia === "desconhecido" ? null : out.urgencia,
    interesse: out.interesse,
    provedor: "gemini",
  };
}
