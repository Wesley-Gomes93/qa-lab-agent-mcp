#!/usr/bin/env node
/**
 * QA Lab Slack Bot
 * Recebe @mentions no Slack, executa mcp-lab-agent e posta relatório.
 *
 * Config: ~/.cursor/mcp.json (qa-lab-agent.slack) ou .env
 */
import { App } from "@slack/bolt";
import { getSlackTokens } from "./config.js";
import { registerAppMention } from "./handlers/app-mention.js";

const { token, signingSecret } = getSlackTokens();

if (!token || !signingSecret) {
  console.error("Configure no ~/.cursor/mcp.json:\n  \"qa-lab-agent\": { \"slack\": { \"botToken\": \"xoxb-...\", \"signingSecret\": \"...\" } }\n\nOu use .env (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET)");
  process.exit(1);
}

const app = new App({
  token,
  signingSecret,
});

registerAppMention(app);

const port = process.env.PORT || 3000;
const server = await app.start(port);
console.log(`QA Lab Slack Bot rodando em http://localhost:${port}`);
console.log("Configure Event Subscriptions em api.slack.com com:");
console.log(`  Request URL: https://SEU_DOMINIO/slack/events`);
console.log("  Bot event: app_mention");
