import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getRepoForChannel, getMcpLabAgentCmd, getCloneBaseDir } from "../config.js";

/**
 * Executa comando e retorna { stdout, stderr, code }
 */
function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (proc.stdout) proc.stdout.on("data", (d) => { stdout += d.toString(); });
    if (proc.stderr) proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

/**
 * Clona repo para dir ou faz pull se já existe.
 */
async function ensureRepo(repoUrl, branch, targetDir) {
  if (fs.existsSync(path.join(targetDir, ".git"))) {
    const r = await runCommand("git", ["pull", "origin", branch], targetDir);
    return targetDir;
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true });
  await runCommand("git", ["clone", "--depth", "1", "-b", branch, repoUrl, targetDir]);
  return targetDir;
}

/**
 * Extrai intent da mensagem do usuário.
 * @returns { runAnalyze: boolean, runAuto: boolean, autoDescription?: string }
 */
function parseUserIntent(text) {
  const lower = (text || "").toLowerCase();
  const runAuto = /crie|criar|gera|gerar|teste para|testes para|auto/i.test(lower);
  const runAnalyze = /analise|analisar|relatório|relatorio|report|análise|analise/i.test(lower) || !runAuto;

  let autoDescription = "fluxo principal";
  const match = lower.match(/(?:crie|criar|gera|gerar)\s+(?:teste[s]?\s+)?(?:para\s+)?([^.?!]+)/i)
    || lower.match(/teste[s]?\s+para\s+([^.?!]+)/i);
  if (match) {
    autoDescription = match[1].trim().slice(0, 100) || "fluxo principal";
  }

  return {
    runAnalyze: runAnalyze !== false,
    runAuto: runAuto,
    autoDescription,
  };
}

/**
 * Executa o job QA: clona repo, roda mcp-lab-agent, retorna output.
 */
export async function runQaJob({ channelId, userMessage }) {
  const repo = getRepoForChannel(channelId);
  const { command, args } = getMcpLabAgentCmd();
  const baseDir = getCloneBaseDir();
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workDir = path.join(baseDir, runId);

  const outputs = [];
  let lastError = null;

  try {
    await ensureRepo(repo.url, repo.branch, workDir);
  } catch (err) {
    lastError = `Erro ao clonar repositório: ${err.message}`;
    return { ok: false, output: lastError, error: err.message };
  }

  const intent = parseUserIntent(userMessage);

  try {
    if (intent.runAuto) {
      const autoArgs = [...args, "auto", intent.autoDescription];
      const res = await runCommand(command, autoArgs, workDir);
      outputs.push("=== mcp-lab-agent auto ===\n" + res.stdout);
      if (res.stderr) outputs.push(res.stderr);
      if (res.code !== 0) {
        outputs.push(`(exit code ${res.code})`);
      }
    }

    if (intent.runAnalyze) {
      const analyzeArgs = [...args, "analyze"];
      const res = await runCommand(command, analyzeArgs, workDir);
      outputs.push("=== mcp-lab-agent analyze ===\n" + res.stdout);
      if (res.stderr) outputs.push(res.stderr);
    }
  } catch (err) {
    lastError = err.message;
    outputs.push(`Erro: ${err.message}`);
  } finally {
    try {
      if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true });
    } catch {}
  }

  const output = outputs.join("\n\n").trim() || lastError || "Nenhum output.";
  return { ok: !lastError, output };
}
