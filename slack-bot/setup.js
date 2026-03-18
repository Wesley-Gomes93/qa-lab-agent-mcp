#!/usr/bin/env node
/**
 * Setup rápido - cria .env e valida config
 * Uso: node setup.js
 */
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");

console.log("\n🔧 QA Lab Slack Bot - Setup\n");

if (!existsSync(envPath)) {
  copyFileSync(path.join(__dirname, ".env.example"), envPath);
  console.log("✅ .env criado. Edite e preencha:");
  console.log("   - SLACK_BOT_TOKEN (api.slack.com → sua app → OAuth)");
  console.log("   - SLACK_SIGNING_SECRET (api.slack.com → Basic Information)\n");
  process.exit(0);
}

const env = readFileSync(envPath, "utf8");
const hasToken = /SLACK_BOT_TOKEN=xoxb-/.test(env);
const hasSecret = /SLACK_SIGNING_SECRET=.{20,}/.test(env);

if (!hasToken || !hasSecret) {
  console.log("⚠️  .env existe mas faltam valores:");
  if (!hasToken) console.log("   - SLACK_BOT_TOKEN");
  if (!hasSecret) console.log("   - SLACK_SIGNING_SECRET");
  console.log("\nEdite slack-bot/.env e preencha os valores.\n");
  process.exit(1);
}

const configPath = path.join(__dirname, "..", "qa-lab-agent.config.json");
if (existsSync(configPath)) {
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const repo = cfg?.slack?.repo || cfg?.slack?.defaultRepo?.url || process.env.REPO_URL;
  if (repo) {
    console.log("✅ Config OK. Repo:", repo, "\n");
    process.exit(0);
  }
}

if (!process.env.REPO_URL) {
  console.log("ℹ️  Configure o repositório:");
  console.log("   Opção 1: REPO_URL no .env");
  console.log("   Opção 2: 'repo' em qa-lab-agent.config.json\n");
}

console.log("✅ Setup básico OK. Rode: npm start\n");
