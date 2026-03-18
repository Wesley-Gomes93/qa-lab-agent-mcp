# QA Lab Slack Bot

Bot Slack que analisa projetos e gera testes via **mcp-lab-agent**.

**Funciona em qualquer ambiente** — pessoal, corporativo, com ou sem firewall. Configure uma vez e rode em qualquer máquina.

| Ambiente        | Modo recomendado | URL pública?     |
|-----------------|------------------|------------------|
| PC corporativo  | Socket Mode      | Não precisa      |
| PC pessoal      | Socket ou HTTP   | Só se usar HTTP  |
| CI / servidor   | Socket ou HTTP   | Conforme rede    |

## Rodar sem clonar o projeto

```bash
npx mcp-lab-agent slack-bot
```

Não precisa baixar o repo — o comando instala e executa o bot. Configure `~/.cursor/mcp.json` (ver seção abaixo).

## Configuração (3 passos)

### 1. Crie o bot no Slack

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **OAuth & Permissions** → Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `channels:read`
3. **Install to Workspace** → copie o **Bot User OAuth Token** (`xoxb-...`)

**Para PC corporativo (sem URL pública):**
- **Socket Mode** → Enable
- **App-Level Tokens** → Generate → scope: `connections:write` → copie (`xapp-...`)
- **Event Subscriptions** → Subscribe to bot events → adicione `app_mention`

**Para ambiente com URL pública (ngrok):**
- **Event Subscriptions** → Enable → URL: `https://SEU_DOMINIO/slack/events` → event: `app_mention`
- **Basic Information** → Signing Secret

### 2. Configure tokens

**Socket Mode (recomendado para PC da empresa — funciona atrás de firewall):**

No `~/.cursor/mcp.json`:

```json
{
  "qa-lab-agent": {
    "slack": {
      "botToken": "xoxb-seu-bot-token",
      "appToken": "xapp-seu-app-token",
      "useLocal": true
    }
  }
}
```

Também aceita: `slack_app_token` em vez de `appToken`.

**HTTP (ngrok):**

```json
{
  "qa-lab-agent": {
    "slack": {
      "botToken": "xoxb-seu-token",
      "signingSecret": "seu-secret"
    }
  }
}
```

**Via `.env`:** `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` (Socket) ou `SLACK_SIGNING_SECRET` (HTTP). O `.env` pode ficar em `slack-bot/` ou na pasta atual (cwd) — funciona em ambos.

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

**Bot não responde?** Veja [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — em geral: `/invite @NomeDoBot` no canal e conferir **Subscribe to bot events** → `app_mention`.
