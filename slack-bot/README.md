# QA Lab Slack Bot

Bot Slack que analisa projetos e gera testes via **mcp-lab-agent**.

## Configuração (3 passos)

### 1. Crie o bot no Slack

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **OAuth & Permissions** → Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `channels:read`
3. **Event Subscriptions** → Enable → URL: `https://SEU_DOMINIO/slack/events` → event: `app_mention`
4. **Install to Workspace** → copie o token (`xoxb-...`)
5. **Basic Information** → copie o **Signing Secret**

### 2. Configure o .env

```bash
cd slack-bot
cp .env.example .env
```

Edite `.env` e preencha:

```
SLACK_BOT_TOKEN=xoxb-seu-token
SLACK_SIGNING_SECRET=seu-secret
```

### 3. Configure o repositório

**Opção A** — No `qa-lab-agent.config.json` (raiz do projeto):

```json
{
  "slack": {
    "repo": "https://github.com/sua-empresa/projeto.git",
    "branch": "main"
  }
}
```

**Opção B** — No `.env`:

```
REPO_URL=https://github.com/sua-empresa/projeto.git
REPO_BRANCH=main
```

---

## Rodar

```bash
npm start
```

Local com ngrok: `ngrok http 3000` e use a URL em Event Subscriptions.

---

## Uso no Slack

```
@QA Lab Bot analise o projeto
@QA Lab Bot crie testes para login
```
