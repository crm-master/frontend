import "dotenv/config";

function required(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  adminApiKey: required("ADMIN_API_KEY", "troque-esta-chave"),

  // Origens que podem chamar a API pelo navegador (o front-end no Railway,
  // e opcionalmente localhost em dev). Aceita uma ou mais URLs separadas por
  // vírgula em FRONTEND_URL, ex: "https://fluxo-crm.up.railway.app,http://localhost:5173"
  cors: {
    allowedOrigins: (process.env.FRONTEND_URL || "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
  },

  whatsapp: {
    token: required("WHATSAPP_TOKEN"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
    appSecret: required("WHATSAPP_APP_SECRET"),
    apiVersion: "v20.0",
  },

  ai: {
    primaryProvider: (process.env.AI_PRIMARY_PROVIDER || "claude").toLowerCase(),
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    anthropicModel: required("ANTHROPIC_MODEL", "claude-sonnet-5"),
    googleApiKey: required("GOOGLE_API_KEY"),
    geminiModel: required("GEMINI_MODEL", "gemini-flash-latest"),
  },
};

export function assertConfigured() {
  const missing = [];
  if (!config.ai.anthropicApiKey && !config.ai.googleApiKey) {
    missing.push("ANTHROPIC_API_KEY ou GOOGLE_API_KEY (pelo menos um provedor de IA)");
  }
  if (missing.length) {
    console.warn(
      `[config] Aviso: variáveis não configuradas — ${missing.join(", ")}. ` +
      "A qualificação por IA vai falhar até que sejam definidas."
    );
  }
  if (!config.whatsapp.token || !config.whatsapp.phoneNumberId) {
    console.warn(
      "[config] Aviso: credenciais do WhatsApp Cloud API ausentes — o envio real de mensagens vai falhar " +
      "(a API continua funcionando para testes internos via /api/leads/:id/qualify)."
    );
  }
  if (config.cors.allowedOrigins.length === 0) {
    console.warn(
      "[config] Aviso: FRONTEND_URL não configurada — CORS está liberando qualquer origem. " +
      "Defina FRONTEND_URL com a URL do front-end antes de ir para produção."
    );
  }
}
