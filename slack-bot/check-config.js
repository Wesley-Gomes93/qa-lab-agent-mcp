#!/usr/bin/env node
/**
 * Verifica se a config do Slack está correta.
 * Rode: node check-config.js
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const home = process.env.HOME || process.env.USERPROFILE;
const mcpPath = home ? path.join(home, ".cursor", "mcp.json") : null;

console.log("\n🔧 QA Lab Slack Bot - Diagnóstico\n");
console.log("1. mcp.json:");
if (!mcpPath || !existsSync(mcpPath)) {
  console.log("   ❌ Não encontrado em", mcpPath || "(HOME não definido)");
  process.exit(1);
}
console.log("   ✅ Encontrado:", mcpPath);

let mcp;
try {
  mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
} catch (e) {
  console.log("   ❌ Erro ao ler JSON:", e.message);
  process.exit(1);
}

const slack = mcp?.["qa-lab-agent"]?.slack;
if (!slack) {
  console.log("   ❌ Seção 'qa-lab-agent.slack' não encontrada");
  console.log("   Estrutura esperada:");
  console.log('   { "qa-lab-agent": { "slack": { "botToken": "xoxb-...", "signingSecret": "..." } } }');
  process.exit(1);
}
console.log("   ✅ Config slack encontrada");

console.log("\n2. botToken:");
const token = slack.botToken || slack.SLACK_BOT_TOKEN;
if (!token) {
  console.log("   ❌ Ausente. Adicione 'botToken' ou 'SLACK_BOT_TOKEN'");
} else if (!token.startsWith("xoxb-")) {
  console.log("   ⚠️  Deve começar com 'xoxb-'. Você usou o Client Secret?");
  console.log("   Use: OAuth & Permissions → Bot User OAuth Token (depois de Install to Workspace)");
} else {
  console.log("   ✅ OK (xoxb-...)");
}

console.log("\n3. signingSecret:");
const secret = slack.signingSecret || slack.SLACK_SIGNING_SECRET;
if (!secret) {
  console.log("   ❌ Ausente. Adicione 'signingSecret'");
  console.log("   Onde: Basic Information → App Credentials → Signing Secret (Show)");
} else if (secret === "..." || secret.length < 20) {
  console.log("   ⚠️  Parece placeholder ou inválido. Use o valor real do Signing Secret.");
} else {
  console.log("   ✅ OK");
}

console.log("\n4. Event Subscriptions (api.slack.com):");
console.log("   • Request URL deve ser: https://SEU_DOMINIO/slack/events");
console.log("   • Se local: use ngrok → ngrok http 3000");
console.log("   • Bot event: app_mention");

console.log("\n5. Bot no canal:");
console.log("   • Mencione o bot no canal ou use /invite @NomeDoBot");

if (token && secret && token.startsWith("xoxb-")) {
  console.log("\n✅ Config parece OK. Rode: npm start");
} else {
  console.log("\n❌ Corrija os itens acima e tente novamente.");
}
console.log("");
