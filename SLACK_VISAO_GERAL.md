# 📋 Visão Geral: Integração Slack + mcp-lab-agent

Documento único com **estrutura do projeto**, **arquitetura** e **configuração**.

---

## 1. Estrutura do Projeto (como ficará)

```
qa-lab-agent-mcp/                    # Projeto atual (já existe)
├── src/
│   ├── index.js                     # MCP server (Cursor)
│   ├── core/
│   └── cli/
├── package.json
├── dist/
└── ...

slack-qa-bot/                        # NOVO: backend Slack (ao lado ou dentro do repo)
├── package.json
├── .env.example
├── .env                             # (não versionado)
├── src/
│   ├── index.js                     # Entrada: Bolt app
│   ├── config/
│   │   └── index.js                 # Carrega .env + config
│   ├── handlers/
│   │   ├── mentions.js              # Trata @qa-bot
│   │   └── slash.js                 # Trata /qa
│   ├── workers/
│   │   └── qa-job.js                # Executa mcp-lab-agent
│   └── utils/
│       └── report.js                # Formata relatório para Slack
├── config/
│   └── channels.json               # Mapeamento canal → repo (opcional)
└── README.md
```

**Ou** tudo no mesmo repo:

```
qa-lab-agent-mcp/
├── src/                             # MCP + CLI (existente)
├── slack-bot/                       # NOVO: pasta do bot Slack
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── handlers/
│   │   └── workers/
│   └── .env.example
├── package.json                     # root: workspaces
└── ...
```

---

## 2. Arquitetura (visão geral)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           SLACK WORKSPACE                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │ #qa-frontend│  │ #qa-api     │  │ #geral      │                        │
│  │ (repo: fe)  │  │ (repo: api) │  │ (repo: main)│                        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                        │
│         │                 │                 │                              │
│         └─────────────────┴─────────────────┘                              │
│                           │                                                │
│                    @qa-bot analise...                                      │
└───────────────────────────┼───────────────────────────────────────────────┘
                            │
                            │ HTTPS (Event Subscriptions)
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     SLACK-BOT (seu backend Node.js)                        │
│                                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐   │
│  │ Bolt/Express│───▶│ Job Queue   │───▶│ Worker                      │   │
│  │ (recebe     │    │ (Bull/Redis)│    │ • Resolve repo do canal     │   │
│  │  eventos)   │    │             │    │ • Clona repo (se necessário) │   │
│  └─────────────┘    └─────────────┘    │ • Executa mcp-lab-agent     │   │
│         │                                │   (detect, auto, analyze)  │   │
│         │                                │ • Formata relatório         │   │
│         │  "Recebido!"                  │ • Posta no Slack            │   │
│         └───────────────────────────────┴─────────────────────────────┘   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                            │
                            │ spawn / exec
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     mcp-lab-agent (CLI)                                    │
│                                                                           │
│  npx mcp-lab-agent detect                                                 │
│  npx mcp-lab-agent auto "testes E2E login"                                │
│  npx mcp-lab-agent analyze                                                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                            │
                            │ cwd = clone do repo
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     REPOSITÓRIO DO PROJETO                                 │
│  /tmp/qa-run-xyz/  (ou dir persistente)                                   │
│  ├── src/                                                                 │
│  ├── tests/                                                               │
│  ├── package.json                                                         │
│  └── ...                                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fluxo de Dados (passo a passo)

```
1. Usuário: @qa-bot analise e crie testes para login
                │
2. Slack ──────▶ POST /slack/events (Event Subscription)
                │
3. Backend ────▶ Valida signature (SLACK_SIGNING_SECRET)
                │
4. Backend ────▶ Responde 200 (em < 3s) + post "Recebido!"
                │
5. Backend ────▶ Enfileira job { channel, ts, text, userId }
                │
6. Worker ─────▶ Processa job:
                │   • channel C789 → repo github.com/org/frontend
                │   • git clone (ou pull) em /tmp/run-abc
                │   • cd /tmp/run-abc
                │   • npx mcp-lab-agent auto "testes para login"
                │   • npx mcp-lab-agent analyze
                │   • Captura stdout
                │
7. Worker ─────▶ Formata relatório + post na thread (chat.postMessage)
                │
8. Usuário ────▶ Vê relatório no Slack
```

---

## 4. Configuração Completa

### 4.1 Slack App (api.slack.com/apps)

| Etapa | Onde | Valor/Ação |
|-------|------|------------|
| Criar App | Create New App → From scratch | Nome: `QA Lab Bot` |
| Bot token scopes | OAuth & Permissions | `app_mentions:read`, `chat:write`, `channels:history`, `channels:read`, `channels:join` |
| Event Subscriptions | Event Subscriptions | Enable: On |
| Request URL | Event Subscriptions | `https://seu-dominio.com/slack/events` |
| Bot events | Subscribe to bot events | `app_mention` |
| Slash Command (opcional) | Slash Commands | `/qa` → `https://seu-dominio.com/slack/commands` |
| Instalar | Install to Workspace | Copiar **Bot User OAuth Token** |
| Signing Secret | Basic Information | Copiar **Signing Secret** |

---

### 4.2 Backend (.env)

```env
# === SLACK ===
SLACK_BOT_TOKEN=xoxb-1234-5678-...
SLACK_SIGNING_SECRET=abc123def456...
SLACK_APP_TOKEN=xapp-...              # Opcional: Socket Mode (dev local)

# === PROJETO PADRÃO (quando canal não está mapeado) ===
DEFAULT_REPO_URL=https://github.com/sua-org/projeto.git
DEFAULT_REPO_BRANCH=main
CLONE_BASE_DIR=/tmp/qa-lab-runs        # Onde clonar repos

# === MAPEAMENTO CANAL → REPO (opcional) ===
# Formato: ID_DO_CANAL:URL_DO_REPO
# Obter ID: canal no Slack → View channel details
CHANNEL_REPO_MAP='{"C01234AB":"https://github.com/org/frontend.git","C05678CD":"https://github.com/org/api.git"}'

# === REDIS (para fila de jobs) ===
REDIS_URL=redis://localhost:6379
# Ou: REDIS_URL=redis://user:pass@host:6379

# === mcp-lab-agent ===
MCP_LAB_AGENT_CMD=npx
MCP_LAB_AGENT_ARGS=mcp-lab-agent
# Se usar install local:
# MCP_LAB_AGENT_CMD=node
# MCP_LAB_AGENT_ARGS=../dist/index.js

# === LLM (para mcp-lab-agent usar dentro dos jobs) ===
GROQ_API_KEY=...
# ou GEMINI_API_KEY=...
# ou OPENAI_API_KEY=...
```

---

### 4.3 Mapeamento Canal → Repo (opções)

**Opção A – Tudo no .env (um repo só):**
```env
DEFAULT_REPO_URL=https://github.com/org/app.git
```

**Opção B – JSON no .env:**
```env
CHANNEL_REPO_MAP='{"C789":"https://github.com/org/frontend.git"}'
```

**Opção C – Arquivo `config/channels.json`:**
```json
{
  "C789ABC123": {
    "repo": "https://github.com/org/frontend.git",
    "branch": "main"
  },
  "C456DEF456": {
    "repo": "https://github.com/org/api.git",
    "branch": "develop"
  }
}
```

**Opção D – Por nome do canal (fallback):**
```json
{
  "channelNames": {
    "#qa-frontend": "https://github.com/org/frontend.git",
    "#qa-api": "https://github.com/org/api.git"
  },
  "default": "https://github.com/org/main.git"
}
```

---

### 4.4 Checklist de Configuração

```
Slack:
[ ] App criada
[ ] Bot Token (xoxb-...) copiado
[ ] Signing Secret copiado
[ ] Event Subscriptions: URL configurada
[ ] Bot event: app_mention
[ ] App instalada no workspace

Backend:
[ ] .env com SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
[ ] .env com DEFAULT_REPO_URL ou CHANNEL_REPO_MAP
[ ] REDIS_URL (ou fila em memória para dev)
[ ] Deploy com HTTPS público

mcp-lab-agent:
[ ] Disponível (npm ou path local)
[ ] GROQ_API_KEY ou outro LLM no .env do worker

Repo:
[ ] Acessível (público ou token no git config)
```

---

## 5. Resumo em Uma Página

| Componente | Função |
|------------|--------|
| **Slack App** | Recebe mensagens, envia eventos para seu backend |
| **slack-bot** | Recebe eventos, enfileira, roda worker, posta relatório |
| **Worker** | Clona repo, executa mcp-lab-agent, formata saída |
| **mcp-lab-agent** | Detecta, gera testes, roda, analisa, aprende |
| **config** | Tokens no .env, canal→repo em .env ou JSON |

---

## 6. Deploy (visão geral)

```
Local (dev):          ngrok + Socket Mode (ou URL ngrok em Event Subscriptions)
Produção:             VPS/Railway/Render/Fly.io com HTTPS
Redis:                Redis Cloud, Upstash ou self-hosted
```

---

## 7. Config em estilo mcp.json (para empresa)

A config do Slack Bot segue o mesmo conceito do `mcp.json` do Cursor: **arquivo JSON declarativo**.

**Cursor (cada dev)** — `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent@latest"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Slack Bot (servidor)** — `qa-lab-agent.config.json`:
```json
{
  "slack": {
    "enabled": true,
    "defaultRepo": { "url": "https://github.com/empresa/repo.git", "branch": "main" },
    "channels": {
      "C01234": { "repo": "https://github.com/empresa/frontend.git", "branch": "main" }
    },
    "mcpLabAgent": { "command": "npx", "args": ["-y", "mcp-lab-agent@latest"] }
  }
}
```

**Secrets** → `.env` (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET) — não versionar.

Ver `docs/CONFIGURACAO_EMPRESA.md` para o passo a passo completo.

---

## 8. Documentos Relacionados

| Arquivo | Conteúdo |
|---------|----------|
| `README.md` | Projeto mcp-lab-agent |
| `COMANDOS_CHAT.md` | Comandos no Cursor |
| `docs/CONFIGURACAO_EMPRESA.md` | Config Cursor + Slack para empresa |
| `CONFIGURACAO_CORPORATIVA.md` | LLM em ambiente corporativo |
