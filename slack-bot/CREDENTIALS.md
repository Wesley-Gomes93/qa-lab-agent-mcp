# Credenciais — QA Lab Slack Bot

Referência rápida de onde obter cada credencial em [api.slack.com/apps](https://api.slack.com/apps).

Baseado em [Creating an app from app settings](https://docs.slack.dev/app-management/quickstart-app-settings).

## Tabela de credenciais

| Credencial      | Chave no mcp.json | Chave no .env              | Onde obter em api.slack.com |
|-----------------|-------------------|---------------------------|-----------------------------|
| Bot User OAuth   | `botToken`        | `SLACK_BOT_TOKEN`         | OAuth & Permissions → OAuth Tokens → Bot User OAuth Token |
| App-Level Token | `appToken`        | `SLACK_APP_TOKEN`         | Basic Information → App-Level Tokens → Generate (scope: `connections:write`) |
| Signing Secret   | `signingSecret`   | `SLACK_SIGNING_SECRET`    | Basic Information → App Credentials → Signing Secret (Show) |

## Formato dos tokens

- **Bot Token:** começa com `xoxb-` (não use Client Secret nem User Token)
- **App Token:** começa com `xapp-` (só para Socket Mode)
- **Signing Secret:** string longa (HTTP mode)

## Segurança

Mantenha as credenciais em segredo. Use variáveis de ambiente ou `~/.cursor/mcp.json` fora do versionamento.
