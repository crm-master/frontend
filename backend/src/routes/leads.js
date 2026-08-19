import { Router } from "express";
import { prisma } from "../db.js";
import { normalizarTelefone } from "../services/whatsappService.js";
import { avancarConversa } from "../services/conversationFlow.js";

export const leadsRouter = Router();

const ESTAGIOS_VALIDOS = ["novo", "qualificando", "qualificado", "negociacao", "vendido", "perdido"];

// GET /api/leads?estagio=qualificado
leadsRouter.get("/", async (req, res) => {
  const { estagio } = req.query;
  const leads = await prisma.lead.findMany({
    where: estagio ? { estagio } : undefined,
    orderBy: { criadoEm: "desc" },
  });
  res.json(leads);
});

// GET /api/leads/:id  (com histórico de mensagens, para o painel de WhatsApp)
leadsRouter.get("/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: { mensagens: { orderBy: { criadoEm: "asc" } } },
  });
  if (!lead) return res.status(404).json({ erro: "Lead não encontrado" });
  res.json(lead);
});

// POST /api/leads  — usado pelo formulário de captura de marketing
leadsRouter.post("/", async (req, res) => {
  const { nome, empresa, telefone, fonte, valor } = req.body;
  if (!nome || !telefone) {
    return res.status(400).json({ erro: "Campos obrigatórios: nome, telefone" });
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        nome,
        empresa: empresa || null,
        telefone: normalizarTelefone(telefone),
        fonte: fonte || "Site",
        valor: valor ?? 0,
      },
    });
    res.status(201).json(lead);
  } catch (erro) {
    if (erro.code === "P2002") {
      return res.status(409).json({ erro: "Já existe um lead com esse telefone" });
    }
    throw erro;
  }
});

// PATCH /api/leads/:id — mover no kanban, editar campos
leadsRouter.patch("/:id", async (req, res) => {
  const { estagio, ...resto } = req.body;
  if (estagio && !ESTAGIOS_VALIDOS.includes(estagio)) {
    return res.status(400).json({ erro: `estagio inválido. Use um de: ${ESTAGIOS_VALIDOS.join(", ")}` });
  }
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: { ...resto, ...(estagio ? { estagio } : {}) },
  });
  res.json(lead);
});

// POST /api/leads/:id/qualify — dispara (ou continua) a qualificação por IA
// Chamado pelo botão "Iniciar qualificação automática" do front-end.
leadsRouter.post("/:id/qualify", async (req, res) => {
  try {
    const resultado = await avancarConversa(req.params.id);
    res.json(resultado);
  } catch (erro) {
    console.error("[qualify] erro:", erro);
    res.status(500).json({ erro: erro.message });
  }
});
