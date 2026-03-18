import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const SLACK_BOT_DIR = path.dirname(__dirname); // slack-bot/
config({ path: path.join(SLACK_BOT_DIR, ".env") });

function loadConfig() {
  const configPath = process.env.QA_LAB_CONFIG || path.join(ROOT, "qa-lab-agent.config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config não encontrada: ${configPath}. Crie qa-lab-agent.config.json na raiz do projeto.`);
  }
  const raw = readFileSync(configPath, "utf8");
  const data = JSON.parse(raw);
  if (!data.slack) {
    throw new Error("Config sem seção 'slack'. Ver qa-lab-agent.config.json.");
  }
  return data.slack;
}

function getRepoForChannel(channelId) {
  const slackConfig = loadConfig();
  const channelConfig = slackConfig.channels?.[channelId];
  if (channelConfig?.repo) {
    return {
      url: channelConfig.repo,
      branch: channelConfig.branch || "main",
    };
  }
  const defaultRepo = slackConfig.defaultRepo;
  if (!defaultRepo?.url) {
    throw new Error(`Canal ${channelId} não mapeado e defaultRepo não configurado.`);
  }
  return {
    url: defaultRepo.url,
    branch: defaultRepo.branch || "main",
  };
}

function getMcpLabAgentCmd() {
  const slackConfig = loadConfig();
  const mcp = slackConfig.mcpLabAgent || { command: "npx", args: ["-y", "mcp-lab-agent@latest"] };
  return {
    command: mcp.command,
    args: mcp.args || [],
  };
}

function getCloneBaseDir() {
  return process.env.CLONE_BASE_DIR || path.join(process.cwd(), ".qa-lab-clones");
}

export { loadConfig, getRepoForChannel, getMcpLabAgentCmd, getCloneBaseDir };
