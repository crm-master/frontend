// Mesma lógica de pontuação usada no protótipo do front-end, agora como
// fonte única de verdade no backend. A IA preenche orcamento/urgencia/interesse
// ao longo da conversa; esta função só transforma isso em score + temperatura.

const PESOS_ORCAMENTO = { alto: 40, medio: 22, baixo: 6 };
const PESOS_URGENCIA = { imediata: 35, "30dias": 20, sem_previsao: 5 };

export function calcularScore({ orcamento, urgencia, interesse }) {
  const pOrcamento = PESOS_ORCAMENTO[orcamento] ?? 10;
  const pUrgencia = PESOS_URGENCIA[urgencia] ?? 10;
  const pInteresse = (interesse ?? 5) * 2.5;

  const total = Math.min(100, Math.round(pOrcamento + pUrgencia + pInteresse));
  const temperatura = total >= 65 ? "quente" : total >= 38 ? "morno" : "frio";
  return { score: total, temperatura };
}
