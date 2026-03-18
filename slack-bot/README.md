# QA Lab Slack Bot

Bot do Slack que integra com o **mcp-lab-agent**: análise de projeto, criação de testes E2E e relatórios via chat.

## Requisitos

- Node.js 18+
- mcp-lab-agent publicado no npm ou disponível via `npx`
- Slack App configurada
- Repositórios acessíveis (git clone)

## Configuração

### 1. Slack App (api.slack.com/apps)

1. Crie uma app → **From scratch**
2. **OAuth & Permissions** → Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
   - `channels:history`
   - `channels:read`
3. **Event Subscriptions** → Enable
   - Request URL: `https://SEU_DOMINIO/slack/events`
   - Subscribe to bot events: `app_mention`
4. **Install to Workspace** → copie o Bot User OAuth Token
5. **Basic Information** → copie o Signing Secret

### 2. Config do projeto

Edite **`qa-lab-agent.config.json`** na raiz do projeto:

```json
{
  "slack": {
    "enabled": true,
    "defaultRepo": {
      "url": "https://github.com/sua-empresa/projeto.git",
      "branch": "main"
    },
    "channels": {
      "C01234ABC": {
        "repo": "https://github.com/sua-empresa/frontend.git",
        "branch": "main",
        "name": "#qa-frontend"
      }
    },
    "mcpLabAgent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent@latest"]
    }
  }
}
```

Para obter o ID do canal: botão direito no canal → "View channel details" → Channel ID.

### 3. Secrets (.env)

```bash
cp .env.example .env
# Edite .env com:
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_SIGNING_SECRET=...
# GROQ_API_KEY=... (ou outro LLM)
```

## Uso

```bash
cd slack-bot
npm install
npm start
```

Para desenvolvimento local com ngrok:

```bash
ngrok http 3000
# Use a URL do ngrok em Event Subscriptions
```

## Comandos no Slack

Mencione o bot no canal:

```
@qa-bot analise o projeto
@qa-bot crie testes E2E para login
@qa-bot relatório completo
```

O bot responde na thread com o relatório do mcp-lab-agent.

## Estrutura

```
slack-bot/
├── src/
│   ├── index.js           # Entrada Bolt
│   ├── config.js          # Carrega qa-lab-agent.config.json
│   ├── handlers/
│   │   └── app-mention.js # Trata @qa-bot
│   ├── workers/
│   │   └── qa-job.js      # Clona repo, executa mcp-lab-agent
│   └── utils/
│       └── report.js      # Formata output para Slack
├── .env.example
├── package.json
└── README.md
```

## Documentação

- [SLACK_VISAO_GERAL.md](../SLACK_VISAO_GERAL.md) — visão geral da integração
- [docs/CONFIGURACAO_EMPRESA.md](../docs/CONFIGURACAO_EMPRESA.md) — config para empresa
