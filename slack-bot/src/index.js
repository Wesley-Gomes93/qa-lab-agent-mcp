#!/usr/bin/env node
/**
 * QA Lab Slack Bot
 * Recebe @mentions no Slack, executa mcp-lab-agent e posta relatório.
 *
 * Config: ~/.cursor/mcp.json (qa-lab-agent.slack) ou .env
 *
 * Dois modos:
 * 1) Socket Mode (recomendado para PC corporativo): botToken + appToken (slack_app_token)
 *    Não precisa de URL pública. Funciona atrás de firewall.
 * 2) HTTP (Event Subscriptions): botToken + signingSecret
 *    Precisa de URL pública (ngrok) em api.slack.com.
 */
import { App } from "@slack/bolt";
import { getSlackTokens } from "./config.js";
import { registerAppMention } from "./handlers/app-mention.js";

const { token, signingSecret, appToken } = getSlackTokens();

const useSocketMode = !!(appToken && appToken.startsWith("xapp-"));

if (!token || !token.startsWith("xoxb-")) {
  console.error(
    "Configure botToken (xoxb-...) no ~/.cursor/mcp.json ou .env (SLACK_BOT_TOKEN).\n" +
    "Onde: api.slack.com → sua app → OAuth & Permissions → Bot User OAuth Token"
  );
  process.exit(1);
}

if (useSocketMode) {
  // Socket Mode: funciona sem URL pública (ideal para PC corporativo)
  if (!appToken.startsWith("xapp-")) {
    console.error("appToken (slack_app_token) deve começar com 'xapp-' para Socket Mode.");
    process.exit(1);
  }
} else if (!signingSecret) {
  console.error(
    "Modo HTTP: configure signingSecret no ~/.cursor/mcp.json ou .env (SLACK_SIGNING_SECRET).\n" +
    "Modo Socket: adicione appToken (xapp-...) para funcionar sem URL pública."
  );
  process.exit(1);
}

const appOptions = {
  token,
  ...(useSocketMode
    ? { socketMode: true, appToken }
    : { signingSecret }),
};

const app = new App(appOptions);
registerAppMention(app);

if (useSocketMode) {
  await app.start();
  console.log("QA Lab Slack Bot rodando em Socket Mode (sem URL pública necessária)");
  console.log("Mencione o bot em um canal para usar.");
} else {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`QA Lab Slack Bot rodando em http://localhost:${port}`);
  console.log("Configure Event Subscriptions em api.slack.com:");
  console.log(`  Request URL: https://SEU_DOMINIO/slack/events`);
  console.log("  Bot event: app_mention");
}
