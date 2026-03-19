import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { detectProjectStructure, getFrameworkCwd } from "../core/project-structure.js";
import { loadProjectMemory, saveProjectMemory, getMemoryStats, analyzeTestStability } from "../core/memory.js";
import { resolveLLMProvider } from "../core/llm-router.js";
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

  return false;
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
      const runResult = await new Promise((resolve) => {
        const child = spawn("npx", [fw === "cypress" ? "cypress" : fw === "playwright" ? "playwright" : fw, fw === "cypress" ? "run" : fw === "playwright" ? "test" : "run", testFilePath], {
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
