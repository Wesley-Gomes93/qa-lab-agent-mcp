import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SLACK_BOT_DIR = path.dirname(__dirname);

config({ path: path.join(SLACK_BOT_DIR, ".env") });

function getMcpJsonPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  return path.join(home, ".cursor", "mcp.json");
}

function loadMcpConfig() {
  const mcpPath = process.env.QA_LAB_MCP_CONFIG || getMcpJsonPath();
  if (!mcpPath || !existsSync(mcpPath)) return null;
  try {
    return JSON.parse(readFileSync(mcpPath, "utf8"));
  } catch {
    return null;
  }
}

function getSlackConfigFromMcp() {
  const mcp = loadMcpConfig();
  const qa = mcp?.["qa-lab-agent"];
  const slack = qa?.slack;
  if (!slack) return null;
  return {
    id: slack.id || slack.channelId,
    botToken: slack.botToken || slack.SLACK_BOT_TOKEN,
    signingSecret: slack.signingSecret || slack.SLACK_SIGNING_SECRET,
    repo: slack.repo || slack.REPO_URL,
    branch: slack.branch || slack.REPO_BRANCH || "main",
  };
}

function loadSlackConfig() {
  const configPath = process.env.QA_LAB_CONFIG || path.join(ROOT, "qa-lab-agent.config.json");
  if (existsSync(configPath)) {
    try {
      const data = JSON.parse(readFileSync(configPath, "utf8"));
      return data.slack || data;
    } catch {}
  }
  return null;
}

function getSlackTokens() {
  const fromMcp = getSlackConfigFromMcp();
  if (fromMcp?.botToken && fromMcp?.signingSecret) {
    return { token: fromMcp.botToken, signingSecret: fromMcp.signingSecret };
  }
  return {
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  };
}

function getRepoForChannel() {
  const fromMcp = getSlackConfigFromMcp();
  if (fromMcp?.repo) {
    return { url: fromMcp.repo, branch: fromMcp.branch || "main" };
  }
  const repoUrl = process.env.REPO_URL;
  if (repoUrl) {
    return { url: repoUrl, branch: process.env.REPO_BRANCH || "main" };
  }
  const cfg = loadSlackConfig();
  const repo = cfg?.repo || cfg?.defaultRepo?.url;
  const branch = cfg?.branch || cfg?.defaultRepo?.branch || "main";
  if (!repo) {
    throw new Error("Configure 'slack.repo' no ~/.cursor/mcp.json ou em qa-lab-agent.config.json");
  }
  return { url: repo, branch };
}

function getMcpLabAgentCmd() {
  const fromMcp = loadMcpConfig()?.["qa-lab-agent"]?.mcpLabAgent;
  const cfg = loadSlackConfig();
  const mcp = fromMcp || cfg?.mcpLabAgent || { command: "npx", args: ["-y", "mcp-lab-agent@latest"] };
  return { command: mcp.command, args: mcp.args || [] };
}

function getCloneBaseDir() {
  return process.env.CLONE_BASE_DIR || path.join(process.cwd(), ".qa-lab-clones");
}

export {
  loadSlackConfig,
  getRepoForChannel,
  getMcpLabAgentCmd,
  getCloneBaseDir,
  getSlackConfigFromMcp,
  getSlackTokens,
};
