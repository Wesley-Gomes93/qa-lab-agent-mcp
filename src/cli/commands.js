import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { detectDeviceConfig, detectProjectStructure, getFrameworkCwd } from "../core/project-structure.js";
import { loadProjectMemory, saveProjectMemory, getMemoryStats, analyzeTestStability } from "../core/memory.js";
import { resolveLLMProvider } from "../core/llm-router.js";
import { applySelectorFixAndRetry } from "../core/llm-call.js";
import { detectFlakyPatterns } from "../core/flaky-detection.js";
import { analyzeCodeRisks } from "../core/project-structure.js";

const PROJECT_ROOT = process.cwd();

const QA_AGENTS = {
  autonomous: { desc: "Modo autônomo: gera, testa, corrige e aprende", tools: ["qa_auto"] },
  detection: { desc: "Detecta estrutura, frameworks, testes", tools: ["detect_project", "read_project", "list_test_files"] },
  execution: { desc: "Executa testes, coverage, watch", tools: ["run_tests", "watch_tests", "get_test_coverage"] },
  generation: { desc: "Gera e escreve testes", tools: ["generate_tests", "write_test", "create_test_template"] },
  analysis: { desc: "Analisa falhas, sugere correções", tools: ["analyze_failures", "por_que_falhou", "suggest_fix", "suggest_selector_fix", "analyze_file_methods"] },
  browser: { desc: "Browser mode: screenshots, network, console", tools: ["web_eval_browser"] },
  reporting: { desc: "Relatórios e métricas", tools: ["create_bug_report", "get_business_metrics"] },
  intelligence: { desc: "Análise preditiva e insights", tools: ["qa_full_analysis", "qa_health_check", "qa_suggest_next_test", "qa_predict_flaky", "qa_compare_with_industry", "qa_time_travel"] },
  learning: { desc: "Sistema de aprendizado", tools: ["qa_learning_stats", "get_learning_report"] },
  maintenance: { desc: "Linter, deps, análise de código", tools: ["run_linter", "install_dependencies"] },
};

function getExtensionAndBaseDir(fw, structure) {
  const extMap = { cypress: ".cy.js", playwright: ".spec.js", jest: ".test.js", vitest: ".test.js", robot: ".robot", pytest: ".py" };
  const ext = extMap[fw] || ".spec.js";
  const baseDir = structure.testDirs[0] ? path.join(PROJECT_ROOT, structure.testDirs[0]) : path.join(PROJECT_ROOT, "tests");
  return { ext, baseDir };
}

export async function handleCLI() {
  const cmd = process.argv[2];

  if (cmd === "--help" || cmd === "-h") {
    console.log(`
mcp-lab-agent - Executor + Consultor Inteligente de QA

USO:
  mcp-lab-agent [comando]   # Sem comando: inicia servidor MCP
  mcp-lab-agent --help     # Mostra esta ajuda

COMANDOS CLI:
  slack-bot                             Inicia o Slack Bot (QA via @mention)
  learning-hub                          Inicia o Learning Hub (API + Dashboard em http://localhost:3847)
  analyze                               Análise completa: executa, analisa estabilidade, prevê riscos e recomenda ações
  auto <descrição> [--max-retries N]    Modo autônomo: gera teste, roda, corrige e aprende (default: 3 tentativas)
  stats                                 Estatísticas de aprendizado (taxa de sucesso, correções, etc.)
  report [--full]                        Relatório de evolução e aprendizado (--full = completo com recomendações)
  metrics-report [--json] [--output FILE] [path1 path2 ...]  Relatório de métricas (método, resultado). Sem paths = projeto atual.
  flaky-report [--runs N] [--spec FILE] [--output FILE]      Detecta testes flaky: roda N vezes (default 3), identifica intermitência e causa provável
  run [spec] [--device NAME] [--no-auto-fix]                 Roda testes: detecta device, executa e aplica auto-fix de seletor se falhar
  detect [--json]                       Detecta frameworks e estrutura
  route <tarefa>                        Sugere qual ferramenta usar
  list                                  Lista ferramentas MCP disponíveis

EXEMPLOS:
  mcp-lab-agent slack-bot                       # Slack Bot
  mcp-lab-agent learning-hub                   # Learning Hub (API + Dashboard)
  npx mcp-lab-agent slack-bot                   # Usar sem instalar (sem clonar o projeto)
  mcp-lab-agent analyze                         # Análise completa + recomendações
  mcp-lab-agent auto "login flow" --max-retries 5
  mcp-lab-agent stats
  mcp-lab-agent flaky-report --runs 5 --output flaky.md
  mcp-lab-agent run specs/login.spec.js
  mcp-lab-agent run specs/login.spec.js --device iPhone_15
  mcp-lab-agent detect --json

INTEGRAÇÃO MCP (Cursor/Cline/Windsurf):
  Adicione ao ~/.cursor/mcp.json:
  {
    "mcpServers": {
      "qa-lab-agent": {
        "command": "npx",
        "args": ["-y", "mcp-lab-agent"],
        "cwd": "\${workspaceFolder}"
      }
    }
  }

AMBIENTES CORPORATIVOS (APIs bloqueadas):
  Use Ollama (100% offline):
    brew install ollama
    ollama pull llama3.1:8b
    ollama serve
    mcp-lab-agent analyze  # Funciona sem internet!
`);
    return true;
  }

  if (cmd === "detect") {
    const structure = detectProjectStructure();
    const jsonOnly = process.argv.includes("--json");
    if (jsonOnly) {
      console.log(JSON.stringify(structure, null, 2));
    } else {
      const lines = [
        "",
        "mcp-lab-agent · detecção",
        "─".repeat(40),
        `Frameworks: ${structure.testFrameworks.length ? structure.testFrameworks.join(", ") : "nenhum"}`,
        `Pastas:    ${structure.testDirs.length ? structure.testDirs.join(", ") : "nenhuma"}`,
        `Backend:   ${structure.backendDir || "—"}`,
        `Frontend:  ${structure.frontendDir || "—"}`,
        `Mobile:    ${structure.hasMobile ? "sim" : "—"}`,
        "─".repeat(40),
        "(use --json para saída completa)",
        "",
      ];
      console.log(lines.join("\n"));
    }
    return true;
  }

  if (cmd === "list") {
    const agents = Object.entries(QA_AGENTS).map(([k, v]) => `  ${k}: ${v.tools.join(", ")}`);
    console.log("Agentes e ferramentas:\n" + agents.join("\n"));
    return true;
  }

  if (cmd === "route" && process.argv[3]) {
    const task = process.argv.slice(3).join(" ");
    const t = task.toLowerCase();
    let agent = "detection";
    if (/autônomo|auto|completo|loop|aprende|corrige automaticamente/i.test(t)) agent = "autonomous";
    else if (/estatística|métrica de aprendizado|taxa de sucesso|learning|stats/i.test(t)) agent = "learning";
    else if (/rodar|executar|run|test|coverage|watch/i.test(t)) agent = "execution";
    else if (/gerar|criar|escrever|generate|write|template/i.test(t)) agent = "generation";
    else if (/analisar|por que|falhou|sugerir|fix|selector/i.test(t)) agent = "analysis";
    else if (/browser|navegador|screenshot|network|console/i.test(t)) agent = "browser";
    else if (/relatório|métrica|bug report/i.test(t)) agent = "reporting";
    else if (/linter|dependência|instalar|analisar método/i.test(t)) agent = "maintenance";
    const a = QA_AGENTS[agent] || QA_AGENTS.detection;
    console.log(JSON.stringify({ suggestedAgent: agent, suggestedTools: a.tools, description: a.desc }, null, 2));
    return true;
  }

  if (cmd === "auto") {
    await handleAutoCommand();
    return true;
  }

  if (cmd === "stats") {
    const stats = getMemoryStats();
    const byType = stats.byLearningType || {};
    const byTypeLines = Object.entries(byType).filter(([, v]) => v > 0).map(([t, v]) => `  ${t}: ${v}`).join("\n");
    console.log(`
📊 Estatísticas de Aprendizado

Total de aprendizados: ${stats.totalLearnings}
Correções bem-sucedidas: ${stats.successfulFixes}
Correções de seletores: ${stats.selectorFixes}
Correções de timing: ${stats.timingFixes}
Testes gerados: ${stats.testsGenerated}
Taxa de sucesso na 1ª tentativa: ${stats.firstAttemptSuccessRate}%
${byTypeLines ? `\nPor tipo:\n${byTypeLines}` : ""}

${stats.totalLearnings === 0 ? "⚠️ Ainda não há aprendizados. Use 'mcp-lab-agent auto <descrição>' para gerar testes e aprender com erros." : ""}
`);
    return true;
  }

  if (cmd === "report") {
    const memory = loadProjectMemory();
    const learnings = memory.learnings || [];
    const stats = getMemoryStats();
    const byType = stats.byLearningType || {};
    const format = process.argv.includes("--full") ? "full" : "summary";
    const recommendations = [];
    if (byType.element_not_rendered > 0 || byType.element_not_visible > 0) {
      recommendations.push("Use waits explícitos (waitForSelector, waitForDisplayed) ANTES de interagir com elementos.");
    }
    if (byType.timing_fix > 0 || byType.element_stale > 0) {
      recommendations.push("Aumente timeouts e use re-localização de elementos em listas dinâmicas.");
    }
    if (byType.selector_fix > 0 || byType.mobile_mapping_invisible > 0) {
      recommendations.push("Priorize data-testid, role e seletores estáveis; em mobile, use mapeamento visível no topo do spec.");
    }
    if (stats.firstAttemptSuccessRate < 70 && stats.testsGenerated > 0) {
      recommendations.push("Aplique waits inteligentes + assert final em cada teste gerado.");
    }
    const byTypeStr = Object.entries(byType).filter(([, v]) => v > 0).map(([t, v]) => `  - ${t}: ${v}`).join("\n");
    console.log(`
📈 Relatório de Evolução e Aprendizado

Resumo por tipo:
${byTypeStr || "  Nenhum aprendizado por tipo ainda"}

Métricas gerais:
  Total de aprendizados: ${stats.totalLearnings}
  Taxa de sucesso (1ª tentativa): ${stats.firstAttemptSuccessRate}%
  Testes gerados: ${stats.testsGenerated}
${format === "full" && recommendations.length > 0 ? `\nRecomendações para aprimorar o código:\n${recommendations.map((r) => `  • ${r}`).join("\n")}` : ""}
`);
    return true;
  }

  if (cmd === "analyze") {
    await handleAnalyzeCommand();
    return true;
  }

  if (cmd === "metrics-report") {
    await handleMetricsReportCommand();
    return true;
  }

  if (cmd === "flaky-report") {
    await handleFlakyReportCommand();
    return true;
  }

  if (cmd === "run") {
    await handleRunCommand();
    return true;
  }

  return false;
}

/**
 * Gera relatório de métricas a partir de .qa-lab-memory.json e .qa-lab-metrics.json.
 * Suporta múltiplos projetos: mcp-lab-agent metrics-report /path/proj1 /path/proj2
 */
async function handleMetricsReportCommand() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const outputIdx = argv.indexOf("--output");
  const outputFile = outputIdx !== -1 && argv[outputIdx + 1] ? argv[outputIdx + 1] : null;
  const paths = argv.filter((a) => {
    if (a.startsWith("--") || a === "metrics-report") return false;
    if (outputIdx !== -1 && a === argv[outputIdx + 1]) return false; // exclui valor de --output
    return true;
  });

  const projectDirs = paths.length > 0 ? paths : [PROJECT_ROOT];

  const reports = [];
  for (const dir of projectDirs) {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) {
      console.warn(`⚠️ Diretório não encontrado: ${dir}`);
      continue;
    }
    const memoryPath = path.join(resolved, ".qa-lab-memory.json");
    const metricsPath = path.join(resolved, ".qa-lab-metrics.json");

    let memory = {};
    let metrics = { events: [] };
    if (fs.existsSync(memoryPath)) {
      try {
        memory = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
      } catch {}
    }
    if (fs.existsSync(metricsPath)) {
      try {
        metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
      } catch {}
    }

    const events = metrics.events || [];
    const executions = memory.executions || [];
    const learnings = memory.learnings || [];

    const byEventType = {};
    events.forEach((e) => {
      const t = e.type || "unknown";
      byEventType[t] = (byEventType[t] || 0) + 1;
    });

    const testRuns = events.filter((e) => e.type === "test_run");
    const testRunPassed = testRuns.filter((e) => e.exitCode === 0).length;
    const testRunFailed = testRuns.filter((e) => e.exitCode !== 0).length;
    const byFramework = {};
    testRuns.forEach((e) => {
      const f = e.framework || "unknown";
      byFramework[f] = (byFramework[f] || { total: 0, passed: 0, failed: 0 });
      byFramework[f].total++;
      if (e.exitCode === 0) byFramework[f].passed++;
      else byFramework[f].failed++;
    });

    const byLearningType = {};
    learnings.forEach((l) => {
      const t = l.type || "unknown";
      byLearningType[t] = (byLearningType[t] || { total: 0, success: 0 });
      byLearningType[t].total++;
      if (l.success) byLearningType[t].success++;
    });

    const execByFramework = {};
    executions.forEach((e) => {
      const f = e.framework || "unknown";
      execByFramework[f] = (execByFramework[f] || { total: 0, passed: 0 });
      execByFramework[f].total++;
      if (e.passed) execByFramework[f].passed++;
    });

    const projectName = path.basename(resolved);
    reports.push({
      project: projectName,
      path: resolved,
      summary: {
        eventsTotal: events.length,
        eventTypes: byEventType,
        testRuns: { total: testRuns.length, passed: testRunPassed, failed: testRunFailed },
        byFramework,
        executions: { total: executions.length, byFramework: execByFramework },
        learnings: { total: learnings.length, byType: byLearningType },
        lastUpdated: metrics.lastUpdated || memory.updatedAt,
      },
      recentEvents: events.slice(-20).map((e) => ({
        type: e.type,
        timestamp: e.timestamp,
        framework: e.framework,
        spec: e.spec,
        passed: e.passed,
        failed: e.failed,
        exitCode: e.exitCode,
        durationSeconds: e.durationSeconds,
      })),
    });
  }

  if (jsonOnly) {
    const out = JSON.stringify({ projects: reports, generatedAt: new Date().toISOString() }, null, 2);
    if (outputFile) fs.writeFileSync(outputFile, out, "utf8");
    else console.log(out);
    return;
  }

  let report = `# Relatório de Métricas — mcp-lab-agent\n\n`;
  report += `Gerado em: ${new Date().toISOString()}\n`;
  report += `Projetos: ${reports.length}\n\n`;
  report += `---\n\n`;

  for (const r of reports) {
    report += `## ${r.project}\n\n`;
    report += `**Caminho:** \`${r.path}\`\n\n`;

    const s = r.summary;
    report += `### Eventos (.qa-lab-metrics.json)\n\n`;
    report += `| Método/Tipo | Total | Descrição |\n`;
    report += `|-------------|-------|\n`;
    for (const [t, count] of Object.entries(s.eventTypes || {})) {
      let desc = "";
      if (t === "test_run") desc = `Execução de testes (passed/failed por framework abaixo)`;
      else if (t === "bug_reported") desc = "Bug report gerado";
      else desc = t;
      report += `| ${t} | ${count} | ${desc} |\n`;
    }
    if (Object.keys(s.eventTypes || {}).length === 0) {
      report += `| — | 0 | Nenhum evento registrado |\n`;
    }
    report += `\n`;

    if (s.testRuns?.total > 0) {
      report += `### Resultado de Execuções (run_tests)\n\n`;
      report += `| Framework | Total | Passed | Failed | Taxa sucesso |\n`;
      report += `|-----------|-------|--------|--------|---------------|\n`;
      for (const [fw, data] of Object.entries(s.byFramework || {})) {
        const rate = data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0;
        report += `| ${fw} | ${data.total} | ${data.passed} | ${data.failed} | ${rate}% |\n`;
      }
      report += `\n`;
      report += `**Resumo:** ${s.testRuns.passed} passed, ${s.testRuns.failed} failed (total: ${s.testRuns.total})\n\n`;
    }

    if (s.executions?.total > 0) {
      report += `### Histórico de Execuções (memory)\n\n`;
      report += `| Framework | Total | Passed | Taxa |\n`;
      report += `|-----------|-------|--------|------|\n`;
      for (const [fw, data] of Object.entries(s.executions.byFramework || {})) {
        const rate = data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0;
        report += `| ${fw} | ${data.total} | ${data.passed} | ${rate}% |\n`;
      }
      report += `\n`;
    }

    if (s.learnings?.total > 0) {
      report += `### Aprendizados (.qa-lab-memory.json)\n\n`;
      report += `| Tipo | Total | Sucesso | Taxa |\n`;
      report += `|------|-------|---------|------|\n`;
      for (const [t, data] of Object.entries(s.learnings.byType || {})) {
        const rate = data.total > 0 ? Math.round((data.success / data.total) * 100) : 0;
        report += `| ${t} | ${data.total} | ${data.success} | ${rate}% |\n`;
      }
      report += `\n`;
    }

    if (r.recentEvents?.length > 0) {
      report += `### Últimos 20 eventos\n\n`;
      report += `| Data | Tipo | Framework | Spec | Passed | Failed | Exit | Duração(s) |\n`;
      report += `|------|------|-----------|------|--------|--------|------|------------|\n`;
      for (const e of r.recentEvents.slice(-10)) {
        const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : "—";
        report += `| ${ts} | ${e.type || "—"} | ${e.framework || "—"} | ${(e.spec || "—").slice(0, 20)} | ${e.passed ?? "—"} | ${e.failed ?? "—"} | ${e.exitCode ?? "—"} | ${e.durationSeconds ?? "—"} |\n`;
      }
      report += `\n`;
    }

    if (s.lastUpdated) {
      report += `*Última atualização: ${s.lastUpdated}*\n\n`;
    }
    report += `---\n\n`;
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, report, "utf8");
    console.log(`\n📄 Relatório salvo em: ${outputFile}\n`);
  } else {
    console.log(report);
  }
}

/**
 * Detecta testes flaky: roda suite N vezes, identifica intermitência e causa provável.
 * Uso: mcp-lab-agent flaky-report [--runs N] [--spec FILE] [--output FILE]
 */
async function handleFlakyReportCommand() {
  const argv = process.argv.slice(2);
  const runsIdx = argv.indexOf("--runs");
  const runs = runsIdx !== -1 && argv[runsIdx + 1] ? parseInt(argv[runsIdx + 1], 10) : 3;
  const specIdx = argv.indexOf("--spec");
  const spec = specIdx !== -1 && argv[specIdx + 1] ? argv[specIdx + 1] : null;
  const outputIdx = argv.indexOf("--output");
  const outputFile = outputIdx !== -1 && argv[outputIdx + 1] ? argv[outputIdx + 1] : null;

  const structure = detectProjectStructure();
  if (!structure.hasTests) {
    console.error("❌ Nenhum framework de teste detectado.");
    process.exit(1);
  }

  const fw = structure.testFrameworks[0];
  const { cmd, args, cwd } = getRunCommand(structure, fw, spec);

  console.log(`\n🔬 Relatório de testes flaky\n`);
  console.log(`Framework: ${fw}`);
  console.log(`Execuções: ${runs}`);
  if (spec) console.log(`Spec: ${spec}`);
  console.log(`\nRodando testes ${runs}x...\n`);

  const results = [];
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  [${i + 1}/${runs}] `);
    const result = await runTestsOnce(cmd, args, cwd);
    results.push(result);
    process.stdout.write(result.passed ? "✅ passou\n" : "❌ falhou\n");
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const isFlaky = passed > 0 && failed > 0;
  const failureOutput = results.find((r) => !r.passed)?.output || "";

  const flakyAnalysis = failureOutput ? detectFlakyPatterns(failureOutput) : null;
  const probableCause = flakyAnalysis?.isLikelyFlaky
    ? flakyAnalysis.patterns.map((p) => `${p.pattern}: ${p.suggestion}`).join("; ")
    : "Não foi possível inferir (rode com explainOnFailure para análise detalhada)";

  let report = `# Relatório de testes flaky — mcp-lab-agent\n\n`;
  report += `Gerado em: ${new Date().toISOString()}\n`;
  report += `Framework: ${fw}\n`;
  report += `Execuções: ${runs}\n`;
  if (spec) report += `Spec: ${spec}\n`;
  report += `\n---\n\n`;

  report += `## Resultado\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| Passou | ${passed}/${runs} |\n`;
  report += `| Falhou | ${failed}/${runs} |\n`;
  report += `| Taxa de falha | ${Math.round((failed / runs) * 100)}% |\n`;
  report += `| **Flaky?** | ${isFlaky ? "⚠️ SIM" : failed === runs ? "❌ Falha consistente" : "✅ Estável"} |\n\n`;

  if (isFlaky) {
    report += `## Causa provável\n\n`;
    report += `${probableCause}\n\n`;
    if (flakyAnalysis?.patterns?.length) {
      report += `### Sugestões\n\n`;
      flakyAnalysis.patterns.forEach((p) => {
        report += `- **${p.pattern}:** ${p.suggestion}\n`;
      });
      report += `\n`;
    }
  }

  if (failed > 0 && failureOutput) {
    report += `## Última saída de falha (trecho)\n\n`;
    report += "```\n";
    report += failureOutput.slice(0, 1500).trim();
    if (failureOutput.length > 1500) report += "\n...";
    report += "\n```\n\n";
  }

  report += `---\n\n`;
  report += `*Use \`mcp-lab-agent por_que_falhou\` (via MCP) ou \`run_tests\` com \`explainOnFailure: true\` para análise detalhada.*\n`;

  if (outputFile) {
    fs.writeFileSync(outputFile, report, "utf8");
    console.log(`\n📄 Relatório salvo em: ${outputFile}\n`);
  } else {
    console.log("\n" + report);
  }

  process.exit(isFlaky ? 1 : 0);
}

function getRunCommand(structure, fw, spec) {
  const cwdMap = {
    cypress: structure.testDirs.includes("cypress") ? path.join(PROJECT_ROOT, "cypress") : structure.testDirs[0] ? path.join(PROJECT_ROOT, structure.testDirs[0]) : PROJECT_ROOT,
    playwright: structure.testDirs.includes("playwright") ? path.join(PROJECT_ROOT, "playwright") : structure.testDirs[0] ? path.join(PROJECT_ROOT, structure.testDirs[0]) : PROJECT_ROOT,
  };
  const cwd = cwdMap[fw] || getFrameworkCwd(structure, ["specs", "tests", "e2e"]) || PROJECT_ROOT;

  if (fw === "cypress") {
    return { cmd: "npx", args: spec ? ["cypress", "run", "--spec", spec] : ["cypress", "run"], cwd };
  }
  if (fw === "playwright") {
    return { cmd: "npx", args: spec ? ["playwright", "test", spec] : ["playwright", "test"], cwd };
  }
  if (fw === "webdriverio" || fw === "appium") {
    return { cmd: "npx", args: spec ? ["wdio", "run", spec] : ["wdio", "run"], cwd: PROJECT_ROOT };
  }
  if (fw === "jest") {
    return { cmd: "npx", args: spec ? ["jest", spec] : ["jest"], cwd: PROJECT_ROOT };
  }
  if (fw === "vitest") {
    return { cmd: "npx", args: ["vitest", "run", ...(spec ? [spec] : [])], cwd: PROJECT_ROOT };
  }
  if (fw === "mocha") {
    return { cmd: "npx", args: spec ? ["mocha", spec] : ["mocha"], cwd: PROJECT_ROOT };
  }
  if (fw === "pytest") {
    return { cmd: "pytest", args: spec ? [spec] : [], cwd: PROJECT_ROOT };
  }
  if (fw === "robot") {
    return { cmd: "robot", args: spec ? [spec] : [structure.testDirs[0] || "tests"], cwd: PROJECT_ROOT };
  }
  return { cmd: "npm", args: ["test"], cwd: PROJECT_ROOT };
}

async function handleRunCommand() {
  const argv = process.argv.slice(2);
  const deviceIdx = argv.indexOf("--device");
  const device = deviceIdx !== -1 && argv[deviceIdx + 1] ? argv[deviceIdx + 1] : null;
  const noAutoFix = argv.includes("--no-auto-fix");
  const spec = argv.filter((a) => !a.startsWith("--") && a !== "run")[0] || null;

  const structure = detectProjectStructure();
  if (!structure.hasTests) {
    console.error("❌ Nenhum framework de teste detectado.");
    process.exit(1);
  }

  const fw = structure.testFrameworks[0];
  const deviceConfig = structure.hasMobile ? detectDeviceConfig(structure) : {};
  const useDevice = device || deviceConfig.configuration || deviceConfig.device;
  const doAutoFix = !noAutoFix && structure.hasMobile && !!spec;

  let runEnv = { ...process.env };
  if (Object.keys(deviceConfig.envOverrides || {}).length) {
    runEnv = { ...runEnv, ...deviceConfig.envOverrides };
  }
  if (device) {
    if (fw === "detox") runEnv.DETOX_CONFIGURATION = device;
    else if (fw === "appium") runEnv.APPIUM_DEVICE_NAME = device;
  } else if (deviceConfig.configuration && fw === "detox") {
    runEnv.DETOX_CONFIGURATION = deviceConfig.configuration;
  }

  let { cmd, args, cwd } = getRunCommand(structure, fw, spec);
  if (fw === "detox" && useDevice) {
    args = [...args.slice(0, 2), "--configuration", useDevice, ...args.slice(2)];
  }

  const isSelectorFailure = (out) => /element not found|selector|timeout|locator|cy\.get|page\.locator|Unable to find/i.test(out || "");

  console.log(`\n▶️ Rodando testes${spec ? `: ${spec}` : ""}\n`);
  if (useDevice) console.log(`   Device: ${useDevice}\n`);

  let result = await runTestsOnce(cmd, args, cwd, runEnv);
  let autoFixed = false;

  if (!result.passed && doAutoFix && isSelectorFailure(result.runOutput) && resolveLLMProvider("complex").apiKey) {
    console.log("\n⚠️ Falha por seletor. Aplicando correção automática...\n");
    const fixResult = await applySelectorFixAndRetry(spec, result.runOutput, fw);
    if (fixResult.applied) {
      autoFixed = true;
      result = await runTestsOnce(cmd, args, cwd, runEnv);
    }
  }

  if (result.passed) {
    console.log(`\n✅ Testes passaram${autoFixed ? " (após correção de seletor)" : ""}.\n`);
  } else {
    console.log(`\n❌ Testes falharam.\n`);
    if (result.runOutput) console.log(result.runOutput.slice(0, 800) + (result.runOutput.length > 800 ? "\n..." : ""));
  }

  process.exit(result.passed ? 0 : 1);
}

function runTestsOnce(cmd, args, cwd, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });
    if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      const output = [stdout, stderr].filter(Boolean).join("\n");
      resolve({ passed: code === 0, code: code ?? 1, output });
    });
  });
}

async function handleAutoCommand() {
  const request = process.argv.slice(3).join(" ");
  if (!request) {
    console.error("❌ Uso: mcp-lab-agent auto <descrição do teste> [--max-retries N]");
    process.exit(1);
  }
  const maxRetriesIdx = process.argv.indexOf("--max-retries");
  const maxRetries = maxRetriesIdx !== -1 && process.argv[maxRetriesIdx + 1] ? parseInt(process.argv[maxRetriesIdx + 1], 10) : 3;
  const cleanRequest = request.replace(/--max-retries\s+\d+/g, "").trim();

  console.log(`\n🤖 Modo autônomo iniciado: "${cleanRequest}"\n`);
  const structure = detectProjectStructure();
  const fw = structure.testFrameworks[0];
  if (!fw) {
    console.error("❌ Nenhum framework detectado.");
    process.exit(1);
  }

  const llm = resolveLLMProvider("simple");
  if (!llm.apiKey) {
    console.error("❌ Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env");
    process.exit(1);
  }

  const memory = loadProjectMemory();
  const contextLines = [
    `Frameworks: ${structure.testFrameworks.join(", ")}`,
    `Pastas: ${structure.testDirs.join(", ")}`,
    memory.flows?.length ? `Fluxos: ${memory.flows.map((f) => f.name || f.id).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  let testFilePath = null;
  let testContent = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n[Tentativa ${attempt}/${maxRetries}] Gerando teste...`);

    const { provider, apiKey, baseUrl, model } = llm;
    const memoryHints = memory.learnings?.filter((l) => l.success).slice(-10).map((l) => l.fix).join("\n") || "";
    const systemPrompt = `Você é um engenheiro de QA especializado em ${fw}. Gere APENAS o código do spec, sem explicações.
${memoryHints ? `\nAprendizados anteriores (use como referência):\n${memoryHints.slice(0, 1000)}` : ""}
Retorne SOMENTE o código, sem markdown.`;

    const userPrompt = `Contexto:\n${contextLines}\n\nGere teste para: ${cleanRequest}\nFramework: ${fw}`;

    try {
      let specContent = "";
      if (provider === "gemini") {
        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        });
        const data = await res.json();
        specContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.3,
            max_tokens: 4096,
          }),
        });
        const data = await res.json();
        specContent = data.choices?.[0]?.message?.content || "";
      }
      specContent = specContent.replace(/^```(?:js|javascript|typescript)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      testContent = specContent;

      if (!testFilePath) {
        const fileName = cleanRequest.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
        const { ext, baseDir } = getExtensionAndBaseDir(fw, structure);
        const safeName = fileName + ext;
        testFilePath = path.join(baseDir, safeName);
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
      }
      fs.writeFileSync(testFilePath, testContent, "utf8");
      console.log(`✅ Teste gravado: ${testFilePath}`);

      console.log(`\n[Tentativa ${attempt}/${maxRetries}] Executando teste...`);
      // Playwright interpreta o argumento como regex/glob; caminho absoluto causa "No tests found"
      const runArg = fw === "playwright" ? path.relative(PROJECT_ROOT, testFilePath).replace(/\\/g, "/") : testFilePath;
      const runResult = await new Promise((resolve) => {
        const child = spawn("npx", [fw === "cypress" ? "cypress" : fw === "playwright" ? "playwright" : fw, fw === "cypress" ? "run" : fw === "playwright" ? "test" : "run", runArg], {
          cwd: PROJECT_ROOT,
          stdio: ["inherit", "pipe", "pipe"],
          shell: process.platform === "win32",
        });
        let stdout = "", stderr = "";
        if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });
        if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("close", (code) => resolve({ code, output: [stdout, stderr].filter(Boolean).join("\n") }));
      });

      if (runResult.code === 0) {
        console.log(`\n✅ Teste passou na tentativa ${attempt}!`);
        saveProjectMemory({
          learnings: [{ type: "test_generated", request: cleanRequest, framework: fw, success: true, passedFirstTime: attempt === 1, attempts: attempt, timestamp: new Date().toISOString() }],
        });
        console.log(`\n📊 Aprendizado salvo. Use "mcp-lab-agent stats" para ver métricas.\n`);
        process.exit(0);
      }

      console.log(`\n❌ Teste falhou (exit ${runResult.code})`);
      console.log(`\nSaída:\n${runResult.output.slice(0, 800)}\n`);

      if (attempt >= maxRetries) {
        console.log(`\n❌ Limite de tentativas atingido (${maxRetries}).\n`);
        saveProjectMemory({
          learnings: [{ type: "test_generated", request: cleanRequest, framework: fw, success: false, attempts: attempt, timestamp: new Date().toISOString() }],
        });
        process.exit(1);
      }

      console.log(`\n[Tentativa ${attempt}/${maxRetries}] Analisando falha...`);
      const flakyAnalysis = detectFlakyPatterns(runResult.output);
      if (flakyAnalysis.isLikelyFlaky) {
        console.log(`⚠️ Flaky detectado (${flakyAnalysis.confidence.toFixed(2)}): ${flakyAnalysis.patterns.map((p) => p.pattern).join(", ")}`);
      }

      console.log(`\n[Tentativa ${attempt}/${maxRetries}] Aplicando correção (simulada)...`);
      console.log(`⚠️ Correção automática ainda não implementada nesta versão CLI. Tentando novamente...`);
    } catch (err) {
      console.error(`\n❌ Erro na tentativa ${attempt}: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log(`\n❌ Falhou após ${maxRetries} tentativa(s).\n`);
  process.exit(1);
}

async function handleAnalyzeCommand() {
  console.log("\n🤖 Análise completa iniciada...\n");
  
  const structure = detectProjectStructure();
  console.log("[1/4] 🔍 Detectando estrutura...");
  console.log(`✅ ${structure.testFrameworks.join(", ")} detectado(s)\n`);

  const testFiles = structure.testDirs.flatMap((dir) => {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readdirSync(fullPath, { recursive: true })
      .filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
  });
  console.log(`✅ ${testFiles.length} teste(s) encontrado(s)\n`);

  console.log("[2/4] 🧠 Analisando estabilidade...");
  const stabilityAnalysis = analyzeTestStability();
  const unstableTests = stabilityAnalysis.tests.filter((t) => t.failureRate > 20);
  
  if (unstableTests.length > 0) {
    console.log(`⚠️ ${unstableTests.length} teste(s) instável(is):`);
    unstableTests.slice(0, 3).forEach((t) => {
      console.log(`   - ${t.file}: ${t.failureRate}% de falha (${t.failed}/${t.total} execuções)`);
    });
  } else {
    console.log("✅ Todos os testes são estáveis");
  }
  console.log();

  console.log("[3/4] 🔮 Analisando riscos por área...");
  const codeRisks = analyzeCodeRisks();
  const highRisks = codeRisks.filter((r) => r.risk === "high");
  
  if (highRisks.length > 0) {
    console.log(`🔴 ${highRisks.length} área(s) de RISCO ALTO:`);
    highRisks.slice(0, 3).forEach((r) => {
      console.log(`   - ${r.area}/: ${r.files} arquivo(s) sem testes`);
    });
  } else {
    console.log("✅ Todas as áreas principais têm cobertura");
  }
  console.log();

  console.log("[4/4] 💡 Gerando recomendações...\n");

  const actions = [];
  unstableTests.forEach((t) => {
    actions.push({ priority: "🔴 URGENTE", action: `Refatore ${t.file} (falha ${t.failureRate}%)`, command: `mcp-lab-agent auto "corrigir ${t.file}"` });
  });
  highRisks.forEach((r) => {
    actions.push({ priority: "🔴 URGENTE", action: `Adicione testes para ${r.area}/`, command: `mcp-lab-agent auto "testes para ${r.area}"` });
  });

  let score = 100;
  score -= unstableTests.length * 10;
  score -= highRisks.length * 15;
  score = Math.max(0, score);

  const emoji = score >= 80 ? "🚀" : score >= 60 ? "✅" : "⚠️";

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`${emoji} RELATÓRIO COMPLETO\n`);
  console.log(`Nota: ${score}/100\n`);
  console.log("AÇÕES RECOMENDADAS:\n");
  
  actions.slice(0, 5).forEach((a, i) => {
    console.log(`${i + 1}. ${a.priority}: ${a.action}`);
    console.log(`   → ${a.command}\n`);
  });

  if (actions.length === 0) {
    console.log("✅ Projeto em excelente estado!\n");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}
