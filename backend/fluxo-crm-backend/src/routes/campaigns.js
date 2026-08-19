import { Router } from "express";
import { prisma } from "../db.js";

export const campaignsRouter = Router();

campaignsRouter.get("/", async (_req, res) => {
  const campanhas = await prisma.campanha.findMany({ orderBy: { criadoEm: "desc" } });
  res.json(campanhas);
});

campaignsRouter.post("/", async (req, res) => {
  const { nome, template, mensagem, status } = req.body;
  if (!nome || !mensagem) {
    return res.status(400).json({ erro: "Campos obrigatórios: nome, mensagem" });
  }
  const campanha = await prisma.campanha.create({
    data: { nome, template: template || "Personalizado", mensagem, status: status || "Ativa" },
  });
  res.status(201).json(campanha);
});

campaignsRouter.patch("/:id", async (req, res) => {
  const campanha = await prisma.campanha.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(campanha);
});
