import { config } from "../config.js";
import { qualificarComClaude, revalidarComClaude } from "./aiProviders/claude.js";
import { qualificarComGemini, revalidarComGemini } from "./aiProviders/gemini.js";
import { calcularScore } from "./scoring.js";

const PROVEDORES = {
  claude: { qualificar: qualificarComClaude, revalidar: revalidarComClaude },
  gemini: { qualificar: qualificarComGemini, revalidar: revalidarComGemini },
};

function ordemProvedores() {
  const primario = PROVEDORES[config.ai.primaryProvider] ? config.ai.primaryProvider : "claude";
  const secundario = primario === "claude" ? "gemini" : "claude";
  return [primario, secundario];
}

/**
 * Gera o próximo passo da conversa de qualificação.
 * Tenta o provedor principal (Claude por padrão); se falhar (erro de rede,
 * limite de taxa, chave ausente etc.), usa o Gemini como contingência —
 * assim o atendimento no WhatsApp não trava por causa de um único provedor.
 */
export async function proximoPassoQualificacao(lead, historico) {
  const [primario, secundario] = ordemProvedores();
  try {
    return await PROVEDORES[primario].qualificar(lead, historico);
  } catch (erroPrimario) {
    console.warn(`[IA] Provedor "${primario}" falhou, tentando "${secundario}":`, erroPrimario.message);
    try {
      return await PROVEDORES[secundario].qualificar(lead, historico);
    } catch (erroSecundario) {
      console.error("[IA] Ambos os provedores falharam:", erroSecundario.message);
      throw new Error("Não foi possível gerar resposta de qualificação (Claude e Gemini indisponíveis)");
    }
  }
}

/**
 * Quando a conversa é marcada como concluída, pede ao provedor secundário
 * para reclassificar a transcrição de forma independente ("double-check").
 * O resultado final é uma média ponderada do interesse e o valor mais
 * conservador de orçamento/urgência quando os provedores discordam.
 */
export async function fecharQualificacao(lead, historico, resultadoPrimario) {
  const [primario, secundario] = ordemProvedores();
  let segunda;
  try {
    segunda = await PROVEDORES[secundario].revalidar(lead, historico);
  } catch (erro) {
    console.warn(`[IA] Double-check com "${secundario}" falhou, usando apenas "${primario}":`, erro.message);
    segunda = null;
  }

  const orcamento = resultadoPrimario.orcamento ?? segunda?.orcamento ?? null;
  const urgencia = resultadoPrimario.urgencia ?? segunda?.urgencia ?? null;
  const interesse = segunda?.interesse != null
    ? Math.round((resultadoPrimario.interesse + segunda.interesse) / 2)
    : resultadoPrimario.interesse;

  const { score, temperatura } = calcularScore({ orcamento, urgencia, interesse });

  return {
    orcamento,
    urgencia,
    interesse,
    score,
    temperatura,
    auditoria: {
      primario: { provedor: primario, ...resultadoPrimario },
      secundario: segunda ? { provedor: secundario, ...segunda } : null,
    },
  };
}
