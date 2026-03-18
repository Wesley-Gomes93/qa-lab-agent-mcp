# ⚡ Configuração Fácil — Slack Bot

**3 coisas para configurar:**

---

## 1. Bot no Slack (uma vez)

| Passo | Onde | O que fazer |
|-------|------|-------------|
| Criar app | [api.slack.com/apps](https://api.slack.com/apps) | Create → From scratch |
| Scopes | OAuth & Permissions | `app_mentions:read`, `chat:write`, `channels:history`, `channels:read` |
| Eventos | Event Subscriptions | URL: `https://SEU_DOMINIO/slack/events`, event: `app_mention` |
| Instalar | Install to Workspace | Copiar **Bot Token** e **Signing Secret** |

---

## 2. slack-bot/.env (2 variáveis)

```bash
cd slack-bot
cp .env.example .env
```

Edite `.env`:

```
SLACK_BOT_TOKEN=xoxb-seu-token
SLACK_SIGNING_SECRET=seu-secret
```

---

## 3. Repositório (1 opção)

**Opção A** — No `qa-lab-agent.config.json`:

```json
{
  "slack": {
    "repo": "https://github.com/sua-empresa/projeto.git",
    "branch": "main"
  }
}
```

**Opção B** — No `slack-bot/.env`:

```
REPO_URL=https://github.com/sua-empresa/projeto.git
REPO_BRANCH=main
```

---

## Rodar

```bash
cd slack-bot
npm run setup   # valida config
npm start
```

---

## Resumo

| O que | Onde |
|-------|------|
| Token + Secret | `slack-bot/.env` |
| Repo | `qa-lab-agent.config.json` ou `REPO_URL` no .env |

Sem mapeamento de canais — um repo para todos. Para LLM (criar testes): adicione `GROQ_API_KEY` no `.env`.
