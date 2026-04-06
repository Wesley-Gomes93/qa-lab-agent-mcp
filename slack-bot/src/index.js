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
import { App, SocketModeReceiver } from "@slack/bolt";
import { getSlackTokens } from "./config.js";
import { registerAppMention } from "./handlers/app-mention.js";

const { token, signingSecret, appToken } = getSlackTokens();

/** Força Event Subscriptions (HTTP) — evita WebSocket 408 / timeout de pong (rede, VPN, firewall). */
const forceHttp =
  process.env.SLACK_USE_HTTP === "1" ||
  process.env.SLACK_USE_HTTP === "true" ||
  process.env.SLACK_TRANSPORT === "http";

const useSocketMode = !forceHttp && !!(appToken && appToken.startsWith("xapp-"));

if (!token || !token.startsWith("xoxb-")) {
  console.error(
    "Configure botToken (xoxb-...) no ~/.cursor/mcp.json ou .env (SLACK_BOT_TOKEN).\n" +
    "Onde: api.slack.com → sua app → OAuth & Permissions → Bot User OAuth Token"
  );
  process.exit(1);
}

if (useSocketMode) {
  if (!appToken.startsWith("xapp-")) {
    console.error("appToken (slack_app_token) deve começar com 'xapp-' para Socket Mode.");
    process.exit(1);
  }
} else if (!signingSecret) {
  console.error("");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("❌ Modo HTTP ativo ou Socket Mode desligado — falta SLACK_SIGNING_SECRET");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("");
  console.error("1) api.slack.com/apps → sua app → Basic Information → Signing Secret (Show)");
  console.error("2) Cole no .env: SLACK_SIGNING_SECRET=...");
  console.error("3) Event Subscriptions → Enable → Request URL: https://SEU_TUNEL/slack/events");
  console.error("4) Inicie o túnel (ngrok ou outro) apontando para PORT (padrão 3000)");
  console.error("");
  console.error("Ou use Socket Mode: remova SLACK_USE_HTTP e mantenha SLACK_APP_TOKEN=xapp-...");
  console.error("");
  process.exit(1);
}

let app;

if (useSocketMode) {
  // Criar receiver customizado com timeouts aumentados
  const socketModeReceiver = new SocketModeReceiver({
    appToken,
    clientPingTimeout: 30000,
    serverPingTimeout: 60000
  });
  
  app = new App({
    token,
    receiver: socketModeReceiver
  });
} else {
  app = new App({
    token,
    signingSecret
  });
}

registerAppMention(app);

if (useSocketMode) {
  console.log("");
  console.log("📡 Socket Mode (WebSocket). Erro 408 ou timeout de pong → use SLACK_USE_HTTP=1 + SLACK_SIGNING_SECRET + túnel HTTPS.");
  console.log("");
}

function printHttpModeHelp(port) {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📡 Modo HTTP (sem WebSocket)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log(`• Servidor local: http://localhost:${port}`);
  console.log("• No Slack: Event Subscriptions → Request URL deve ser HTTPS público.");
  console.log("• Ex.: ngrok http " + port + "  →  cole a URL + /slack/events no Slack");
  console.log("");
}

// Tratamento de erros amigável
process.on('uncaughtException', (err) => {
  const msg = String(err?.message || err || "");
  if (
    msg.includes("server explicit disconnect") ||
    msg.includes("pong") ||
    msg.includes("408") ||
    msg.includes("Unexpected server response")
  ) {
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  PROBLEMA DE CONEXÃO COM O SLACK");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("🔴 Socket Mode / WebSocket falhou (408, timeout ou disconnect).");
    console.log("");
    console.log("Causas comuns: rede instável, VPN, firewall, proxy, ou limite do Slack.");
    console.log("");
    console.log("✅ SOLUÇÃO ESTÁVEL — Modo HTTP + túnel HTTPS:");
    console.log("");
    console.log("   1) No .env do slack-bot, adicione:");
    console.log("      SLACK_SIGNING_SECRET=(Basic Information → Signing Secret)");
    console.log("      SLACK_USE_HTTP=1");
    console.log("      PORT=3000");
    console.log("   2) ngrok http 3000   (ou outro túnel)");
    console.log("   3) Slack → Event Subscriptions → Request URL:");
    console.log("      https://xxxx.ngrok-free.app/slack/events");
    console.log("");
    console.log("💡 Alternativa local: ./qa-commands.sh (sem Slack)");
    console.log("");
    process.exit(1);
  }
  throw err;
});

// Retry com backoff exponencial e mensagens amigáveis
async function startWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (useSocketMode) {
        console.log(`🔄 Tentativa ${attempt}/${maxRetries} de conectar ao Slack...`);
        await app.start();
        console.log("");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ BOT CONECTADO COM SUCESSO!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("");
        console.log("🤖 Mencione @QA Lab Agent em um canal para usar");
        console.log("");
        console.log("💡 Comandos disponíveis:");
        console.log("   @QA Lab Agent gerar relatório");
        console.log("   @QA Lab Agent stats");
        console.log("   @QA Lab Agent dashboard");
        console.log("   @QA Lab Agent auto \"descrição\"");
        console.log("");
        return;
      } else {
        const port = Number(process.env.PORT) || 3000;
        await app.start(port);
        printHttpModeHelp(port);
        console.log("✅ Bot pronto para receber eventos em /slack/events");
        console.log("");
        return;
      }
    } catch (err) {
      const em = String(err?.message || err);
      console.log(`   ❌ Falhou: ${em.length > 120 ? em.slice(0, 120) + "…" : em}`);
      
      if (attempt < maxRetries) {
        const waitTime = 5000;
        console.log(`   ⏳ Aguardando ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.log("");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("❌ NÃO FOI POSSÍVEL CONECTAR AO SLACK (Socket Mode)");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("");
        console.log("✅ Troque para Modo HTTP + túnel (evita WebSocket 408):");
        console.log("");
        console.log("   1) .env: SLACK_SIGNING_SECRET=...  SLACK_USE_HTTP=1  PORT=3000");
        console.log("   2) Terminal: ngrok http 3000");
        console.log("   3) Slack → Event Subscriptions → URL: https://....../slack/events");
        console.log("");
        console.log("💡 Local (sem Slack): ./qa-commands.sh help");
        console.log("");
        process.exit(1);
      }
    }
  }
}

await startWithRetry();
