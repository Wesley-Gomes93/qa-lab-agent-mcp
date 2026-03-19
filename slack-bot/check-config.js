#!/usr/bin/env node
/**
 * Verifica se a config do Slack está correta.
 * Rode: node check-config.js
 */
import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// check-config.js fica em slack-bot/, então __dirname já é a pasta slack-bot
const SLACK_BOT_DIR = __dirname;
// Carrega .env na mesma ordem do config.js (QA_LAB_ENV override, cwd, slack-bot)
const envPaths = [
  process.env.QA_LAB_ENV,
  path.join(process.cwd(), ".env"),
  path.join(SLACK_BOT_DIR, ".env"),
].filter(Boolean);
for (const p of envPaths) {
  if (p && existsSync(p)) {
    config({ path: p });
    break;
  }
}
function getMcpJsonPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return home ? path.join(home, ".cursor", "mcp.json") : null;
}
const mcpPath = process.env.QA_LAB_MCP_CONFIG || getMcpJsonPath();

console.log("\n🔧 QA Lab Slack Bot - Diagnóstico\n");
console.log("1. Origens de config (mcp.json ou .env):");
let mcp = null;
if (mcpPath && existsSync(mcpPath)) {
  console.log("   ✅ mcp.json:", mcpPath);
  try {
    mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
  } catch (e) {
    console.log("   ❌ Erro ao ler mcp.json:", e.message);
  }
} else {
  console.log("   ⊘ mcp.json não encontrado (use .env na pasta do slack-bot ou cwd)");
}

const slack = mcp?.["qa-lab-agent"]?.slack || {};
const hasMcpSlack = !!mcp?.["qa-lab-agent"]?.slack;
if (!hasMcpSlack) {
  console.log("   ⚠️  Seção 'qa-lab-agent.slack' não encontrada no mcp.json");
  console.log("   Usando .env como fallback (SLACK_BOT_TOKEN, SLACK_APP_TOKEN ou SLACK_SIGNING_SECRET)");
}
if (hasMcpSlack) console.log("   ✅ Config slack encontrada no mcp.json");

console.log("\n2. botToken:");
const token = slack.botToken || slack.SLACK_BOT_TOKEN || process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.log("   ❌ Ausente. Adicione 'botToken' ou 'SLACK_BOT_TOKEN'");
} else if (!token.startsWith("xoxb-")) {
  console.log("   ⚠️  Deve começar com 'xoxb-'. Você usou o Client Secret?");
  console.log("   Onde: OAuth & Permissions → OAuth Tokens → Bot User OAuth Token");
} else {
  console.log("   ✅ OK (xoxb-...)");
}

const appToken = slack.appToken || slack.slack_app_token || slack.SLACK_APP_TOKEN || process.env.SLACK_APP_TOKEN;
const useSocketMode = !!(appToken && appToken.startsWith("xapp-"));

console.log("\n3. signingSecret (só para modo HTTP):");
const secret = slack.signingSecret || slack.SLACK_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET;
if (useSocketMode) {
  console.log("   ⊘ Não necessário (você está usando Socket Mode)");
} else if (!secret) {
  console.log("   ❌ Ausente. Adicione 'signingSecret' ou use appToken para Socket Mode");
  console.log("   Onde: Basic Information → App Credentials → Signing Secret (Show)");
} else if (secret === "..." || secret.length < 20) {
  console.log("   ⚠️  Parece placeholder ou inválido. Use o valor real do Signing Secret.");
} else {
  console.log("   ✅ OK");
}

console.log("\n4. appToken (slack_app_token) para Socket Mode:");
if (appToken) {
  if (appToken.startsWith("xapp-")) {
    console.log("   ✅ OK (xapp-...) — bot funcionará sem URL pública");
  } else {
    console.log("   ⚠️  Deve começar com 'xapp-'. Onde: Basic Information → App-Level Tokens (scope: connections:write)");
  }
} else {
  console.log("   ⊘ Não configurado. Onde: Basic Information → App-Level Tokens (scope: connections:write)");
}

console.log("\n5. Resumo do modo:");
if (useSocketMode) {
  console.log("   ✅ Socket Mode (appToken xapp-) — não precisa de URL pública");
  console.log("   • Em api.slack.com: Socket Mode → Enable");
  console.log("   • Basic Information → App-Level Tokens → Generate com scope connections:write");
} else {
  console.log("   HTTP (Event Subscriptions):");
  console.log("   • Request URL: https://SEU_DOMINIO/slack/events");
  console.log("   • Se local: ngrok http 3000");
  console.log("   • Bot event: app_mention");
  console.log("   💡 Para PC corporativo: use appToken (Socket Mode) e não precisa de ngrok!");
}

console.log("\n6. Bot no canal:");
console.log("   • /invite @NomeDoBot (obrigatório!) ou mencione em DM");

if (token && token.startsWith("xoxb-") && (useSocketMode || secret)) {
  console.log("\n✅ Config OK. Rode: npm start");
  console.log("   Modo:", useSocketMode ? "Socket (qualquer ambiente)" : "HTTP (ngrok)");
} else {
  console.log("\n❌ Corrija os itens acima.");
  if (!token) console.log("   Dica: botToken ou SLACK_BOT_TOKEN obrigatório.");
  if (!useSocketMode && !secret) console.log("   Dica: use appToken (Socket) OU signingSecret (HTTP).");
  console.log("   Onde obter: slack-bot/CREDENTIALS.md | https://docs.slack.dev/app-management/quickstart-app-settings");
}
console.log("");
