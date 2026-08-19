import express from "express";
import cors from "cors";
import { config, assertConfigured } from "./config.js";
import { requireApiKey } from "./middleware/apiKey.js";
import { leadsRouter } from "./routes/leads.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { campaignsRouter } from "./routes/campaigns.js";

assertConfigured();

const app = express();

// CORS restrito às origens em FRONTEND_URL (ver config.js). Requisições sem
// header Origin (o webhook da Meta, curl, apps mobile) não passam por esse
// checkall — CORS só existe pra proteger chamadas feitas pelo navegador.
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.cors.allowedOrigins.length === 0) return callback(null, true); // sem FRONTEND_URL definida, libera geral (dev)
    if (config.cors.allowedOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
    callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
};

app.use(cors(corsOptions));

// Guarda o corpo bruto da requisição (necessário pra validar a assinatura
// HMAC do webhook da Meta) antes do express.json() consumir o stream.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Webhook do WhatsApp é público (autenticado por verify token + assinatura HMAC,
// não pelo x-api-key admin).
app.use("/webhook/whatsapp", whatsappRouter);

// Rotas administrativas usadas pelo front-end do CRM.
app.use("/api/leads", requireApiKey, leadsRouter);
app.use("/api/campaigns", requireApiKey, campaignsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Fluxo CRM backend rodando na porta ${config.port}`);
});
