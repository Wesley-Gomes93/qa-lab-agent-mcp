# Troubleshooting — QA Lab Slack Bot

## Bot não responde quando envio mensagem

### 1. Bot foi convidado para o canal?

**Muito comum.** O bot precisa estar no canal para receber menções.

- No canal: digite `/invite @NomeDoSeuBot`
- Ou mencione em DM: abra DM com o bot e teste `@Bot analise o projeto`

### 2. Configuração no Slack (api.slack.com)

#### Se usa **Socket Mode** (PC corporativo, sem ngrok):

1. **Socket Mode** → Enable
2. **App-Level Tokens** → Generate → scope: `connections:write` → copie (`xapp-...`)
3. **Event Subscriptions** → Subscribe to bot events → adicione: `app_mention`
4. **OAuth & Permissions** → Scopes do Bot: `app_mentions:read`, `chat:write`, `channels:history`, `channels:read`
5. **Install to Workspace** (ou Reinstall) se alterou scopes

#### Se usa **HTTP** (ngrok):

1. **Event Subscriptions** → Enable
2. Request URL: `https://SEU_NGROK.ngrok.io/slack/events`
3. Subscribe to bot events: `app_mention`
4. **Signing Secret** em Basic Information

### 3. Config correta no mcp.json

O `~/.cursor/mcp.json` precisa ter a seção `qa-lab-agent.slack`:

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

- `botToken` — OAuth & Permissions → Bot User OAuth Token (começa com `xoxb-`)
- `appToken` — Basic Information → App-Level Tokens (começa com `xapp-`) — só para Socket Mode
- `useLocal: true` — analisa o projeto local (pasta atual) em vez de clonar um repo

### 4. Rodar o diagnóstico

```bash
cd slack-bot
npm run check
```

Corrija qualquer item marcado com ❌.

### 5. Conferir se o bot está rodando

Ao subir com `npm start`, deve aparecer:

- Socket Mode: `QA Lab Slack Bot rodando em Socket Mode (sem URL pública necessária)`
- HTTP: `QA Lab Slack Bot rodando em http://localhost:3000`

Se der erro ao iniciar, leia a mensagem — geralmente indica token inválido ou faltando.

### 6. Firewall / proxy corporativo

Em redes corporativas, às vezes o WebSocket (Socket Mode) é bloqueado. Tente:

- Socket Mode primeiro (não precisa de URL pública)
- Se não funcionar, use ngrok em outra máquina e configure HTTP
