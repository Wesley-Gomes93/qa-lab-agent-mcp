import path from "node:path";
import fs from "node:fs";

const PROJECT_ROOT = process.cwd();
const METRICS_FILE = path.join(PROJECT_ROOT, ".qa-lab-metrics.json");

export function parseTestRunResult(runOutput, exitCode) {
  let passed = 0;
  let failed = 0;
  const jestMatch = runOutput.match(/Tests:\s+(\d+)\s+passed(?:,\s*(\d+)\s+failed)?/);
  if (jestMatch) {
    passed = parseInt(jestMatch[1], 10);
    failed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0;
  }
  return { passed, failed, success: exitCode === 0 };
}

export function recordMetricEvent(event) {
  try {
    let data = {};
    if (fs.existsSync(METRICS_FILE)) {
      const raw = fs.readFileSync(METRICS_FILE, "utf8");
      try {
        data = JSON.parse(raw);
      } catch {}
    }
    data.events = data.events || [];
    data.events.push({ ...event, timestamp: event.timestamp || new Date().toISOString() });
    data.lastUpdated = new Date().toISOString();
    if (data.events.length > 500) data.events = data.events.slice(-400);
    fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {}
}

export function extractFailuresFromOutput(runOutput) {
  const failures = [];
  const lines = runOutput.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/fail|error|assertion|timeout|element not found|selector/i.test(line)) {
      failures.push({
        test: lines[Math.max(0, i - 1)]?.trim() || "unknown",
        message: line.trim().slice(0, 500),
      });
    }
  }
  return failures.slice(0, 20);
}

export function generateFailureExplanation(testCode, runOutput, memory = {}) {
  const lines = [];
  lines.push("# Análise de Falha\n");
  lines.push("## Código do Teste");
  lines.push("```");
  lines.push(testCode.slice(0, 2000));
  lines.push("```\n");
  lines.push("## Output da Execução");
  lines.push("```");
  lines.push(runOutput.slice(0, 2000));
  lines.push("```\n");
  
  if (memory.learnings && memory.learnings.length > 0) {
    lines.push("## Aprendizados Anteriores (últimos 5)");
    memory.learnings.slice(-5).forEach((l) => {
      lines.push(`- **${l.type}**: ${l.description || "N/A"}`);
    });
    lines.push("");
  }
  
  lines.push("## Sua Tarefa");
  lines.push("1. Identifique a causa raiz da falha");
  lines.push("2. Sugira uma correção específica");
  lines.push("3. Explique por que essa correção deve funcionar");
  
  return lines.join("\n");
}
