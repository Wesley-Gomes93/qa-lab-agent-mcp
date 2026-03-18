#!/usr/bin/env node
/**
 * QA Lab Slack Bot
 * Recebe @mentions no Slack, executa mcp-lab-agent e posta relatório.
 *
 * Config: qa-lab-agent.config.json (slack section)
 * Secrets: .env (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET)
 */
import { App } from "@slack/bolt";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAppMention } from "./handlers/app-mention.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

const token = process.env.SLACK_BOT_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;

if (!token || !signingSecret) {
  console.error("Configure SLACK_BOT_TOKEN e SLACK_SIGNING_SECRET no .env");
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
