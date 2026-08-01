# Troubleshooting — QA Lab Slack Bot

## Bot não responde quando envio mensagem

### 1. Bot foi convidado para o canal?

**Muito comum.** O bot precisa estar no canal para receber menções.

- No canal: digite `/invite @NomeDoSeuBot`
- Ou mencione em DM: abra DM com o bot e teste `@Bot analise o projeto`

### 2. Configuração no Slack (api.slack.com)

Seguindo a [documentação oficial](https://docs.slack.dev/app-management/quickstart-app-settings):

#### Se usa **Socket Mode** (PC corporativo, sem ngrok):

1. **Socket Mode** → Enable Socket Mode → ON
2. **Basic Information** → App-Level Tokens → Generate → scope: `connections:write` → copie (`xapp-...`)
3. **Event Subscriptions** → Enable Events → Subscribe to bot events → `app_mention`
4. **OAuth & Permissions** → Bot Token Scopes: `app_mentions:read`, `chat:write`, `channels:read`, `channels:history`
5. **Install App** → **Reinstall to Workspace** (obrigatório após alterar scopes ou eventos)

#### Se usa **HTTP** (ngrok):

1. **Event Subscriptions** → Enable Events → Request URL: `https://SEU_NGROK.ngrok.io/slack/events`
2. Subscribe to bot events: `app_mention`
3. **Basic Information** → App Credentials → Signing Secret (Show)

### 3. Config correta no mcp.json

O `~/.config/mcp-lab-agent/mcp.json` precisa ter a seção `qa-lab-agent.slack`:

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

- `botToken` — OAuth & Permissions → OAuth Tokens → Bot User OAuth Token (começa com `xoxb-`)
- `appToken` — Basic Information → App-Level Tokens (scope `connections:write`, começa com `xapp-`) — só para Socket Mode
- `useLocal: true` — analisa o projeto local (pasta atual) em vez de clonar um repo

### 4. Bot identifica o projeto mas não vê os testes

**Causa comum:** O bot analisa a pasta de onde foi **iniciado**. Se você rodou `npx mcp-lab-agent slack-bot` de uma pasta que não é a raiz do projeto (ex.: home, ou outra pasta), ele não vai encontrar os testes.

**Solução:** Configure `workDir` no `mcp.json` com o **caminho completo** da pasta do projeto que contém os testes:

```json
{
  "qa-lab-agent": {
    "slack": {
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "useLocal": true,
      "workDir": "/caminho/completo/para/seu-projeto-com-testes"
    }
  }
}
```

Exemplo no Windows: `"workDir": "C:\\Users\\SeuUsuario\\Desktop\\e2e-test-automation"`  
Exemplo no macOS/Linux: `"workDir": "/Users/wesley/Desktop/e2e-test-automation"`

**Alternativa:** Inicie o bot **de dentro da pasta do projeto**:

```bash
cd /caminho/para/seu-projeto-com-testes
npx mcp-lab-agent slack-bot
```

**Se os testes estão em pasta não padrão** (ex.: `cypress/e2e`, `packages/app/tests`), crie `qa-lab-agent.config.json` na raiz do projeto:

```json
{
  "testDirs": ["e2e", "cypress", "tests"]
}
```

### 5. Rodar o diagnóstico

```bash
npm run slack-bot:check
```

Corrija qualquer item marcado com ❌.

### 6. Conferir se o bot está rodando

Ao subir com `npm start`, deve aparecer:

- Socket Mode: `QA Lab Slack Bot rodando em Socket Mode (sem URL pública necessária)`
- HTTP: `QA Lab Slack Bot rodando em http://localhost:3000`

Se der erro ao iniciar, leia a mensagem — geralmente indica token inválido ou faltando.

### 7. Firewall / proxy corporativo

Em redes corporativas, às vezes o WebSocket (Socket Mode) é bloqueado. Tente:

- Socket Mode primeiro (não precisa de URL pública)
- Se não funcionar, use ngrok em outra máquina e configure HTTP
