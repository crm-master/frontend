-- CreateEnum
CREATE TYPE "Estagio" AS ENUM ('novo', 'qualificando', 'qualificado', 'negociacao', 'vendido', 'perdido');

-- CreateEnum
CREATE TYPE "Temperatura" AS ENUM ('frio', 'morno', 'quente');

-- CreateEnum
CREATE TYPE "RemetenteMensagem" AS ENUM ('lead', 'ia', 'humano');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT,
    "telefone" TEXT NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT 'Site',
    "estagio" "Estagio" NOT NULL DEFAULT 'novo',
    "valor" INTEGER NOT NULL DEFAULT 0,
    "orcamento" TEXT,
    "urgencia" TEXT,
    "interesse" INTEGER,
    "score" INTEGER,
    "temperatura" "Temperatura",
    "qualificando" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "de" "RemetenteMensagem" NOT NULL,
    "texto" TEXT NOT NULL,
    "provedorIA" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campanha" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "respostas" INTEGER NOT NULL DEFAULT 0,
    "conversoes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Ativa',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campanha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_telefone_key" ON "Lead"("telefone");

-- CreateIndex
CREATE INDEX "Lead_estagio_idx" ON "Lead"("estagio");

-- CreateIndex
CREATE INDEX "Lead_temperatura_idx" ON "Lead"("temperatura");

-- CreateIndex
CREATE INDEX "Mensagem_leadId_idx" ON "Mensagem"("leadId");

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
