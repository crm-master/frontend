# Fluxo CRM

Front-end do CRM — captura de leads, qualificação real via WhatsApp/IA,
Kanban de funil de vendas e ferramentas de marketing. Consome a API do
[fluxo-crm-backend](../fluxo-crm-backend) (leads e conversas ficam no Postgres,
a qualificação roda com Claude + Gemini, as mensagens saem pelo WhatsApp de verdade).

## Rodar localmente

Primeiro suba o backend (veja o README dele). Depois:

```bash
cp .env.example .env    # aponte VITE_API_URL/VITE_API_KEY pro backend
npm install
npm run dev
```

Abra http://localhost:5173

Sem o backend no ar, a tela mostra um aviso de "Backend offline" no lugar de
travar — dá pra navegar pela interface mesmo assim, só não carrega dados reais.

## Deploy no Railway

### Opção A — via GitHub (recomendado)

1. Crie um repositório no GitHub e suba esta pasta:
   ```bash
   git init
   git add .
   git commit -m "Fluxo CRM inicial"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/fluxo-crm.git
   git push -u origin main
   ```
2. No [Railway](https://railway.app), clique em **New Project** → **Deploy from GitHub repo**.
3. Selecione o repositório `fluxo-crm`.
4. Em **Variables**, adicione `VITE_API_URL` (a URL pública do backend no Railway)
   e `VITE_API_KEY` (o mesmo `ADMIN_API_KEY` configurado no backend) — o Vite
   embute essas variáveis no momento do build, então **precisam existir antes do deploy**.
5. O Railway detecta o Node.js automaticamente (Nixpacks) e usa o `railway.json`
   deste projeto, que já define:
   - build: `npm run build`
   - start: `npm run start` (serve o build de produção na porta que o Railway define via `$PORT`)
6. Depois do primeiro deploy, vá em **Settings → Networking → Generate Domain**
   para gerar a URL pública.

### Opção B — via Railway CLI (sem GitHub)

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

## Estrutura

```
fluxo-crm/
├── src/
│   ├── App.jsx        # componente principal (dashboard, kanban, whatsapp, marketing)
│   ├── api.js          # cliente HTTP da API do backend
│   ├── main.jsx        # ponto de entrada React
│   └── index.css       # Tailwind
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── .env.example
└── railway.json        # configuração de build/start do Railway
```

## Como os dados fluem agora

- Ao abrir, busca `GET /api/leads` e faz polling a cada 6s (o webhook do
  WhatsApp atualiza o banco em segundo plano, então o front-end precisa
  reconsultar pra refletir isso).
- Arrastar um card no Kanban chama `PATCH /api/leads/:id` (com atualização
  otimista — se a chamada falhar, o card volta pro lugar).
- O botão "Iniciar qualificação automática" chama `POST /api/leads/:id/qualify`,
  que envia a mensagem de abertura real pelo WhatsApp. As respostas seguintes
  do lead chegam pelo webhook do backend — a tela de conversa faz polling a
  cada 3.5s enquanto está aberta pra mostrar isso quase em tempo real.
- O formulário de captura em Marketing chama `POST /api/leads` de verdade.

## Próximos passos técnicos

- Trocar o polling por WebSocket/Server-Sent Events pra atualização instantânea.
- Autenticação de usuários reais no lugar da API key única.
- Editor de campanhas com templates aprovados pela Meta para disparo em massa.
