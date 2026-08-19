# Fluxo CRM — Backend

API em Node/Express que substitui os dados mockados do front-end por:

- **Persistência real em Postgres** (Prisma) — leads, mensagens e campanhas.
- **WhatsApp Cloud API (Meta)** — recebe mensagens via webhook e responde automaticamente.
- **Qualificação por IA com dois provedores**:
  - **Claude** (Anthropic) é o provedor principal da conversa.
  - **Gemini** (Google) entra como *fallback* automático se o Claude falhar, e também
    faz uma segunda leitura ("double-check") da transcrição antes de fechar o score
    final do lead — reduz o risco de um único modelo classificar errado.

## 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Preencha:

| Variável | Onde conseguir |
|---|---|
| `DATABASE_URL` | Local: sobe com `docker-compose up -d` (ver abaixo). Produção: variável gerada pelo plugin Postgres do Railway. |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `ANTHROPIC_MODEL` | Verifique o model string atual em [docs de modelos da Claude API](https://platform.claude.com/docs/en/about-claude/models/overview) — no momento em que este projeto foi montado, `claude-sonnet-5` |
| `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Verifique o nome atual em [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | [Meta for Developers](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) → crie um app "Business" → produto WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | Uma string qualquer que você mesmo inventa, usada só na etapa de verificação do webhook |
| `WHATSAPP_APP_SECRET` | App Meta → Configurações básicas → "Chave secreta do aplicativo" |
| `ADMIN_API_KEY` | Uma string qualquer — o front-end vai enviar no header `x-api-key` |
| `FRONTEND_URL` | A URL do front-end (Railway ou `http://localhost:5173` em dev). Restringe o CORS — sem ela, a API libera qualquer origem. |

## 2. Banco de dados local

```bash
docker-compose up -d          # sobe um Postgres local na porta 5432
npm install
```

Este projeto já vem com a migration inicial pronta em `prisma/migrations/`
(criada manualmente, já que não havia banco disponível para gerá-la
automaticamente). Antes de confiar nela em produção, **valide localmente**:

```bash
npm run db:migrate            # roda `prisma migrate deploy` — o mesmo comando do Railway
```

Se esse comando terminar sem erro, o schema está correto e o deploy no
Railway vai criar as tabelas do mesmo jeito. Se você preferir gerar as
migrations do zero (por exemplo, depois de alterar o `schema.prisma`), use
`npm run db:migrate:dev` em vez disso.

## 3. Rodar localmente

```bash
npm run dev
```

Servidor em `http://localhost:3000`. Teste: `curl http://localhost:3000/health`.

### Testar o webhook do WhatsApp localmente

A Meta precisa alcançar sua máquina publicamente. Use o [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

No painel Meta → WhatsApp → Configuration → Webhook:
- **Callback URL**: `https://SEU-SUBDOMINIO.ngrok.app/webhook/whatsapp`
- **Verify token**: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- Inscreva-se no campo `messages`.

## 4. Deploy no Railway

1. No projeto Railway (o mesmo do front-end ou um novo), clique em **New → Database → Add PostgreSQL**. O Railway injeta `DATABASE_URL` automaticamente nos serviços do mesmo projeto.
2. **New → GitHub Repo**, aponte para este backend (suba a pasta pro GitHub, igual foi feito com o front-end).
3. Em **Variables**, copie o conteúdo do `.env.example` preenchido — exceto `DATABASE_URL`, que já vem do plugin. Se o front-end ainda não tem domínio gerado, deixe `FRONTEND_URL` em branco por enquanto (CORS libera geral) e volte aqui pra preencher depois — variável alterada = redeploy automático.
4. O `railway.json` já configura:
   - build via Nixpacks (`npm install`, que roda `prisma generate` no `postinstall`)
   - start: `npm run db:migrate && npm run start` — aplica a migration (já incluída no repo) antes de subir o servidor.
5. Gere o domínio público em **Settings → Networking → Generate Domain** — é essa URL + `/webhook/whatsapp` que vai no painel da Meta, e é essa URL que vira `VITE_API_URL` no front-end.
6. Depois que o front-end também tiver domínio (ver README dele), volte em **Variables** deste serviço e preencha `FRONTEND_URL` com a URL do front-end — isso fecha o CORS só pra ela.

## 5. Conectar ao front-end (Fluxo CRM)

O front-end já consome esta API nativamente (`src/api.js`). Rotas usadas:

```
GET    /api/leads
GET    /api/leads/:id
POST   /api/leads
PATCH  /api/leads/:id
POST   /api/leads/:id/qualify
GET    /api/campaigns
POST   /api/campaigns
```

Todas exigem o header `x-api-key: <ADMIN_API_KEY>`.

## Como a qualificação por IA funciona

```
Lead manda mensagem no WhatsApp
        │
        ▼
POST /webhook/whatsapp  (Meta)
        │  valida assinatura HMAC
        ▼
salva mensagem no Postgres
        │
        ▼
avancarConversa(lead)
        │
        ├─► Claude gera a próxima pergunta (tool use → JSON estruturado:
        │    orçamento / urgência / interesse / pronto_para_encerrar)
        │
        │    se Claude falhar → tenta Gemini automaticamente
        │
        ▼
salva resposta da IA + envia via WhatsApp Cloud API
        │
        ▼
se pronto_para_encerrar:
        ├─► Gemini reclassifica a transcrição inteira (double-check)
        ├─► score final = média dos dois provedores
        └─► lead vira "qualificado" (quente/morno) ou "perdido" (frio)
```

## Estrutura

```
src/
├── server.js                     # bootstrap do Express
├── config.js                     # variáveis de ambiente centralizadas
├── db.js                         # cliente Prisma
├── middleware/apiKey.js          # autenticação simples por API key
├── routes/
│   ├── leads.js                  # CRUD de leads + trigger de qualificação
│   ├── whatsapp.js               # webhook (verificação + recebimento)
│   └── campaigns.js              # campanhas de disparo
└── services/
    ├── scoring.js                # cálculo de score/temperatura
    ├── whatsappService.js        # envio de mensagens + validação de assinatura
    ├── conversationFlow.js       # orquestra 1 turno de conversa (IA + WhatsApp + DB)
    ├── qualificationEngine.js    # escolhe provedor primário/fallback + double-check
    └── aiProviders/
        ├── claude.js
        └── gemini.js
prisma/
├── schema.prisma                 # modelos Lead, Mensagem, Campanha
└── migrations/                   # migration inicial (já pronta pro deploy)
```

## Próximos passos sugeridos

- **Fila de mensagens** (BullMQ + Redis) para não depender de o webhook responder na hora — hoje cada resposta chama a IA de forma síncrona antes do `sendStatus(200)`.
- **Templates aprovados da Meta** para disparos em massa (campanhas) — mensagens iniciadas pela empresa fora da janela de 24h exigem template pré-aprovado, diferente da conversa de qualificação (que responde dentro da janela).
- **Autenticação de usuários reais** (JWT/OAuth) no lugar da API key única, com um usuário por vendedor.
- **Rate limiting e logging estruturado** antes de ir pra produção com tráfego real.
