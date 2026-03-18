import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SLACK_BOT_DIR = path.dirname(__dirname);

config({ path: path.join(SLACK_BOT_DIR, ".env") });

function loadSlackConfig() {
  const configPath = process.env.QA_LAB_CONFIG || path.join(ROOT, "qa-lab-agent.config.json");
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(configPath, "utf8"));
    return data.slack || data;
  } catch {
    return null;
  }
}

function getRepoForChannel() {
  const repoUrl = process.env.REPO_URL;
  const repoBranch = process.env.REPO_BRANCH || "main";
  if (repoUrl) {
    return { url: repoUrl, branch: repoBranch };
  }
  const cfg = loadSlackConfig();
  const repo = cfg?.repo || cfg?.defaultRepo?.url;
  const branch = cfg?.branch || cfg?.defaultRepo?.branch || "main";
  if (!repo) {
    throw new Error("Configure REPO_URL no .env ou 'repo' no qa-lab-agent.config.json");
  }
  return { url: repo, branch };
}

function getMcpLabAgentCmd() {
  const cfg = loadSlackConfig();
  const mcp = cfg?.mcpLabAgent || { command: "npx", args: ["-y", "mcp-lab-agent@latest"] };
  return { command: mcp.command, args: mcp.args || [] };
}

function getCloneBaseDir() {
  return process.env.CLONE_BASE_DIR || path.join(process.cwd(), ".qa-lab-clones");
}

export { loadSlackConfig, getRepoForChannel, getMcpLabAgentCmd, getCloneBaseDir };
