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

## Configuração

Seguindo [Creating an app from app settings](https://docs.slack.dev/app-management/quickstart-app-settings):

### 1. Criar o app no Slack

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **App Name** e **Workspace** → **Create App**

### 2. Solicitar scopes (OAuth & Permissions)

1. **OAuth & Permissions** → **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope**
2. Adicione:
   - `app_mentions:read` — necessário para o evento `app_mention`
   - `chat:write` — enviar mensagens
   - `channels:read` — listar canais
   - `channels:history` — ler histórico (para análise)

### 3. Instalar e autorizar o app

1. **OAuth & Permissions** → **Install to Workspace** → **Allow**
2. Copie o **Bot User OAuth Token** (`xoxb-...`) em **OAuth Tokens**
3. No canal desejado, digite: `/invite @NomeDoBot` — o bot precisa estar no canal para receber menções

### 4. Configurar eventos (Event Subscriptions)

1. **Event Subscriptions** → **Enable Events** → ON
2. **Subscribe to bot events** → **Add Bot User Event** → `app_mention`
3. Se alterou scopes/eventos: **Install App** → **Reinstall to Workspace**

### 5. Escolher modo: Socket ou HTTP

**A) Socket Mode** (recomendado — PC corporativo, sem URL pública):

1. **Socket Mode** → **Enable Socket Mode** → ON
2. **Basic Information** → **App-Level Tokens** → **Generate** → scope: `connections:write`
3. Copie o token (`xapp-...`)

**B) HTTP** (ngrok):

1. **Event Subscriptions** → **Request URL**: `https://SEU_DOMINIO/slack/events`
2. **Basic Information** → **App Credentials** → **Signing Secret** (Show)

### 6. Configurar credenciais localmente

**Socket Mode** — em `~/.cursor/mcp.json` ou `.env`:

```json
{
  "qa-lab-agent": {
    "slack": {
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "useLocal": true
    }
  }
}
```

| Credencial   | Onde obter em api.slack.com |
|-------------|-----------------------------|
| `botToken`  | OAuth & Permissions → OAuth Tokens → Bot User OAuth Token |
| `appToken`  | Basic Information → App-Level Tokens (scope: connections:write) |

> Detalhes: [CREDENTIALS.md](./CREDENTIALS.md)

**HTTP** — para ngrok:

| Credencial      | Onde obter em api.slack.com |
|-----------------|-----------------------------|
| `botToken`      | OAuth & Permissions → OAuth Tokens → Bot User OAuth Token |
| `signingSecret` | Basic Information → App Credentials → Signing Secret |

**Via `.env`:** `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` (Socket) ou `SLACK_SIGNING_SECRET` (HTTP). O `.env` pode ficar em `slack-bot/` ou na pasta atual.

> **Importante:** Mantenha as credenciais em segredo. Use variáveis de ambiente ou `mcp.json` (fora do versionamento).

### 7. Configure o repositório

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
