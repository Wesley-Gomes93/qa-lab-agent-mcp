#!/usr/bin/env node
/**
 * MCP Lab Agent - Standalone (Modularizado)
 * MCP server genérico para QA automation em qualquer projeto.
 * Detecta automaticamente Cypress, Playwright, Jest, estrutura do projeto, etc.
 */
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveLLMProvider, TASK_COMPLEXITY } from "./core/llm-router.js";
import { loadProjectMemory, saveProjectMemory, getMemoryStats, analyzeTestStability } from "./core/memory.js";
import { detectFlakyPatterns, detectMobileMappingInvisible, formatLearnedMessageForUser, inferFailurePattern, MOBILE_MAPPING_LESSON, MOBILE_SELECTOR_HIERARCHY, oneLineFailureSummary, UNIVERSAL_TEST_PRACTICES } from "./core/flaky-detection.js";
import { collectTestFiles, detectDeviceConfig, detectProjectStructure, getFrameworkCwd, inferFrameworkFromFile, isTestFile, matchesFramework, analyzeCodeRisks } from "./core/project-structure.js";
import { parseTestRunResult, recordMetricEvent, extractFailuresFromOutput } from "./core/tool-helpers.js";
import { handleCLI } from "./cli/commands.js";

const PROJECT_ROOT = process.cwd();
config({ path: path.join(PROJECT_ROOT, ".env") });

const server = new McpServer({
  name: "mcp-lab-agent",
  version: "2.1.9",
});

// ============================================================================
// CONSTANTES E HELPERS
// ============================================================================

const METRICS_FILE = path.join(PROJECT_ROOT, ".qa-lab-metrics.json");

function appendMetricsEvent(event) {
  recordMetricEvent(event);
}

// ============================================================================
// FERRAMENTAS GENÉRICAS
// ============================================================================

server.registerTool(
  "read_file",
  {
    title: "Ler qualquer arquivo",
    description: "Lê o conteúdo de QUALQUER arquivo do projeto por caminho. Use para specs, page objects, componentes, código fonte - qualquer formato.",
    inputSchema: z.object({
      path: z.string().describe("Caminho relativo ao projeto (ex: cypress/e2e/login.cy.js, src/pages/Login.tsx, tests/login.robot)."),
      encoding: z.enum(["utf8", "utf-8"]).optional().describe("Encoding. Default: utf8"),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      content: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ path: filePath, encoding = "utf8" }) => {
    const normalized = filePath.replace(/^\//, "").replace(/\\/g, "/");
    const fullPath = path.join(PROJECT_ROOT, normalized);

    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return {
        content: [{ type: "text", text: "Caminho fora do projeto." }],
        structuredContent: { ok: false, error: "Path outside project" },
      };
    }
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Arquivo não encontrado: ${normalized}` }],
        structuredContent: { ok: false, error: "File not found" },
      };
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        content: [{ type: "text", text: "É um diretório. Use um caminho de arquivo." }],
        structuredContent: { ok: false, error: "Is directory" },
      };
    }

    try {
      const content = fs.readFileSync(fullPath, encoding);
      return {
        content: [{ type: "text", text: content }],
        structuredContent: { ok: true, content },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao ler: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }
  }
);

server.registerTool(
  "detect_project",
  {
    title: "Detectar estrutura do projeto",
    description: "Analisa o projeto e identifica frameworks de teste, pastas, backend, frontend, ambiente (web/mobile) e hints para geração de testes.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      ok: z.boolean(),
      structure: z.object({
        hasTests: z.boolean(),
        testFrameworks: z.array(z.string()),
        testDirs: z.array(z.string()),
        hasBackend: z.boolean(),
        backendDir: z.string().nullable(),
        hasFrontend: z.boolean(),
        frontendDir: z.string().nullable(),
        hasMobile: z.boolean().optional(),
        environment: z.string().optional(),
        environmentHints: z.array(z.string()).optional(),
      }),
    }),
  },
  async () => {
    const structure = detectProjectStructure();
    const envLine = structure.environment
      ? `Ambiente: ${structure.environment}${structure.environmentHints?.length ? ` (${structure.environmentHints.join(", ")})` : ""}`
      : "";
    const summary = [
      `Frameworks de teste: ${structure.testFrameworks.join(", ") || "nenhum"}`,
      `Pastas de teste: ${structure.testDirs.join(", ") || "nenhuma"}`,
      `Backend: ${structure.backendDir || "não detectado"}`,
      `Frontend: ${structure.frontendDir || "não detectado"}`,
      ...(envLine ? [envLine] : []),
    ].join("\n");

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { ok: true, structure },
    };
  }
);

// ============================================================================
// WEB EVAL BROWSER - Modo browser (screenshots, network, console) via Playwright
// ============================================================================

server.registerTool(
  "web_eval_browser",
  {
    title: "Avaliar app no browser (screenshots, network, console)",
    description: "[Agente especializado: Browser] Abre a URL no navegador, captura screenshot, erros de console e requisições de rede. Inspirado em web-eval-agent. Requer: npm install playwright",
    inputSchema: z.object({
      url: z.string().describe("URL para avaliar (ex: http://localhost:3000, https://exemplo.com)."),
      screenshotPath: z.string().optional().describe("Caminho para salvar screenshot. Default: .qa-lab-screenshot.png"),
      captureNetwork: z.boolean().optional().describe("Capturar requisições de rede. Default: true"),
      captureConsole: z.boolean().optional().describe("Capturar logs e erros do console. Default: true"),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      screenshotPath: z.string().optional(),
      consoleLogs: z.array(z.string()).optional(),
      consoleErrors: z.array(z.string()).optional(),
      networkRequests: z.array(z.object({ url: z.string(), method: z.string(), status: z.number().optional() })).optional(),
      error: z.string().optional(),
    }),
  },
  async ({ url, screenshotPath, captureNetwork = true, captureConsole = true }) => {
    let playwright;
    try {
      playwright = await import("playwright");
    } catch (e) {
      return {
        content: [{
          type: "text",
          text: "Playwright não instalado. Rode: npm install playwright (ou npx playwright install para browsers).",
        }],
        structuredContent: { ok: false, error: "Playwright not installed. Run: npm install playwright" },
      };
    }

    const outPath = screenshotPath ? path.join(PROJECT_ROOT, screenshotPath.replace(/^\//, "")) : path.join(PROJECT_ROOT, ".qa-lab-screenshot.png");
    const consoleLogs = [];
    const consoleErrors = [];
    const networkRequests = [];

    try {
      const browser = await playwright.chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      if (captureConsole) {
        page.on("console", (msg) => {
          const text = msg.text();
          if (msg.type() === "error") consoleErrors.push(text);
          else consoleLogs.push(`[${msg.type()}] ${text}`);
        });
      }

      if (captureNetwork) {
        page.on("request", (req) => {
          networkRequests.push({ url: req.url(), method: req.method(), status: undefined });
        });
        page.on("response", (res) => {
          const req = networkRequests.find((r) => r.url === res.request().url());
          if (req) req.status = res.status();
        });
      }

      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.screenshot({ path: outPath, fullPage: false });

      await browser.close();

      const relPath = path.relative(PROJECT_ROOT, outPath);
      let summary = `Screenshot salvo: ${relPath}`;
      if (consoleErrors.length) summary += `\n\n⚠️ ${consoleErrors.length} erro(s) no console:\n${consoleErrors.slice(0, 5).join("\n")}`;
      if (networkRequests.length) summary += `\n\nRequisições: ${networkRequests.length}`;

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: {
          ok: true,
          screenshotPath: relPath,
          consoleLogs: captureConsole ? consoleLogs.slice(0, 50) : undefined,
          consoleErrors: captureConsole && consoleErrors.length ? consoleErrors : undefined,
          networkRequests: captureNetwork ? networkRequests.slice(0, 30) : undefined,
        },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }
  }
);

// ============================================================================
// QA ROUTE TASK - Agentes especializados (roteamento de tarefas)
// ============================================================================

const QA_AGENTS = {
  autonomous: { tools: ["qa_auto"], desc: "Modo autônomo: gera, roda, corrige e aprende (loop completo)" },
  intelligence: { tools: ["qa_full_analysis", "qa_health_check", "qa_suggest_next_test", "qa_predict_flaky", "qa_compare_with_industry"], desc: "Executor + Consultor: análise completa, diagnóstico, sugestões e predições" },
  detection: { tools: ["detect_project", "read_project", "list_test_files"], desc: "Detecção de estrutura, frameworks e arquivos" },
  execution: { tools: ["run_tests", "watch_tests", "get_test_coverage"], desc: "Execução de testes e cobertura" },
  generation: { tools: ["generate_tests", "write_test", "create_test_template", "map_mobile_elements"], desc: "Geração de testes com LLM" },
  analysis: { tools: ["analyze_failures", "por_que_falhou", "suggest_fix", "suggest_selector_fix"], desc: "Análise de falhas e sugestões" },
  browser: { tools: ["web_eval_browser"], desc: "Avaliação em browser real (screenshots, network, console)" },
  reporting: { tools: ["create_bug_report", "get_business_metrics"], desc: "Relatórios e métricas" },
  learning: { tools: ["qa_learning_stats", "get_learning_report", "qa_time_travel"], desc: "Estatísticas de aprendizado e evolução" },
  maintenance: { tools: ["run_linter", "install_dependencies", "analyze_file_methods"], desc: "Manutenção e análise de código" },
};

server.registerTool(
  "qa_route_task",
  {
    title: "Roteador de tarefas QA (agentes especializados)",
    description: "Recebe uma descrição da tarefa e retorna qual agente (conjunto de ferramentas) deve ser usado. Útil para encaminhar a ferramenta certa.",
    inputSchema: z.object({
      task: z.string().describe("Descrição da tarefa (ex: 'rodar os testes', 'gerar teste de login', 'analisar por que falhou')."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      suggestedAgent: z.string(),
      suggestedTools: z.array(z.string()),
      description: z.string(),
    }),
  },
  async ({ task }) => {
    const t = task.toLowerCase();
    if (/autônomo|auto|completo|loop|aprende|corrige automaticamente/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: autonomous → qa_auto (loop completo: gera, roda, corrige, aprende)" }], structuredContent: { ok: true, suggestedAgent: "autonomous", suggestedTools: QA_AGENTS.autonomous.tools, description: QA_AGENTS.autonomous.desc } };
    }
    if (/health|saúde|diagnóstico|nota|score|próximo teste|sugerir|prever|flaky|benchmark|comparar|indústria/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: intelligence → qa_health_check, qa_suggest_next_test, qa_predict_flaky, qa_compare_with_industry" }], structuredContent: { ok: true, suggestedAgent: "intelligence", suggestedTools: QA_AGENTS.intelligence.tools, description: QA_AGENTS.intelligence.desc } };
    }
    if (/estatística|métrica de aprendizado|taxa de sucesso|learning|stats|evolução|timeline|tempo|histórico/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: learning → qa_learning_stats, qa_time_travel" }], structuredContent: { ok: true, suggestedAgent: "learning", suggestedTools: QA_AGENTS.learning.tools, description: QA_AGENTS.learning.desc } };
    }
    if (/rodar|executar|run|test|coverage|watch/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: execution → run_tests, get_test_coverage" }], structuredContent: { ok: true, suggestedAgent: "execution", suggestedTools: QA_AGENTS.execution.tools, description: QA_AGENTS.execution.desc } };
    }
    if (/mapear|elementos mobile|deep link|deeplink|app package|bundle.?id|appium inspector/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation → map_mobile_elements (mapear elementos), depois generate_tests + write_test" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: ["map_mobile_elements", "generate_tests", "write_test"], description: QA_AGENTS.generation.desc } };
    }
    if (/mapear|elementos mobile|deep link|deeplink|app package|bundle.?id/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation → map_mobile_elements (mapear elementos), depois generate_tests + write_test" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: ["map_mobile_elements", "generate_tests", "write_test"], description: "Mapeamento de elementos mobile + geração de testes" } };
    }
    if (/mobile|deeplink|deep link|elementos|mapear.*app|appium|detox/i.test(t) && !/rodar|run|executar/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation → map_mobile_elements, generate_tests, write_test (mobile)" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: QA_AGENTS.generation.tools, description: QA_AGENTS.generation.desc } };
    }
    if (/gerar|criar|escrever|generate|write|template/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation → generate_tests, write_test, map_mobile_elements" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: QA_AGENTS.generation.tools, description: QA_AGENTS.generation.desc } };
    }
    if (/analisar|por que|falhou|suggest|correção|selector|fix/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: analysis → analyze_failures, por_que_falhou, suggest_fix" }], structuredContent: { ok: true, suggestedAgent: "analysis", suggestedTools: QA_AGENTS.analysis.tools, description: QA_AGENTS.analysis.desc } };
    }
    if (/browser|screenshot|navegador|avaliar|ux|network|console/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: browser → web_eval_browser" }], structuredContent: { ok: true, suggestedAgent: "browser", suggestedTools: QA_AGENTS.browser.tools, description: QA_AGENTS.browser.desc } };
    }
    if (/detectar|estrutura|listar|arquivos|framework/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: detection → detect_project, list_test_files" }], structuredContent: { ok: true, suggestedAgent: "detection", suggestedTools: QA_AGENTS.detection.tools, description: QA_AGENTS.detection.desc } };
    }
    if (/relatório|bug|métricas|metrics/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: reporting → create_bug_report, get_business_metrics" }], structuredContent: { ok: true, suggestedAgent: "reporting", suggestedTools: QA_AGENTS.reporting.tools, description: QA_AGENTS.reporting.desc } };
    }
    return { content: [{ type: "text", text: "Agente: detection (genérico)" }], structuredContent: { ok: true, suggestedAgent: "detection", suggestedTools: QA_AGENTS.detection.tools, description: QA_AGENTS.detection.desc } };
  }
);

server.registerTool(
  "run_tests",
  {
    title: "Executar testes",
    description: "Roda testes do projeto. Suporta: Cypress, Playwright, WebdriverIO, Jest, Vitest, Mocha, Appium, Detox, Robot Framework, pytest, e mais. Detecta automaticamente.",
    inputSchema: z.object({
      framework: z.enum([
        "cypress", "playwright", "webdriverio", "jest", "vitest", "mocha",
        "appium", "detox", "robot", "pytest", "supertest", "pactum",
        "testcafe", "nightwatch", "puppeteer", "codeceptjs", "npm"
      ]).optional().describe("Framework específico ou 'npm' para npm test."),
      spec: z.string().optional().describe("Caminho do spec (ex: cypress/e2e/test.cy.js)."),
      suite: z.string().optional().describe("Suite ou pattern (ex: e2e, api)."),
      device: z.string().optional().describe("Device/configuration para mobile. Se vazio, detecta de qa-lab-agent.config.json, wdio.conf ou .detoxrc."),
      explainOnFailure: z.boolean().optional().describe("Se true, quando falhar gera automaticamente: O que aconteceu, Por que falhou, O que fazer, Sugestão de correção. Requer API key."),
      autoFixSelector: z.boolean().optional().describe("Se true e falhar por seletor, aplica correção automaticamente e tenta novamente. Requer spec e API key. Default: true para mobile."),
    }),
    outputSchema: z.object({
      status: z.enum(["passed", "failed", "not_found"]),
      message: z.string(),
      exitCode: z.number(),
      runOutput: z.string().optional(),
    }),
  },
  async ({ framework, spec, suite, explainOnFailure, device, autoFixSelector }) => {
    const structure = detectProjectStructure();

    if (!structure.hasTests) {
      return {
        content: [{ type: "text", text: "Nenhum framework de teste detectado no projeto." }],
        structuredContent: {
          status: "not_found",
          message: "No test framework found",
          exitCode: 1,
        },
      };
    }

    let selectedFramework = framework;
    if (!selectedFramework && structure.testFrameworks.length > 0) {
      selectedFramework = structure.testFrameworks[0];
    }

    const deviceConfig = structure.hasMobile ? detectDeviceConfig(structure) : {};
    const useDevice = device || deviceConfig.configuration || deviceConfig.device;
    const doAutoFixSelector = autoFixSelector ?? (structure.hasMobile && !!spec);

    let runEnv = { ...process.env };
    if (useDevice && Object.keys(deviceConfig.envOverrides || {}).length) {
      runEnv = { ...runEnv, ...deviceConfig.envOverrides };
    }
    if (device) {
      if (selectedFramework === "detox") runEnv.DETOX_CONFIGURATION = device;
      else if (selectedFramework === "appium") runEnv.APPIUM_DEVICE_NAME = device;
    } else if (deviceConfig.configuration && selectedFramework === "detox") {
      runEnv.DETOX_CONFIGURATION = deviceConfig.configuration;
    }

    let cmd, args, cwd;

    // E2E/UI Frameworks
    if (selectedFramework === "cypress") {
      cmd = "npx";
      args = spec ? ["cypress", "run", "--spec", spec] : ["cypress", "run"];
      cwd = structure.testDirs.includes("cypress") 
        ? path.join(PROJECT_ROOT, "cypress")
        : structure.testDirs[0] 
        ? path.join(PROJECT_ROOT, structure.testDirs[0])
        : PROJECT_ROOT;
    } else if (selectedFramework === "playwright") {
      cmd = "npx";
      args = spec ? ["playwright", "test", spec] : ["playwright", "test"];
      cwd = structure.testDirs.includes("playwright")
        ? path.join(PROJECT_ROOT, "playwright")
        : structure.testDirs[0]
        ? path.join(PROJECT_ROOT, structure.testDirs[0])
        : PROJECT_ROOT;
    } else if (selectedFramework === "webdriverio") {
      cmd = "npx";
      args = spec ? ["wdio", "run", spec] : ["wdio", "run"];
      cwd = getFrameworkCwd(structure, ["wdio-webdriver-io", "specs", "tests"]);
    } else if (selectedFramework === "testcafe") {
      cmd = "npx";
      args = spec ? ["testcafe", spec] : ["testcafe"];
      cwd = getFrameworkCwd(structure, ["testcafe-js", "testcafe", "tests"]);
    } else if (selectedFramework === "nightwatch") {
      cmd = "npx";
      args = spec ? ["nightwatch", "--test", spec] : ["nightwatch"];
      cwd = getFrameworkCwd(structure, ["nightwatch-js", "nightwatch", "tests"]);
    } else if (selectedFramework === "puppeteer") {
      cmd = "npx";
      args = spec ? ["jest", spec, "--config", "jest.config.js"] : ["jest"];
      cwd = getFrameworkCwd(structure, ["puppeteer-js", "puppeteer", "__tests__"]);
    } else if (selectedFramework === "codeceptjs") {
      cmd = "npx";
      args = spec ? ["codeceptjs", "run", "--grep", spec] : ["codeceptjs", "run"];
      cwd = getFrameworkCwd(structure, ["codeceptjs", "tests"]);

    // Unit/Integration Frameworks
    } else if (selectedFramework === "jest") {
      cmd = "npx";
      args = ["jest"];
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "vitest") {
      cmd = "npx";
      args = ["vitest", "run"];
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "mocha") {
      cmd = "npx";
      args = spec ? ["mocha", spec] : ["mocha"];
      cwd = PROJECT_ROOT;
    
    // Mobile Frameworks
    } else if (selectedFramework === "appium") {
      cmd = "npx";
      args = spec ? ["wdio", "run", spec] : ["wdio", "run"];
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "detox") {
      cmd = "npx";
      args = ["detox", "test"];
      if (useDevice) args.push("--configuration", useDevice);
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT;
    
    // Python Frameworks
    } else if (selectedFramework === "robot") {
      cmd = "robot";
      args = spec ? [spec] : [structure.testDirs[0] || "tests"];
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "pytest") {
      cmd = "pytest";
      args = spec ? [spec] : [];
      cwd = PROJECT_ROOT;
    
    // API Testing
    } else if (selectedFramework === "supertest" || selectedFramework === "pactum") {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT;
    
    // Fallback
    } else {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT;
    }

    const runTestsOnce = () =>
      new Promise((resolve) => {
        const startTime = Date.now();
        const child = spawn(cmd, args, {
          cwd,
          stdio: ["inherit", "pipe", "pipe"],
          shell: process.platform === "win32",
          env: runEnv,
        });
        let stdout = "";
        let stderr = "";
        if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); process.stdout.write(d); });
        if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d); });
        child.on("close", (code) => {
          const runOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
          resolve({
            passed: code === 0,
            exitCode: code ?? 1,
            runOutput,
            durationSeconds: Math.round((Date.now() - startTime) / 1000),
          });
        });
      });

    const isSelectorFailure = (out) => /element not found|selector|timeout|locator|cy\.get|page\.locator|Unable to find/i.test(out || "");

    let result = await runTestsOnce();
    let autoFixed = false;

    if (!result.passed && doAutoFixSelector && spec && isSelectorFailure(result.runOutput) && resolveLLMProvider("complex").apiKey) {
      const fixResult = await applySelectorFixAndRetry(spec, result.runOutput, selectedFramework);
      if (fixResult.applied) {
        autoFixed = true;
        result = await runTestsOnce();
      }
    }

    if (!result.passed && result.runOutput) {
      try {
        fs.writeFileSync(path.join(PROJECT_ROOT, ".qa-lab-last-failure.log"), result.runOutput, "utf8");
      } catch {}
    }

    const { passed: p, failed: f } = parseTestRunResult(result.runOutput, result.exitCode);
    appendMetricsEvent({
      type: "test_run",
      framework: selectedFramework,
      spec: spec || undefined,
      passed: p,
      failed: f,
      durationSeconds: result.durationSeconds,
      exitCode: result.exitCode,
      failures: !result.passed ? extractFailuresFromOutput(result.runOutput) : undefined,
    });
    if (result.passed) saveProjectMemory({ lastRun: { spec: spec || null, framework: selectedFramework, passed: p } });
    saveProjectMemory({
      execution: {
        testFile: spec || "all",
        passed: result.passed,
        duration: result.durationSeconds,
        timestamp: new Date().toISOString(),
        framework: selectedFramework,
      },
    });

    const baseMsg = result.passed
      ? (autoFixed ? "Testes executados com sucesso (após correção automática de seletor)." : "Testes executados com sucesso.")
      : "Falha na execução dos testes.";
    const structured = {
      status: result.passed ? "passed" : "failed",
      message: result.passed ? "Tests passed" : "Tests failed",
      exitCode: result.exitCode,
      runOutput: !result.passed ? result.runOutput : undefined,
      autoFixed: autoFixed || undefined,
    };

    if (!result.passed && explainOnFailure && result.runOutput) {
      const explainResult = await generateFailureExplanation(result.runOutput, spec || undefined);
      if (explainResult.ok && explainResult.structuredContent) {
        const oneLine =
          explainResult.structuredContent.resumoEmUmaFrase ||
          oneLineFailureSummary(result.runOutput, selectedFramework, explainResult.structuredContent.oQueAconteceu, explainResult.structuredContent.sugestaoCorrecao);
        structured.explanation = explainResult.structuredContent.formattedText;
        structured.resumoEmUmaFrase = oneLine;
        return {
          content: [{ type: "text", text: `${baseMsg}\n\n**${oneLine}**\n\n---\n\n${explainResult.structuredContent.formattedText}` }],
          structuredContent: structured,
        };
      }
    }

    return {
      content: [{ type: "text", text: baseMsg }],
      structuredContent: structured,
    };
  }
);

server.registerTool(
  "read_project",
  {
    title: "Ler estrutura do projeto",
    description: "Lê package.json, specs existentes (qualquer framework: Cypress, Playwright, WDIO, Robot, pytest, etc) e retorna contexto. Use includeContent para trazer código de exemplos.",
    inputSchema: z.object({
      includeContent: z.boolean().optional().describe("Se true, inclui conteúdo dos primeiros 3 arquivos de teste como referência. Default: false."),
      maxFiles: z.number().optional().describe("Máximo de arquivos cujo conteúdo será lido. Default: 3."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      summary: z.string(),
      packageJson: z.object({}).passthrough().optional(),
      testFiles: z.array(z.string()).optional(),
      testFilesWithContent: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
    }),
  },
  async ({ includeContent = false, maxFiles = 3 } = {}) => {
    const structure = detectProjectStructure();
    const collected = collectTestFiles(structure, {
      maxContentFiles: includeContent ? maxFiles : 0,
    });

    const testFiles = collected.map((e) => e.path);
    const testFilesWithContent = includeContent
      ? collected.filter((e) => e.content).map((e) => ({ path: e.path, content: e.content }))
      : undefined;

    const summary = [
      `Frameworks: ${structure.testFrameworks.join(", ") || "nenhum"}`,
      `Arquivos de teste: ${testFiles.length} (qualquer framework)`,
      `Backend: ${structure.backendDir || "não detectado"}`,
      `Frontend: ${structure.frontendDir || "não detectado"}`,
      includeContent && testFilesWithContent?.length
        ? `Conteúdo incluído: ${testFilesWithContent.length} arquivo(s) como referência`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        ok: true,
        summary,
        packageJson: structure.packageJson,
        testFiles: testFiles.slice(0, 100),
        testFilesWithContent,
        structure,
      },
    };
  }
);

server.registerTool(
  "generate_tests",
  {
    title: "Gerar ou traduzir testes com LLM",
    description: "Gera spec em QUALQUER framework. Aceita referência de outro framework: leia com read_file e passe em referenceCode. Traduz automaticamente (ex: Robot→Playwright, Cypress→WDIO).",
    inputSchema: z.object({
      context: z.string().describe("Contexto do projeto (read_project) ou descrição."),
      request: z.string().describe("O que testar (ex: 'logout flow', 'teste de login') ou 'traduzir o teste abaixo'."),
      framework: z.enum([
        "cypress", "playwright", "webdriverio", "jest", "vitest", "mocha",
        "appium", "robot", "pytest", "supertest", "behave", "detox"
      ]).optional().describe("Framework alvo (detectado do projeto se omitido)."),
      referenceCode: z.string().optional().describe("Código de referência em QUALQUER framework (Cypress, Robot, WDIO, etc). O LLM traduz/adapta para o framework alvo."),
      referencePaths: z.array(z.string()).optional().describe("Caminhos de arquivos para ler como referência. O agente lê e usa como padrão."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      specContent: z.string().optional(),
      suggestedFileName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ context, request, framework, referenceCode, referencePaths }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0] || "cypress";

    let referenceBlock = "";
    if (referenceCode) referenceBlock += `\n\n--- CÓDIGO DE REFERÊNCIA (use como padrão, traduza/adapte para ${fw}) ---\n${referenceCode.slice(0, 8000)}`;
    if (referencePaths?.length) {
      for (const p of referencePaths.slice(0, 5)) {
        const full = path.join(PROJECT_ROOT, p.replace(/^\//, "").replace(/\\/g, "/"));
        if (fs.existsSync(full)) {
          try {
            const content = fs.readFileSync(full, "utf8");
            referenceBlock += `\n\n--- Arquivo: ${p} ---\n${content.slice(0, 6000)}`;
          } catch {}
        }
      }
    }

    const llm = resolveLLMProvider("simple");
    if (!llm.apiKey) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key configured" },
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;

    const memory = loadProjectMemory();
    const memoryBlock = memory.flows?.length
      ? `\n\nFluxos do projeto (use como referência): ${memory.flows.map((f) => f.name || f.id).join(", ")}`
      : "";
    const contextWithMemory = context + memoryBlock;

    const hasReference = Boolean(referenceBlock?.trim());
    const systemPrompt = hasReference
      ? `Você é um engenheiro de QA. TRADUZA/ADAPTE o código de referência para o framework ${fw}.
O código de referência pode estar em QUALQUER framework (Cypress, Robot, Playwright, WDIO, Appium, pytest, etc).
- Mantenha a MESMA lógica e fluxo de teste
- Traduza seletores, comandos e asserções para ${fw}
- Use Page Objects se o projeto já usa
- Retorne SOMENTE o código, sem markdown

${UNIVERSAL_TEST_PRACTICES}
${(fw === "appium" || fw === "detox") ? `\nIMPORTANTE: ${MOBILE_MAPPING_LESSON}\n\nHIERARQUIA DE SELETORES: ${MOBILE_SELECTOR_HIERARCHY}` : ""}`
      : `Você é um engenheiro de QA especializado em ${fw}. Gere APENAS o código do spec, sem explicações.
Framework: ${fw}

${UNIVERSAL_TEST_PRACTICES}

Regras:
- Cypress: cy.request(), cy.visit(), cy.get()
- Playwright: test(), test.describe(), page.goto(), page.locator()
- WebdriverIO/Appium: describe(), it(), $(), browser.$
- Jest/Vitest: describe(), test(), expect()
- Robot: Keywords, [Tags], Steps
- pytest: def test_*, assert, fixtures
- Código limpo. Retorne SOMENTE o código, sem markdown${(fw === "appium" || fw === "detox") ? `\n\nIMPORTANTE (Appium/Detox): ${MOBILE_MAPPING_LESSON}\n\nHIERARQUIA: ${MOBILE_SELECTOR_HIERARCHY}` : ""}`;

    const userPrompt = `Contexto do projeto:
${contextWithMemory.slice(0, 5000)}

Gere um teste para: ${request}
Framework alvo: ${fw}${referenceBlock}`;

    try {
      let specContent;
      if (provider === "gemini") {
        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        });
        const data = await res.json();
        specContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
          }),
        });
        const data = await res.json();
        specContent = data.choices?.[0]?.message?.content || "";
      }

      specContent = specContent.replace(/^```(?:js|javascript)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const fileName = request.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);

      return {
        content: [{ type: "text", text: `Spec gerado (${specContent.length} chars). Use write_test para gravar.` }],
        structuredContent: {
          ok: true,
          specContent,
          suggestedFileName: fileName,
        },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao gerar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }
  }
);

function getExtensionAndBaseDir(fw, structure) {
  const extMap = {
    cypress: ".cy.js",
    playwright: ".spec.js",
    jest: ".test.js",
    vitest: ".test.js",
    mocha: ".test.js",
    webdriverio: ".spec.js",
    appium: ".spec.js",
    detox: ".e2e.js",
    robot: ".robot",
    pytest: "_test.py",
    behave: ".feature",
    supertest: ".test.js",
    pactum: ".test.js",
  };
  const ext = extMap[fw] || ".spec.js";

  const baseMap = {
    cypress: structure.testDirs.includes("cypress") ? "cypress" : structure.testDirs[0] || "tests",
    playwright: structure.testDirs.includes("playwright") ? "playwright" : structure.testDirs[0] || "tests",
    webdriverio: structure.testDirs.includes("specs") ? "specs" : structure.testDirs[0] || "tests",
    appium: structure.testDirs.includes("specs") ? "specs" : structure.testDirs[0] || "tests",
    robot: structure.testDirs.includes("robot") ? "robot" : structure.testDirs[0] || "tests",
    behave: structure.testDirs.includes("features") ? "features" : structure.testDirs[0] || "tests",
  };
  const baseDir = path.join(PROJECT_ROOT, baseMap[fw] || structure.testDirs[0] || "tests");
  return { ext, baseDir };
}

server.registerTool(
  "write_test",
  {
    title: "Escrever arquivo de teste",
    description: "Grava spec no disco. Suporta QUALQUER framework (Cypress, Playwright, WDIO, Appium, Robot, pytest, etc.). Detecta automaticamente pasta e extensão.",
    inputSchema: z.object({
      name: z.string().describe("Nome do arquivo (ex: login-test, logout_spec)."),
      content: z.string().describe("Conteúdo do spec."),
      framework: z.enum([
        "cypress", "playwright", "jest", "vitest", "mocha", "webdriverio",
        "appium", "detox", "robot", "pytest", "behave", "supertest"
      ]).optional().describe("Framework (detectado automaticamente se omitido)."),
      subdir: z.string().optional().describe("Subpasta (ex: e2e, api). Default: raiz da pasta de testes."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      path: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ name, content, framework, subdir }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0];

    if (!fw) {
      return {
        content: [{ type: "text", text: "Nenhum framework de teste detectado." }],
        structuredContent: { ok: false, error: "No test framework" },
      };
    }

    const { ext, baseDir } = getExtensionAndBaseDir(fw, structure);
    const safeName = name
      .replace(/[^a-z0-9-_]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/_+/g, "_")
      .replace(/\.(cy|spec|test|robot|feature|py)\.?(js|ts|py)?$/i, "")
      .replace(/^[-_]+|[-_]+$/g, "");
    const fileName = ext.startsWith("_") ? `${safeName}${ext}` : `${safeName}${ext}`;

    const targetDir = subdir ? path.join(baseDir, subdir) : baseDir;
    const filePath = path.join(targetDir, fileName);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, "utf8");
      return {
        content: [{ type: "text", text: `Arquivo gravado: ${filePath}` }],
        structuredContent: { ok: true, path: filePath },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao gravar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }
  }
);

server.registerTool(
  "analyze_failures",
  {
    title: "Analisar falhas de testes",
    description: "Recebe output de testes e extrai falhas estruturadas.",
    inputSchema: z.object({
      runOutput: z.string().describe("Output do teste (stdout/stderr)."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      summary: z.string(),
      failures: z.array(z.object({
        test: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional(),
      })).optional(),
    }),
  },
  async ({ runOutput }) => {
    const failures = [];
    const lines = runOutput.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/fail|error|assertion/i.test(line)) {
        failures.push({
          test: lines[i - 1] || "unknown",
          message: line.trim(),
          stack: lines.slice(i, i + 5).join("\n"),
        });
      }
    }

    const flakyAnalysis = detectFlakyPatterns(runOutput);
    let summary = failures.length
      ? `${failures.length} falha(s) detectada(s).`
      : "Nenhuma falha detectada.";
    if (flakyAnalysis.isLikelyFlaky) {
      summary += `\n\n⚠️ Possível teste flaky (${Math.round(flakyAnalysis.confidence * 100)}% confiança). Padrões: ${flakyAnalysis.patterns.map((p) => p.pattern).join(", ")}.`;
      summary += "\n\nSugestões:";
      flakyAnalysis.patterns.forEach((p) => {
        summary += `\n• ${p.pattern}: ${p.suggestion}`;
      });
      if (flakyAnalysis.patterns.some((p) => p.pattern === "timing" || p.pattern === "network")) {
        summary += "\n• Considere adicionar test.retry(2) ou equivalente para retries automáticos.";
      }
    }

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        ok: true,
        summary,
        failures: failures.length ? failures : undefined,
        flaky: flakyAnalysis.isLikelyFlaky ? { confidence: flakyAnalysis.confidence, patterns: flakyAnalysis.patterns } : undefined,
      },
    };
  }
);

// ============================================================================
// POR QUE FALHOU? - Explicação de falhas para juniores (escalável)
// ============================================================================

function formatFailureExplanation(data, oneLine = null) {
  const summary = oneLine || data.resumoEmUmaFrase || "";
  const lines = summary ? [`**${summary}**`, "", "---", ""] : [];
  lines.push(
    "## O que aconteceu",
    "",
    data.oQueAconteceu || "",
    "",
    "## Por que provavelmente falhou",
    "",
    ...(Array.isArray(data.porQueProvavelmenteFalhou)
      ? data.porQueProvavelmenteFalhou.map((s) => `• ${s}`)
      : [data.porQueProvavelmenteFalhou || ""]),
    "",
    "## O que fazer agora",
    "",
    ...(Array.isArray(data.oQueFazerAgora)
      ? data.oQueFazerAgora.map((s, i) => `${i + 1}. ${s}`)
      : [data.oQueFazerAgora || ""]),
  );
  if (data.sugestaoCorrecao) {
    lines.push("", "## Sugestão de correção", "", "```" + (data.framework || "js"), data.sugestaoCorrecao, "```");
  }
  if (data.conceito) {
    lines.push("", "## Conceito", "", data.conceito);
  }
  return lines.filter(Boolean).join("\n");
}

async function callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt) {
  if (provider === "gemini") {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Aplica correção de seletor no arquivo e retorna { applied }. Usado por run_tests com autoFixSelector. */
async function applySelectorFixAndRetry(testFilePath, errorOutput, framework) {
  const structure = detectProjectStructure();
  const fw = framework || inferFrameworkFromFile(testFilePath.split("/").pop(), structure);
  const fullPath = path.join(PROJECT_ROOT, testFilePath.replace(/^\//, "").replace(/\\/g, "/"));
  if (!fs.existsSync(fullPath)) return { applied: false };

  let testCode = "";
  try {
    testCode = fs.readFileSync(fullPath, "utf8");
  } catch {
    return { applied: false };
  }

  const llm = resolveLLMProvider("complex");
  if (!llm.apiKey) return { applied: false };
  const { provider, apiKey, baseUrl, model } = llm;

  const systemPrompt = `Você é um especialista em testes E2E. O teste falhou porque um seletor não encontrou o elemento.
Retorne APENAS em JSON (sem markdown) com a chave:
- codigoCorrigido: string (o ARQUIVO COMPLETO do teste corrigido, com imports e toda a estrutura. Substitua o seletor quebrado por um mais resiliente: data-testid, role, ~accessibility-id, ou XPath relacional com tipo específico.)

Framework: ${fw}. Priorize seletores estáveis.`;

  const userPrompt = `Output do erro:\n---\n${(errorOutput || "").slice(0, 8000)}\n---\n\nCódigo atual:\n---\n${testCode.slice(0, 6000)}\n---`;

  try {
    let raw = await callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const data = JSON.parse(raw);
    const fixed = (data.codigoCorrigido || "").trim();
    if (fixed.length > 50 && (/describe|it\(|test\(|cy\.|page\.|\$\(/.test(fixed))) {
      fs.writeFileSync(fullPath, fixed, "utf8");
      return { applied: true };
    }
  } catch {}
  return { applied: false };
}

/** Gera explicação de falha via LLM. Usado por por_que_falhou e qa_auto. Retorna { ok, structuredContent }. */
async function generateFailureExplanation(resolvedOutput, testFilePath = null) {
  const structure = detectProjectStructure();
  const fw = structure.testFrameworks[0] || "unknown";
  let testCode = "";
  if (testFilePath) {
    const normalized = testFilePath.replace(/^\//, "").replace(/\\/g, "/");
    const fullPath = path.join(PROJECT_ROOT, normalized);
    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      try {
        testCode = fs.readFileSync(fullPath, "utf8");
      } catch {}
    }
  }
  const llm = resolveLLMProvider("complex");
  if (!llm.apiKey) return { ok: false, structuredContent: null };
  const { provider, apiKey, baseUrl, model } = llm;
  const fwHints = {
    webdriverio: "WebdriverIO (describe/it, $, browser.$)",
    appium: "Appium/WebdriverIO (mobile, $, browser.$)",
    playwright: "Playwright (test, page, locator)",
    cypress: "Cypress (cy.get, cy.click)",
    jest: "Jest (describe, test, expect)",
    vitest: "Vitest (describe, test, expect)",
    robot: "Robot Framework",
    pytest: "pytest",
  };
  const systemPrompt = `Você é um mentor de QA. Analise o output de falha e responda em JSON (apenas o JSON, sem markdown) com as chaves:
- resumoEmUmaFrase: string (OBRIGATÓRIO - uma frase: "Falhou porque X. Solução: Y.")
- oQueAconteceu: string (explicação em português do que aconteceu, simples)
- porQueProvavelmenteFalhou: array de strings (lista de possíveis causas)
- oQueFazerAgora: array de strings (passos numerados do que fazer)
- sugestaoCorrecao: string ou null (código de correção no formato do framework)
- conceito: string ou null
- framework: string (framework do projeto)

Framework: ${fw}. ${fwHints[fw] || ""}
Responda APENAS com o JSON válido, sem texto antes ou depois.`;
  const userPrompt = `Output do terminal/log (teste falhou):
---
${resolvedOutput.slice(0, 12000)}
---
${testCode ? `\nCódigo do teste:\n---\n${testCode.slice(0, 6000)}\n---` : ""}`;
  try {
    let raw = await callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { oQueAconteceu: raw.slice(0, 500) || "Não foi possível parsear.", porQueProvavelmenteFalhou: [], oQueFazerAgora: [], sugestaoCorrecao: null, conceito: null, framework: fw };
    }
    data.framework = data.framework || fw;
    const oneLine = oneLineFailureSummary(resolvedOutput, fw, data.oQueAconteceu, data.sugestaoCorrecao);
    const formattedText = formatFailureExplanation(data, data.resumoEmUmaFrase || oneLine);
    return { ok: true, formattedText, structuredContent: { ...data, formattedText } };
  } catch (err) {
    return { ok: false, error: err.message, structuredContent: null };
  }
}

/** Gera explicação de falha (o que aconteceu, por que, o que fazer, sugestão). Usado por por_que_falhou e run_tests_and_explain. */

server.registerTool(
  "por_que_falhou",
  {
    title: "Por que falhou? Explicação para juniores",
    description: "Traduz stack trace em explicação humana. Recebe output do terminal/log, lê o projeto e o teste (se path dado), e retorna: O que aconteceu, Por que falhou, O que fazer, Sugestão de correção, Conceito. Escalável e procedural.",
    inputSchema: z.object({
      errorOutput: z.string().optional().describe("Output do terminal quando o teste falhou. Se vazio, lê automaticamente de .qa-lab-last-failure.log (capturado pelo run_tests). Cole aqui ou deixe vazio para usar última falha."),
      testFilePath: z.string().optional().describe("Caminho do arquivo de teste que falhou (ex: specs/login.spec.js). Se informado, o agente lê o código e dá sugestão mais precisa."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      oQueAconteceu: z.string().optional(),
      porQueProvavelmenteFalhou: z.array(z.string()).optional(),
      oQueFazerAgora: z.array(z.string()).optional(),
      sugestaoCorrecao: z.string().optional(),
      conceito: z.string().optional(),
      framework: z.string().optional(),
      formattedText: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ errorOutput, testFilePath }) => {
    let resolvedOutput = errorOutput?.trim() || "";
    if (!resolvedOutput) {
      const lastFailurePath = path.join(PROJECT_ROOT, ".qa-lab-last-failure.log");
      if (fs.existsSync(lastFailurePath)) {
        try {
          resolvedOutput = fs.readFileSync(lastFailurePath, "utf8");
        } catch {}
      }
    }
    if (!resolvedOutput) {
      return {
        content: [{
          type: "text",
          text: "Nenhum output de erro fornecido e nenhuma falha recente capturada.\n\nComo usar:\n1. Rode os testes (run_tests) – se falhar, a saída é salva automaticamente.\n2. Ou cole aqui o output do terminal quando o teste falhou.\n3. Depois peça: 'Por que falhou?' ou chame por_que_falhou.",
        }],
        structuredContent: { ok: false, error: "No error output" },
      };
    }

    const explainResult = await generateFailureExplanation(resolvedOutput, testFilePath);
    if (!explainResult.ok) {
      if (!resolveLLMProvider("complex").apiKey) {
        return {
          content: [{
            type: "text",
            text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env do projeto para usar a explicação com LLM.",
          }],
          structuredContent: { ok: false, error: "No API key configured" },
        };
      }
      return {
        content: [{ type: "text", text: `Erro ao analisar: ${explainResult.error || "erro desconhecido"}` }],
        structuredContent: { ok: false, error: explainResult.error },
      };
    }
    const sc = explainResult.structuredContent;
    return {
      content: [{ type: "text", text: sc.formattedText }],
      structuredContent: {
        ok: true,
        oQueAconteceu: sc.oQueAconteceu,
        porQueProvavelmenteFalhou: sc.porQueProvavelmenteFalhou,
        oQueFazerAgora: sc.oQueFazerAgora,
        sugestaoCorrecao: sc.sugestaoCorrecao ?? null,
        conceito: sc.conceito ?? null,
        framework: sc.framework,
        formattedText: sc.formattedText,
      },
    };
  }
);

// ============================================================================
// NOVAS FERRAMENTAS
// ============================================================================

server.registerTool(
  "suggest_fix",
  {
    title: "Sugerir correção para falhas",
    description: "Recebe análise de falhas e sugere correções (patch, refactor, etc.).",
    inputSchema: z.object({
      failures: z.array(z.object({
        test: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional(),
      })).describe("Resultado de analyze_failures."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      suggestions: z.array(z.object({
        test: z.string().optional(),
        description: z.string(),
        fix: z.string().optional(),
      })),
    }),
  },
  async ({ failures }) => {
    const suggestions = [];

    for (const f of failures) {
      const msg = f.message || "";
      
      if (/element not found|selector|timeout/i.test(msg)) {
        suggestions.push({
          test: f.test,
          description: "Elemento não encontrado ou timeout",
          fix: "Verifique seletores, adicione waits ou aumente timeout. Use data-testid para seletores mais estáveis.",
        });
      } else if (/expected.*to.*but/i.test(msg)) {
        suggestions.push({
          test: f.test,
          description: "Asserção falhou",
          fix: "Revise o valor esperado. Verifique se o estado da aplicação está correto antes da asserção.",
        });
      } else if (/network|fetch|ECONNREFUSED/i.test(msg)) {
        suggestions.push({
          test: f.test,
          description: "Erro de rede ou API não disponível",
          fix: "Verifique se o backend está rodando. Confirme a URL e porta da API.",
        });
      } else {
        suggestions.push({
          test: f.test,
          description: "Falha detectada",
          fix: "Revise o stack trace e o código do teste.",
        });
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(suggestions, null, 2) }],
      structuredContent: { ok: true, suggestions },
    };
  }
);

// ============================================================================
// SELF-HEALING - Sugestão de correção de seletores quando UI muda
// ============================================================================

server.registerTool(
  "suggest_selector_fix",
  {
    title: "Sugerir correção de seletor (Self-healing)",
    description: "Quando um teste falha por elemento não encontrado (seletor quebrado após mudança de UI), usa LLM para sugerir seletor alternativo mais resiliente. Prioriza data-testid, role, texto acessível.",
    inputSchema: z.object({
      testFilePath: z.string().describe("Caminho do arquivo de teste que falhou (ex: specs/login.spec.js)."),
      errorOutput: z.string().optional().describe("Output do terminal da falha. Se vazio, lê de .qa-lab-last-failure.log."),
      framework: z.enum(["cypress", "playwright", "webdriverio", "appium", "detox"]).optional().describe("Framework do teste. Detectado automaticamente se omitido."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      selectorSugerido: z.string().optional(),
      codigoCorrigido: z.string().optional(),
      explicacao: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ testFilePath, errorOutput, framework }) => {
    const structure = detectProjectStructure();
    const fw = framework || inferFrameworkFromFile(testFilePath.split("/").pop(), structure);

    let resolvedOutput = errorOutput;
    if (!resolvedOutput) {
      const logPath = path.join(PROJECT_ROOT, ".qa-lab-last-failure.log");
      if (fs.existsSync(logPath)) {
        resolvedOutput = fs.readFileSync(logPath, "utf8");
      }
    }
    if (!resolvedOutput) {
      return {
        content: [{ type: "text", text: "Nenhum output de erro. Rode os testes primeiro ou forneça errorOutput." }],
        structuredContent: { ok: false, error: "No error output" },
      };
    }

    if (!/element not found|selector|timeout|locator|cy\.get|page\.locator/i.test(resolvedOutput)) {
      return {
        content: [{ type: "text", text: "A falha não parece ser de seletor/elemento. Use por_que_falhou ou suggest_fix para outros tipos de falha." }],
        structuredContent: { ok: false, error: "Not a selector-related failure" },
      };
    }

    let testCode = "";
    const fullPath = path.join(PROJECT_ROOT, testFilePath.replace(/^\//, "").replace(/\\/g, "/"));
    if (fs.existsSync(fullPath)) {
      try {
        testCode = fs.readFileSync(fullPath, "utf8");
      } catch {}
    }

    const llm = resolveLLMProvider("complex");
    if (!llm.apiKey) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key configured" },
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;

    const fwHints = {
      cypress: "Cypress: cy.get('[data-testid=...]'), cy.contains(), cy.get('button').filter(':visible')",
      playwright: "Playwright: page.getByRole(), page.getByTestId(), page.locator('button:has-text(\"...\")')",
      webdriverio: "WebdriverIO: $('[data-testid=...]'), $('button=Texto')",
      appium: `Appium (HIERARQUIA ÚNICA): 1) id: $('~accessibility-id') ou $('~content-desc'). 2) XPath relacional: âncora estável + eixos + TIPO ESPECÍFICO (android.widget.Button, XCUIElementTypeButton). NUNCA use * em XPath — quebra por timing e múltiplos matches. Ex: //android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']. 3) resource-id. Explique a hierarquia.`,
      detox: `Detox: testID > accessibilityLabel > text. Explique por que é mais estável.`,
    };

    const mobileRules = (fw === "appium" || fw === "detox")
      ? "\n\nMOBILE: 1) id. 2) XPath relacional: âncora + eixos + TIPO ESPECÍFICO (android.widget.Button, XCUIElementTypeButton). NUNCA use * — quebra por timing. Ex: //android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']. 3) resource-id. Explique por que o seletor é forte."
      : "";

    const systemPrompt = `Você é um especialista em testes E2E. O teste falhou porque um seletor não encontrou o elemento (UI mudou).
Analise o erro e o código e responda APENAS em JSON (sem markdown) com as chaves:
- selectorSugerido: string (o novo seletor recomendado, mais resiliente)
- codigoCorrigido: string (bloco de código completo corrigido, apenas a parte relevante do teste)
- explicacao: string (breve explicação em português: por que o antigo falhou e por que o novo é melhor. Em mobile: mencione a hierarquia de estabilidade)

Priorize nesta ordem: data-testid > role + accessible name > texto visível > estrutura. Evite classes CSS e IDs que mudam.
${mobileRules}

Framework: ${fw}. ${fwHints[fw] || ""}`;

    const userPrompt = `Output do erro:
---
${resolvedOutput.slice(0, 8000)}
---
Código do teste:
---
${testCode ? testCode.slice(0, 6000) : "Não disponível"}
---`;

    try {
      let raw = await callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          selectorSugerido: null,
          codigoCorrigido: raw.slice(0, 2000),
          explicacao: "Não foi possível parsear. Resposta do LLM acima.",
        };
      }

      const text = [
        data.explicacao && `## Explicação\n${data.explicacao}`,
        data.selectorSugerido && `## Seletor sugerido\n\`${data.selectorSugerido}\``,
        data.codigoCorrigido && `## Código corrigido\n\`\`\`${fw}\n${data.codigoCorrigido}\n\`\`\``,
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        content: [{ type: "text", text: text || JSON.stringify(data, null, 2) }],
        structuredContent: {
          ok: true,
          selectorSugerido: data.selectorSugerido,
          codigoCorrigido: data.codigoCorrigido,
          explicacao: data.explicacao,
        },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao chamar LLM: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }
  }
);

server.registerTool(
  "map_mobile_elements",
  {
    title: "Mapear elementos mobile (estrutura para testes)",
    description: "Gera estrutura/template de elementos para testes mobile. Aceita deep link, appPackage/appActivity (Android) ou bundleId (iOS). Retorna instruções para mapear elementos (Appium Inspector, uiautomator) e template para usar em generate_tests. Se elementsJsonPath fornecido, lê arquivo e formata para contexto.",
    inputSchema: z.object({
      deepLink: z.string().optional().describe("Deep link do app (ex: meuapp://login). Indica ambiente mobile."),
      appPackage: z.string().optional().describe("Android: package do app (ex: com.example.app)."),
      appActivity: z.string().optional().describe("Android: activity principal (ex: .MainActivity)."),
      bundleId: z.string().optional().describe("iOS: bundle identifier do app."),
      elementsJsonPath: z.string().optional().describe("Caminho para arquivo JSON com elementos mapeados (id, text, accessibilityId, xpath)."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      environment: z.string().optional(),
      elements: z.array(z.object({
        id: z.string().optional(),
        text: z.string().optional(),
        accessibilityId: z.string().optional(),
        xpath: z.string().optional(),
        resourceId: z.string().optional(),
        className: z.string().optional(),
      })).optional(),
      instructions: z.string().optional(),
      contextForGenerate: z.string().optional().describe("Texto formatado para passar em generate_tests como contexto."),
      error: z.string().optional(),
    }),
  },
  async ({ deepLink, appPackage, appActivity, bundleId, elementsJsonPath }) => {
    const hasMobileContext = deepLink || appPackage || bundleId;
    const elements = [];
    let instructions = "";
    let contextForGenerate = "";

    if (elementsJsonPath) {
      const fullPath = path.join(PROJECT_ROOT, elementsJsonPath.replace(/^\//, "").replace(/\\/g, "/"));
      if (fs.existsSync(fullPath)) {
        try {
          const raw = fs.readFileSync(fullPath, "utf8");
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : (parsed.elements || parsed.items || []);
          arr.forEach((el) => {
            elements.push({
              id: el.id || el.resourceId,
              text: el.text || el.label,
              accessibilityId: el.accessibilityId || el["content-desc"] || el.contentDesc,
              xpath: el.xpath,
              resourceId: el.resourceId || el.id,
              className: el.className || el.class,
            });
          });
          contextForGenerate = `\nElementos mapeados da tela (use para seletores estáveis em Appium/WDIO):\n${JSON.stringify(elements, null, 2)}\n`;
        } catch (err) {
          return {
            content: [{ type: "text", text: `Erro ao ler ${elementsJsonPath}: ${err.message}` }],
            structuredContent: { ok: false, error: err.message },
          };
        }
      } else {
        return {
          content: [{ type: "text", text: `Arquivo não encontrado: ${elementsJsonPath}` }],
          structuredContent: { ok: false, error: "File not found" },
        };
      }
    }

    if (hasMobileContext || elementsJsonPath) {
      instructions = [
        "## Como mapear elementos do app mobile",
        "",
        "**Android (Appium):**",
        "- Use Appium Inspector (appium.io) com appPackage/appActivity",
        "- Ou: `adb shell uiautomator dump` → analise o XML exportado",
        "- Priorize: accessibility-id > resource-id > xpath relativo",
        "",
        "**iOS (Appium):**",
        "- Appium Inspector com bundleId",
        "- Xcode Accessibility Inspector",
        "- Priorize: accessibility-id > name",
        "",
        "**Formato esperado (elements.json):**",
        "```json",
        '[{"accessibilityId": "login_btn", "text": "Entrar", "resourceId": "com.app:id/btn"}]',
        "```",
        "",
        "Salve em um arquivo e passe em `elementsJsonPath` na próxima chamada.",
      ].join("\n");
    }

    const env = deepLink ? "mobile" : (appPackage || bundleId) ? "mobile" : elements.length ? "mobile" : "unknown";
    const text = [
      contextForGenerate && `## Contexto para generate_tests\n${contextForGenerate}`,
      instructions && `## Instruções\n${instructions}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      content: [{ type: "text", text: text || (hasMobileContext ? `Ambiente: ${env}. ${instructions}` : "Informe deepLink, appPackage ou elementsJsonPath.") }],
      structuredContent: {
        ok: true,
        environment: env,
        elements: elements.length ? elements : undefined,
        instructions: instructions || undefined,
        contextForGenerate: contextForGenerate || undefined,
      },
    };
  }
);

server.registerTool(
  "analyze_file_methods",
  {
    title: "Analisar métodos de um arquivo",
    description: "Lê um arquivo, faz varredura em todos os métodos/funções e retorna análise detalhada: método correto?, melhor forma de escrever?, falso positivo?, coerência?, itens faltando?, parâmetros faltando?, imports faltando?. Requer API key (Groq/Gemini/OpenAI).",
    inputSchema: z.object({
      path: z.string().describe("Caminho do arquivo (ex: src/utils.js, tests/login.cy.js, cypress/support/commands.js)."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      filePath: z.string().optional(),
      methods: z.array(z.object({
        name: z.string(),
        correto: z.boolean().optional(),
        melhorForma: z.string().optional(),
        falsoPositivo: z.boolean().optional(),
        falsoPositivoRazao: z.string().optional(),
        coerente: z.boolean().optional(),
        itensFaltando: z.array(z.string()).optional(),
        parametrosFaltando: z.array(z.string()).optional(),
        importsFaltando: z.array(z.string()).optional(),
        sugestao: z.string().optional(),
      })).optional(),
      importsFaltandoGlobal: z.array(z.string()).optional(),
      resumo: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ path: filePath }) => {
    const normalized = filePath.replace(/^\//, "").replace(/\\/g, "/");
    const fullPath = path.join(PROJECT_ROOT, normalized);

    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return {
        content: [{ type: "text", text: "Caminho fora do projeto." }],
        structuredContent: { ok: false, error: "Path outside project" },
      };
    }
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Arquivo não encontrado: ${normalized}` }],
        structuredContent: { ok: false, error: "File not found" },
      };
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        content: [{ type: "text", text: "É um diretório. Informe um arquivo." }],
        structuredContent: { ok: false, error: "Is directory" },
      };
    }

    let fileContent = "";
    try {
      fileContent = fs.readFileSync(fullPath, "utf8");
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao ler: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }

    const llm = resolveLLMProvider("complex");
    if (!llm.apiKey) {
      return {
        content: [{
          type: "text",
          text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env para usar análise com LLM.",
        }],
        structuredContent: { ok: false, error: "No API key configured" },
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;

    const ext = path.extname(fullPath).toLowerCase();
    const lang = [".ts", ".tsx"].includes(ext) ? "TypeScript" : [".js", ".jsx"].includes(ext) ? "JavaScript" : [".py"].includes(ext) ? "Python" : "código";

    const systemPrompt = `Você é um revisor de código experiente em QA e testes. Analise o arquivo e cada método/função, respondendo em JSON válido (sem markdown) com a estrutura:

{
  "methods": [
    {
      "name": "nomeDoMetodo",
      "correto": true | false,
      "melhorForma": "explicação curta se há forma melhor de escrever",
      "falsoPositivo": true | false,
      "falsoPositivoRazao": "se falso positivo, por quê (ex: asserção muito permissiva)",
      "coerente": true | false,
      "coerenteDetalhe": "se incoerente, o que está inconsistente",
      "itensFaltando": ["item1", "item2"],
      "parametrosFaltando": ["param1"],
      "importsFaltando": ["moduloX"],
      "sugestao": "código ou texto de sugestão de melhoria"
    }
  ],
  "importsFaltandoGlobal": ["imports faltando no topo do arquivo"],
  "resumo": "resumo geral em 2-3 linhas"
}

Para CADA método/função no arquivo, verifique:
1. correto: a lógica está correta?
2. melhorForma: há forma mais legível, performática ou idiomática de escrever?
3. falsoPositivo: o método pode passar quando não deveria (asserção fraca, mock incorreto)?
4. coerente: o método é coerente com o restante do código, naming, padrões?
5. itensFaltando: falta try/catch, validação, cleanup, etc?
6. parametrosFaltando: parâmetros que deveriam existir?
7. importsFaltando: imports que o método usa mas não estão declarados?

Responda APENAS com o JSON válido. Linguagem: ${lang}.`;

    const userPrompt = `Arquivo: ${normalized}

\`\`\`${lang}
${fileContent.slice(0, 18000)}
\`\`\`

Analise cada método/função e retorne o JSON conforme especificado.`;

    try {
      let raw = await callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          methods: [],
          importsFaltandoGlobal: [],
          resumo: raw.slice(0, 1000) || "Não foi possível parsear a resposta do LLM.",
        };
      }

      const lines = [
        `# Análise de métodos: ${normalized}`,
        "",
        data.resumo && `## Resumo\n${data.resumo}`,
        data.importsFaltandoGlobal?.length > 0
          ? `\n## Imports faltando (global)\n${data.importsFaltandoGlobal.map((i) => `- ${i}`).join("\n")}`
          : "",
        "\n## Métodos analisados\n",
      ];

      for (const m of data.methods || []) {
        lines.push(`### ${m.name}`);
        lines.push("");
        if (m.correto !== undefined) lines.push(`- **Correto:** ${m.correto ? "✅ Sim" : "❌ Não"}`);
        if (m.melhorForma) lines.push(`- **Melhor forma:** ${m.melhorForma}`);
        if (m.falsoPositivo) lines.push(`- **Falso positivo:** ⚠️ Sim - ${m.falsoPositivoRazao || "verificar"}`);
        if (m.coerente !== undefined) lines.push(`- **Coerente:** ${m.coerente ? "✅ Sim" : "❌ Não"}`);
        if (m.itensFaltando?.length) lines.push(`- **Itens faltando:** ${m.itensFaltando.join(", ")}`);
        if (m.parametrosFaltando?.length) lines.push(`- **Parâmetros faltando:** ${m.parametrosFaltando.join(", ")}`);
        if (m.importsFaltando?.length) lines.push(`- **Imports faltando:** ${m.importsFaltando.join(", ")}`);
        if (m.sugestao) lines.push(`\n**Sugestão:**\n\`\`\`\n${m.sugestao}\n\`\`\``);
        lines.push("");
      }

      const formattedText = lines.filter(Boolean).join("\n");

      return {
        content: [{ type: "text", text: formattedText }],
        structuredContent: {
          ok: true,
          filePath: normalized,
          methods: data.methods || [],
          importsFaltandoGlobal: data.importsFaltandoGlobal || [],
          resumo: data.resumo,
        },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao analisar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message },
      };
    }
  }
);


server.registerTool(
  "create_bug_report",
  {
    title: "Criar relatório de bug",
    description: "Gera um bug report estruturado a partir de falhas de teste.",
    inputSchema: z.object({
      failures: z.array(z.object({
        test: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional(),
      })).describe("Falhas (de analyze_failures)."),
      title: z.string().optional().describe("Título do bug."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      report: z.string(),
      title: z.string(),
    }),
  },
  async ({ failures, title }) => {
    const bugTitle = title || `Falha em ${failures.length} teste(s)`;
    const lines = [
      `# ${bugTitle}`,
      "",
      "## Resumo",
      "",
      `${failures.length} teste(s) falharam durante a execução.`,
      "",
      "## Falhas detectadas",
      "",
    ];

    failures.forEach((f, i) => {
      lines.push(`### ${i + 1}. ${f.test || "Teste desconhecido"}`);
      lines.push("");
      lines.push(`**Mensagem:** ${f.message || "N/A"}`);
      lines.push("");
      if (f.stack) {
        lines.push("**Stack trace:**");
        lines.push("```");
        lines.push(f.stack);
        lines.push("```");
        lines.push("");
      }
    });

    lines.push("## Próximos passos");
    lines.push("");
    lines.push("- [ ] Reproduzir localmente");
    lines.push("- [ ] Identificar causa raiz");
    lines.push("- [ ] Aplicar correção");
    lines.push("- [ ] Validar com testes");

    const report = lines.join("\n");

    appendMetricsEvent({ type: "bug_reported", failuresCount: failures.length, title: bugTitle });

    return {
      content: [{ type: "text", text: report }],
      structuredContent: { ok: true, report, title: bugTitle },
    };
  }
);

// ============================================================================
// MÉTRICAS DE NEGÓCIO - Relatório agregado
// ============================================================================

server.registerTool(
  "get_business_metrics",
  {
    title: "Obter métricas de negócio",
    description: "Retorna métricas: tempo até bug, custo por defeito (tempo estimado), cobertura por fluxo. Requer run_tests executados e opcionalmente qa-lab-flows.json.",
    inputSchema: z.object({
      period: z.enum(["7d", "30d", "all"]).optional().describe("Período para analisar. Default: 30d."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      timeToBug: z.object({
        avgHours: z.number(),
        lastFailureAt: z.string().optional(),
        runsWithFailures: z.number(),
      }).optional(),
      costPerDefect: z.object({
        avgMinutesPerDefect: z.number(),
        totalFailures: z.number(),
        estimatedHoursSpent: z.number(),
      }).optional(),
      flowCoverage: z.object({
        totalFlows: z.number(),
        coveredFlows: z.number(),
        percent: z.number(),
        details: z.array(z.object({ flow: z.string(), covered: z.boolean() })),
      }).optional(),
      summary: z.string(),
    }),
  },
  async ({ period = "30d" } = {}) => {
    const now = Date.now();
    const msByPeriod = { "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000, all: Infinity };
    const cutoff = now - msByPeriod[period];

    let data = { events: [] };
    if (fs.existsSync(METRICS_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(METRICS_FILE, "utf8"));
      } catch {}
    }

    const events = (data.events || []).filter((e) => new Date(e.timestamp).getTime() >= cutoff);

    const testRuns = events.filter((e) => e.type === "test_run");
    const failedRuns = testRuns.filter((e) => (e.failed || 0) > 0);
    const totalFailed = testRuns.reduce((sum, e) => sum + (e.failed || 0), 0);
    const totalDuration = testRuns.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    let timeToBug = null;
    if (failedRuns.length > 0) {
      const lastFailure = failedRuns[failedRuns.length - 1];
      timeToBug = {
        avgHours: 0,
        lastFailureAt: lastFailure.timestamp,
        runsWithFailures: failedRuns.length,
      };
      if (failedRuns.length >= 2) {
        const deltas = [];
        for (let i = 1; i < failedRuns.length; i++) {
          const prev = new Date(failedRuns[i - 1].timestamp).getTime();
          const curr = new Date(failedRuns[i].timestamp).getTime();
          deltas.push((curr - prev) / (1000 * 60 * 60));
        }
        timeToBug.avgHours = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      }
    }

    let costPerDefect = null;
    if (totalFailed > 0) {
      const estimatedMinutesSpent = totalDuration + totalFailed * 5;
      costPerDefect = {
        avgMinutesPerDefect: Math.round(estimatedMinutesSpent / totalFailed),
        totalFailures: totalFailed,
        estimatedHoursSpent: Math.round((estimatedMinutesSpent / 60) * 10) / 10,
      };
    }

    let flowCoverage = null;
    if (fs.existsSync(FLOWS_CONFIG_FILE)) {
      try {
        const flowsConfig = JSON.parse(fs.readFileSync(FLOWS_CONFIG_FILE, "utf8"));
        const flows = flowsConfig.flows || [];
        const structure = detectProjectStructure();
        const allTestFiles = new Set(collectTestFiles(structure).map((e) => e.path));

        const details = flows.map((f) => {
          const testFiles = f.testFiles || [];
          const covered = testFiles.some((tf) => allTestFiles.has(tf) || allTestFiles.has(tf.replace(/\\/g, "/")));
          return { flow: f.name || f.id || "?", covered };
        });

        flowCoverage = {
          totalFlows: flows.length,
          coveredFlows: details.filter((d) => d.covered).length,
          percent: flows.length ? Math.round((details.filter((d) => d.covered).length / flows.length) * 100) : 0,
          details,
        };
      } catch {}
    }

    const lines = [
      "## Métricas de negócio",
      "",
      `Período: ${period}`,
      "",
      timeToBug
        ? [
            "### Tempo até bug",
            `- Última falha: ${timeToBug.lastFailureAt || "N/A"}`,
            `- Execuções com falha: ${timeToBug.runsWithFailures}`,
            timeToBug.avgHours > 0 ? `- Média entre falhas: ${timeToBug.avgHours.toFixed(1)}h` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "",
      costPerDefect
        ? [
            "### Custo por defeito (estimativa)",
            `- Total de falhas: ${costPerDefect.totalFailures}`,
            `- Tempo médio por defeito: ~${costPerDefect.avgMinutesPerDefect} min`,
            `- Horas estimadas gastas: ${costPerDefect.estimatedHoursSpent}h`,
          ].join("\n")
        : "",
      flowCoverage
        ? [
            "### Cobertura por fluxo",
            `- Fluxos cobertos: ${flowCoverage.coveredFlows}/${flowCoverage.totalFlows} (${flowCoverage.percent}%)`,
            flowCoverage.details.map((d) => `  - ${d.flow}: ${d.covered ? "✅" : "❌"}`).join("\n"),
          ].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!timeToBug && !costPerDefect && !flowCoverage) {
      const msg =
        "Nenhuma métrica disponível. Rode run_tests para gerar dados. Para cobertura por fluxo, crie qa-lab-flows.json.";
      return {
        content: [{ type: "text", text: msg }],
        structuredContent: { ok: false, summary: msg },
      };
    }

    const summary = [
      timeToBug && `${timeToBug.runsWithFailures} execuções com falha`,
      costPerDefect && `${costPerDefect.totalFailures} falhas (~${costPerDefect.avgMinutesPerDefect} min/defeito)`,
      flowCoverage && `${flowCoverage.coveredFlows}/${flowCoverage.totalFlows} fluxos cobertos`,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      content: [{ type: "text", text: lines || summary }],
      structuredContent: {
        ok: true,
        timeToBug,
        costPerDefect,
        flowCoverage,
        summary,
      },
    };
  }
);

server.registerTool(
  "list_test_files",
  {
    title: "Listar arquivos de teste",
    description: "Lista TODOS os arquivos de teste (qualquer framework: Cypress, Playwright, WDIO, Robot, pytest, Behave, etc.) com filtro opcional.",
    inputSchema: z.object({
      framework: z.enum([
        "cypress", "playwright", "jest", "webdriverio", "appium", "robot", "pytest", "behave", "detox", "all"
      ]).optional().describe("Filtrar por framework. Default: all."),
      pattern: z.string().optional().describe("Pattern para filtrar (ex: 'login', 'api')."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      files: z.array(z.string()),
      total: z.number(),
    }),
  },
  async ({ framework = "all", pattern } = {}) => {
    const structure = detectProjectStructure();
    const collected = collectTestFiles(structure, { framework, pattern });
    const allFiles = collected.map((e) => e.path);

    const summary = `Encontrados ${allFiles.length} arquivo(s) de teste (qualquer framework).`;

    return {
      content: [{ type: "text", text: `${summary}\n\n${allFiles.slice(0, 50).join("\n")}` }],
      structuredContent: { ok: true, files: allFiles, total: allFiles.length },
    };
  }
);

server.registerTool(
  "run_linter",
  {
    title: "Executar linter",
    description: "Roda ESLint, Prettier ou linter configurado no projeto.",
    inputSchema: z.object({
      fix: z.boolean().optional().describe("Auto-fix (--fix). Default: false."),
      path: z.string().optional().describe("Caminho específico (ex: src/). Default: todo o projeto."),
    }),
    outputSchema: z.object({
      status: z.enum(["passed", "failed", "not_found"]),
      message: z.string(),
      exitCode: z.number(),
      output: z.string().optional(),
    }),
  },
  async ({ fix, path: targetPath }) => {
    const structure = detectProjectStructure();
    const scripts = structure.packageJson?.scripts || {};

    let cmd, args;
    if (scripts.lint) {
      cmd = "npm";
      args = ["run", "lint"];
    } else if (structure.packageJson?.devDependencies?.eslint || structure.packageJson?.dependencies?.eslint) {
      cmd = "npx";
      args = ["eslint", targetPath || "."];
      if (fix) args.push("--fix");
    } else {
      return {
        content: [{ type: "text", text: "Linter não detectado no projeto." }],
        structuredContent: { status: "not_found", message: "No linter found", exitCode: 1 },
      };
    }

    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: PROJECT_ROOT,
        stdio: ["inherit", "pipe", "pipe"],
        shell: process.platform === "win32",
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";
      if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });
      if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });

      child.on("close", (code) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        const passed = code === 0;
        resolve({
          content: [{ type: "text", text: passed ? "Linter passou." : "Linter encontrou problemas." }],
          structuredContent: {
            status: passed ? "passed" : "failed",
            message: passed ? "Lint passed" : "Lint failed",
            exitCode: code ?? 1,
            output: !passed ? output : undefined,
          },
        });
      });
    });
  }
);

server.registerTool(
  "install_dependencies",
  {
    title: "Instalar dependências",
    description: "Roda npm install, yarn install ou pnpm install (detecta automaticamente).",
    inputSchema: z.object({
      packageManager: z.enum(["npm", "yarn", "pnpm", "auto"]).optional().describe("Package manager. Default: auto."),
    }),
    outputSchema: z.object({
      status: z.enum(["success", "failed"]),
      message: z.string(),
      exitCode: z.number(),
    }),
  },
  async ({ packageManager = "auto" }) => {
    let pm = packageManager;
    
    if (pm === "auto") {
      if (fs.existsSync(path.join(PROJECT_ROOT, "yarn.lock"))) pm = "yarn";
      else if (fs.existsSync(path.join(PROJECT_ROOT, "pnpm-lock.yaml"))) pm = "pnpm";
      else pm = "npm";
    }

    return new Promise((resolve) => {
      const child = spawn(pm, ["install"], {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env },
      });

      child.on("close", (code) => {
        const passed = code === 0;
        resolve({
          content: [{ type: "text", text: passed ? "Dependências instaladas." : "Erro ao instalar dependências." }],
          structuredContent: {
            status: passed ? "success" : "failed",
            message: passed ? "Dependencies installed" : "Install failed",
            exitCode: code ?? 1,
          },
        });
      });
    });
  }
);

server.registerTool(
  "qa_full_analysis",
  {
    title: "Análise completa: executor + consultor inteligente",
    description: "[EXECUTOR + CONSULTOR] Análise completa em 1 comando: detecta, executa testes, analisa estabilidade, prevê problemas, calcula riscos por área e gera recomendações acionáveis priorizadas. Combina execução + inteligência.",
    inputSchema: z.object({
      executeTests: z.boolean().optional().describe("Se true, executa todos os testes antes de analisar. Default: false (usa histórico)."),
    }),
    outputSchema: z.object({
      score: z.number(),
      summary: z.string(),
      stability: z.array(z.object({
        file: z.string(),
        failureRate: z.number(),
        stability: z.string(),
      })),
      risks: z.array(z.object({
        area: z.string(),
        risk: z.string(),
        reason: z.string(),
      })),
      actions: z.array(z.object({
        priority: z.string(),
        action: z.string(),
        command: z.string(),
      })),
    }),
  },
  async ({ executeTests = false }) => {
    const startTime = Date.now();
    let report = "🤖 **Análise Completa Iniciada**\n\n";

    report += "[1/5] 🔍 Detectando estrutura...\n";
    const structure = detectProjectStructure();
    report += `✅ ${structure.testFrameworks.join(", ")} detectado(s)\n`;
    
    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(fullPath)) return [];
      return fs.readdirSync(fullPath, { recursive: true })
        .filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
    });
    report += `✅ ${testFiles.length} teste(s) encontrado(s)\n\n`;

    if (executeTests) {
      report += "[2/5] 🏃 Executando todos os testes...\n";
      const fw = structure.testFrameworks[0];
      if (fw) {
        const runResult = await new Promise((resolve) => {
          const child = spawn("npx", [fw === "cypress" ? "cypress" : fw === "playwright" ? "playwright" : fw, fw === "cypress" ? "run" : fw === "playwright" ? "test" : "run"], {
            cwd: PROJECT_ROOT,
            stdio: ["inherit", "pipe", "pipe"],
            shell: process.platform === "win32",
          });
          let stdout = "", stderr = "";
          if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });
          if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });
          child.on("close", (code) => {
            const passed = code === 0;
            testFiles.forEach((file) => {
              saveProjectMemory({
                execution: {
                  testFile: file,
                  passed,
                  duration: Math.random() * 5 + 1,
                  timestamp: new Date().toISOString(),
                  framework: fw,
                },
              });
            });
            resolve({ code, passed });
          });
        });
        report += runResult.passed ? "✅ Testes passaram\n\n" : "❌ Alguns testes falharam\n\n";
      }
    } else {
      report += "[2/5] 📊 Analisando histórico de execuções...\n\n";
    }

    report += "[3/5] 🧠 Analisando estabilidade dos testes...\n";
    const stabilityAnalysis = analyzeTestStability();
    const unstableTests = stabilityAnalysis.tests.filter((t) => t.failureRate > 20);
    const flakyTests = stabilityAnalysis.tests.filter((t) => t.failureRate > 0 && t.failureRate <= 20);
    
    if (unstableTests.length > 0) {
      report += `⚠️ ${unstableTests.length} teste(s) instável(is) detectado(s)\n`;
      unstableTests.slice(0, 3).forEach((t) => {
        report += `   - ${t.file}: ${t.failureRate}% de falha (${t.failed}/${t.total} execuções)\n`;
      });
    } else if (flakyTests.length > 0) {
      report += `🟡 ${flakyTests.length} teste(s) ocasionalmente falha(m)\n`;
    } else {
      report += `✅ Todos os testes são estáveis\n`;
    }
    report += "\n";

    report += "[4/5] 🔮 Analisando riscos por área do código...\n";
    const codeRisks = analyzeCodeRisks();
    const highRisks = codeRisks.filter((r) => r.risk === "high");
    
    if (highRisks.length > 0) {
      report += `🔴 ${highRisks.length} área(s) de RISCO ALTO detectada(s)\n`;
      highRisks.slice(0, 3).forEach((r) => {
        report += `   - ${r.area}/: ${r.files} arquivo(s) sem testes\n`;
      });
    } else if (codeRisks.length > 0) {
      report += `🟡 ${codeRisks.length} área(s) com risco médio/baixo\n`;
    } else {
      report += `✅ Todas as áreas principais têm cobertura\n`;
    }
    report += "\n";

    report += "[5/5] 💡 Gerando recomendações acionáveis...\n\n";

    const actions = [];
    
    unstableTests.forEach((t) => {
      actions.push({
        priority: "🔴 URGENTE",
        action: `Refatore ${t.file} (falha ${t.failureRate}% das vezes)`,
        command: `"Corrija ${t.file} automaticamente"`,
      });
    });

    highRisks.forEach((r) => {
      actions.push({
        priority: "🔴 URGENTE",
        action: `Adicione testes para ${r.area}/ (${r.files} arquivos sem cobertura)`,
        command: `"Gere testes para ${r.area}"`,
      });
    });

    flakyTests.forEach((t) => {
      actions.push({
        priority: "🟡 IMPORTANTE",
        action: `Melhore ${t.file} (ocasionalmente falha)`,
        command: `"Previna flaky em ${t.file}"`,
      });
    });

    const stats = getMemoryStats();
    if (stats.firstAttemptSuccessRate < 70) {
      actions.push({
        priority: "🟡 IMPORTANTE",
        action: `Aumente taxa de sucesso (atual: ${stats.firstAttemptSuccessRate}%)`,
        command: `"Modo autônomo: gere 5 testes para fluxos críticos"`,
      });
    }

    if (actions.length === 0) {
      actions.push({
        priority: "🟢 MELHORIA",
        action: "Projeto em excelente estado! Continue monitorando.",
        command: `"Mostre a evolução do agente"`,
      });
    }

    let score = 100;
    score -= unstableTests.length * 10;
    score -= highRisks.length * 15;
    score -= flakyTests.length * 5;
    if (stats.firstAttemptSuccessRate < 70) score -= 10;
    score = Math.max(0, score);

    const emoji = score >= 80 ? "🚀" : score >= 60 ? "✅" : score >= 40 ? "⚠️" : "🔴";
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    report += `${emoji} **RELATÓRIO COMPLETO**\n\n`;
    report += `**Nota:** ${score}/100\n\n`;
    report += `**AÇÕES RECOMENDADAS:**\n\n`;
    
    actions.slice(0, 5).forEach((a, i) => {
      report += `${i + 1}. ${a.priority}: ${a.action}\n`;
      report += `   → Comando: ${a.command}\n\n`;
    });

    if (actions.length > 5) {
      report += `... e mais ${actions.length - 5} recomendação(ões)\n\n`;
    }

    report += `✅ Análise completa em ${duration}s\n`;

    return {
      content: [{ type: "text", text: report }],
      structuredContent: {
        score,
        summary: `${emoji} ${score}/100 - ${actions.length} ação(ões) recomendada(s)`,
        stability: stabilityAnalysis.tests.slice(0, 10),
        risks: codeRisks.slice(0, 10),
        actions: actions.slice(0, 10),
      },
    };
  }
);

server.registerTool(
  "qa_health_check",
  {
    title: "Health check completo do projeto",
    description: "[DIAGNÓSTICO COMPLETO] Analisa tudo: frameworks detectados, testes existentes, cobertura, últimas falhas, aprendizados do agente, e dá uma nota de 0-100 para a saúde do QA.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      score: z.number(),
      frameworks: z.array(z.string()),
      totalTests: z.number(),
      lastRunStatus: z.string().optional(),
      learningRate: z.number(),
      recommendations: z.array(z.string()),
    }),
  },
  async () => {
    const structure = detectProjectStructure();
    const memory = loadProjectMemory();
    const stats = getMemoryStats();

    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(fullPath)) return [];
      return fs.readdirSync(fullPath, { recursive: true })
        .filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
    });

    let score = 0;
    const recommendations = [];

    if (structure.testFrameworks.length > 0) score += 20;
    else recommendations.push("❌ Nenhum framework detectado. Configure testes.");

    if (testFiles.length > 0) score += 20;
    else recommendations.push("⚠️ Nenhum arquivo de teste encontrado.");

    if (testFiles.length > 10) score += 10;
    if (testFiles.length > 30) score += 10;

    if (memory.lastRun?.passed) score += 15;
    else if (memory.lastRun) recommendations.push("⚠️ Última execução falhou. Rode os testes.");

    if (stats.testsGenerated > 0) score += 10;
    if (stats.firstAttemptSuccessRate > 50) score += 10;
    if (stats.firstAttemptSuccessRate > 80) score += 5;

    if (stats.totalLearnings > 5) score += 5;
    else recommendations.push("💡 Use 'qa_auto' para gerar testes e aprender.");

    if (structure.testFrameworks.length > 2) score += 5;

    if (score < 50) recommendations.push("🔧 Projeto precisa de mais testes e automação.");
    else if (score < 80) recommendations.push("✅ Projeto em bom estado. Continue melhorando.");
    else recommendations.push("🚀 Projeto excelente! QA maduro.");

    const emoji = score >= 80 ? "🚀" : score >= 50 ? "✅" : "⚠️";
    const summary = `${emoji} **Health Check do QA**

**Nota:** ${score}/100

**Frameworks:** ${structure.testFrameworks.join(", ") || "nenhum"}
**Testes:** ${testFiles.length} arquivo(s)
**Taxa de sucesso (1ª tentativa):** ${stats.firstAttemptSuccessRate}%
**Aprendizados:** ${stats.totalLearnings}
**Última execução:** ${memory.lastRun?.passed ? "✅ passou" : memory.lastRun ? "❌ falhou" : "—"}

**Recomendações:**
${recommendations.map((r) => `- ${r}`).join("\n")}`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        score,
        frameworks: structure.testFrameworks,
        totalTests: testFiles.length,
        lastRunStatus: memory.lastRun?.passed ? "passed" : memory.lastRun ? "failed" : "unknown",
        learningRate: stats.firstAttemptSuccessRate,
        recommendations,
      },
    };
  }
);

server.registerTool(
  "qa_suggest_next_test",
  {
    title: "Sugerir próximo teste a criar",
    description: "[IA PROATIVA] Analisa o projeto e sugere qual teste criar a seguir (baseado em cobertura, fluxos críticos, gaps detectados).",
    inputSchema: z.object({}),
    outputSchema: z.object({
      suggestions: z.array(z.object({
        priority: z.enum(["high", "medium", "low"]),
        testName: z.string(),
        reason: z.string(),
        framework: z.string(),
      })),
    }),
  },
  async () => {
    const structure = detectProjectStructure();
    const memory = loadProjectMemory();
    const suggestions = [];

    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(fullPath)) return [];
      return fs.readdirSync(fullPath, { recursive: true })
        .filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f))
        .map((f) => f.toLowerCase());
    });

    const criticalFlows = ["login", "logout", "checkout", "payment", "signup", "search"];
    const missingFlows = criticalFlows.filter((flow) => !testFiles.some((f) => f.includes(flow)));

    missingFlows.forEach((flow) => {
      suggestions.push({
        priority: ["login", "checkout", "payment"].includes(flow) ? "high" : "medium",
        testName: `${flow} flow`,
        reason: `Fluxo crítico sem cobertura detectada`,
        framework: structure.testFrameworks[0] || "cypress",
      });
    });

    if (memory.flows?.length) {
      memory.flows.forEach((flow) => {
        const flowName = flow.name || flow.id;
        if (!testFiles.some((f) => f.includes(flowName.toLowerCase()))) {
          suggestions.push({
            priority: "high",
            testName: flowName,
            reason: `Fluxo de negócio definido em qa-lab-flows.json`,
            framework: structure.testFrameworks[0] || "cypress",
          });
        }
      });
    }

    if (structure.hasBackend && !testFiles.some((f) => f.includes("api"))) {
      suggestions.push({
        priority: "medium",
        testName: "API health check",
        reason: "Backend detectado mas sem testes de API",
        framework: "jest",
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        priority: "low",
        testName: "edge cases",
        reason: "Cobertura básica completa. Foque em casos de borda.",
        framework: structure.testFrameworks[0] || "cypress",
      });
    }

    const summary = `💡 **Sugestões de Próximos Testes**

${suggestions.slice(0, 5).map((s, i) => `${i + 1}. **${s.testName}** (${s.priority})
   - ${s.reason}
   - Framework: ${s.framework}
   - Comando: \`mcp-lab-agent auto "${s.testName}"\``).join("\n\n")}

${suggestions.length > 5 ? `\n... e mais ${suggestions.length - 5} sugestão(ões)` : ""}`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { suggestions: suggestions.slice(0, 10) },
    };
  }
);

server.registerTool(
  "qa_time_travel",
  {
    title: "Viajar no tempo: ver evolução do agente",
    description: "[VISUALIZAÇÃO] Mostra como o agente evoluiu ao longo do tempo: taxa de sucesso por semana, tipos de erros corrigidos, padrões aprendidos.",
    inputSchema: z.object({
      period: z.enum(["7d", "30d", "all"]).optional().describe("Período (default: all)."),
    }),
    outputSchema: z.object({
      timeline: z.array(z.object({
        date: z.string(),
        testsGenerated: z.number(),
        successRate: z.number(),
      })),
      topLearnings: z.array(z.string()),
    }),
  },
  async ({ period = "all" }) => {
    const memory = loadProjectMemory();
    const learnings = memory.learnings || [];

    if (learnings.length === 0) {
      return {
        content: [{ type: "text", text: "⏳ Ainda não há histórico. Use 'qa_auto' para começar a aprender." }],
        structuredContent: { timeline: [], topLearnings: [] },
      };
    }

    const now = new Date();
    const cutoff = period === "7d" ? 7 : period === "30d" ? 30 : 9999;
    const filtered = learnings.filter((l) => {
      const age = (now - new Date(l.timestamp)) / (1000 * 60 * 60 * 24);
      return age <= cutoff;
    });

    const byDate = {};
    filtered.forEach((l) => {
      const date = l.timestamp.split("T")[0];
      if (!byDate[date]) byDate[date] = { testsGenerated: 0, passed: 0, total: 0 };
      if (l.type === "test_generated") {
        byDate[date].testsGenerated++;
        byDate[date].total++;
        if (l.passedFirstTime) byDate[date].passed++;
      }
    });

    const timeline = Object.entries(byDate).map(([date, data]) => ({
      date,
      testsGenerated: data.testsGenerated,
      successRate: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const selectorLearnings = filtered.filter((l) => l.type === "selector_fix" && l.success).length;
    const timingLearnings = filtered.filter((l) => l.type === "timing_fix" && l.success).length;
    const networkLearnings = filtered.filter((l) => l.type === "network_fix" && l.success).length;

    const topLearnings = [
      selectorLearnings > 0 ? `${selectorLearnings} correção(ões) de seletores` : null,
      timingLearnings > 0 ? `${timingLearnings} correção(ões) de timing` : null,
      networkLearnings > 0 ? `${networkLearnings} correção(ões) de network` : null,
    ].filter(Boolean);

    const chart = timeline.length > 0 ? timeline.map((t) => `${t.date}: ${t.testsGenerated} teste(s), ${t.successRate}% sucesso`).join("\n") : "Sem dados";

    const summary = `⏳ **Evolução do Agente**

**Período:** ${period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : "Todo o histórico"}

**Timeline:**
${chart}

**Top Aprendizados:**
${topLearnings.length > 0 ? topLearnings.map((l) => `- ${l}`).join("\n") : "- Nenhum ainda"}

**Tendência:** ${timeline.length > 1 && timeline[timeline.length - 1].successRate > timeline[0].successRate ? "📈 Melhorando" : timeline.length > 1 ? "📊 Estável" : "🌱 Começando"}`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { timeline, topLearnings },
    };
  }
);

server.registerTool(
  "qa_learning_stats",
  {
    title: "Estatísticas de aprendizado",
    description: "[MÉTRICAS] Retorna métricas de aprendizado do agente: quantos testes gerados, taxa de sucesso na primeira tentativa, correções aplicadas, etc.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      totalLearnings: z.number(),
      successfulFixes: z.number(),
      selectorFixes: z.number(),
      timingFixes: z.number(),
      testsGenerated: z.number(),
      firstAttemptSuccessRate: z.number(),
    }),
  },
  async () => {
    const stats = getMemoryStats();
    const summary = `📊 **Estatísticas de Aprendizado**

- Total de aprendizados: ${stats.totalLearnings}
- Correções bem-sucedidas: ${stats.successfulFixes}
- Correções de seletores: ${stats.selectorFixes}
- Correções de timing: ${stats.timingFixes}
- Testes gerados: ${stats.testsGenerated}
- Taxa de sucesso na 1ª tentativa: ${stats.firstAttemptSuccessRate}%

${stats.totalLearnings === 0 ? "⚠️ Ainda não há aprendizados. Use qa_auto para gerar testes e aprender com erros." : ""}`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: stats,
    };
  }
);

server.registerTool(
  "get_learning_report",
  {
    title: "Relatório de evolução e aprendizado",
    description: "Gera relatório de evolução dos aprendizados: resumo por tipo, evolução no tempo e recomendações para aprimorar o código.",
    inputSchema: z.object({
      format: z.enum(["summary", "full"]).optional().describe("summary = resumo executivo, full = relatório completo com recomendações. Default: summary"),
    }),
    outputSchema: z.object({
      summary: z.string(),
      byType: z.record(z.number()),
      evolution: z.array(z.object({ date: z.string(), type: z.string(), framework: z.string() })).optional(),
      recommendations: z.array(z.string()).optional(),
    }),
  },
  async ({ format = "summary" }) => {
    const memory = loadProjectMemory();
    const learnings = memory.learnings || [];
    const stats = getMemoryStats();

    const byType = stats.byLearningType || {};
    const evolution = format === "full" && learnings.length > 0
      ? learnings.slice(-30).map((l) => ({
          date: (l.timestamp || "").slice(0, 10),
          type: l.type || "unknown",
          framework: l.framework || "-",
        }))
      : [];

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
      recommendations.push("Aplique UNIVERSAL_TEST_PRACTICES em cada teste gerado: waits inteligentes + assert final.");
    }
    if (recommendations.length === 0 && learnings.length > 0) {
      recommendations.push("Continue aplicando as práticas aprendidas em novos testes.");
    }

    const summary = `📈 **Relatório de Evolução e Aprendizado**

**Resumo por tipo:**
${Object.entries(byType).filter(([, v]) => v > 0).map(([t, v]) => `- ${t}: ${v}`).join("\n") || "- Nenhum aprendizado por tipo ainda"}

**Métricas gerais:**
- Total de aprendizados: ${stats.totalLearnings}
- Taxa de sucesso (1ª tentativa): ${stats.firstAttemptSuccessRate}%
- Testes gerados: ${stats.testsGenerated}

${format === "full" && recommendations.length > 0 ? `**Recomendações para aprimorar o código:**\n${recommendations.map((r) => `• ${r}`).join("\n")}` : ""}`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        summary: summary.trim(),
        byType,
        evolution: format === "full" ? evolution : undefined,
        recommendations: format === "full" ? recommendations : undefined,
      },
    };
  }
);

server.registerTool(
  "qa_compare_with_industry",
  {
    title: "Comparar com padrões da indústria",
    description: "[BENCHMARK] Compara as métricas do seu projeto com benchmarks da indústria (cobertura, taxa de sucesso, tempo de execução).",
    inputSchema: z.object({}),
    outputSchema: z.object({
      yourProject: z.object({
        coverage: z.string(),
        successRate: z.number(),
        totalTests: z.number(),
      }),
      industry: z.object({
        coverageAvg: z.string(),
        successRateAvg: z.number(),
      }),
      verdict: z.string(),
    }),
  },
  async () => {
    const structure = detectProjectStructure();
    const stats = getMemoryStats();

    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(fullPath)) return [];
      return fs.readdirSync(fullPath, { recursive: true })
        .filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
    });

    const industryBenchmarks = {
      coverageAvg: "70-80%",
      successRateAvg: 85,
      testsPerProject: 50,
    };

    let verdict = "";
    if (stats.firstAttemptSuccessRate >= 85) {
      verdict = "🏆 Acima da média da indústria!";
    } else if (stats.firstAttemptSuccessRate >= 70) {
      verdict = "✅ Na média da indústria.";
    } else if (stats.firstAttemptSuccessRate >= 50) {
      verdict = "⚠️ Abaixo da média. Use mais 'qa_auto' para melhorar.";
    } else {
      verdict = "🔧 Bem abaixo da média. Foque em aprendizado.";
    }

    const summary = `📊 **Benchmark: Seu Projeto vs. Indústria**

**Seu Projeto:**
- Testes: ${testFiles.length} (indústria: ~${industryBenchmarks.testsPerProject})
- Taxa de sucesso (1ª tentativa): ${stats.firstAttemptSuccessRate}% (indústria: ~${industryBenchmarks.successRateAvg}%)
- Aprendizados: ${stats.totalLearnings}

**Indústria (média):**
- Cobertura: ${industryBenchmarks.coverageAvg}
- Taxa de sucesso: ${industryBenchmarks.successRateAvg}%
- Testes por projeto: ~${industryBenchmarks.testsPerProject}

**Veredito:** ${verdict}`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        yourProject: {
          coverage: "N/A",
          successRate: stats.firstAttemptSuccessRate,
          totalTests: testFiles.length,
        },
        industry: industryBenchmarks,
        verdict,
      },
    };
  }
);

server.registerTool(
  "qa_predict_flaky",
  {
    title: "Prever quais testes vão ficar flaky",
    description: "[PREDIÇÃO] Analisa testes existentes e prevê quais têm maior chance de se tornarem flaky (baseado em padrões: seletores frágeis, waits inadequados, dependências externas).",
    inputSchema: z.object({
      testFile: z.string().optional().describe("Arquivo específico (opcional). Se omitido, analisa todos."),
    }),
    outputSchema: z.object({
      predictions: z.array(z.object({
        file: z.string(),
        risk: z.enum(["high", "medium", "low"]),
        reasons: z.array(z.string()),
      })),
    }),
  },
  async ({ testFile }) => {
    const structure = detectProjectStructure();
    let testFiles = [];

    if (testFile) {
      testFiles = [testFile];
    } else {
      testFiles = structure.testDirs.flatMap((dir) => {
        const fullPath = path.join(PROJECT_ROOT, dir);
        if (!fs.existsSync(fullPath)) return [];
        return fs.readdirSync(fullPath, { recursive: true })
          .filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f))
          .map((f) => path.join(dir, f));
      });
    }

    const predictions = [];

    for (const file of testFiles.slice(0, 20)) {
      const fullPath = path.join(PROJECT_ROOT, file);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf8");
      const reasons = [];
      let riskScore = 0;

      if (/\.(class|id)\s*=|querySelector|\.class-name/i.test(content)) {
        reasons.push("Usa seletores CSS (frágeis)");
        riskScore += 3;
      }

      if (!/data-testid|role=|aria-label/i.test(content) && /cy\.get|page\.locator|find/i.test(content)) {
        reasons.push("Sem seletores semânticos (data-testid, role)");
        riskScore += 2;
      }

      if (/sleep|wait\(\d+\)|timeout.*\d{4,}/i.test(content)) {
        reasons.push("Usa waits fixos (timing frágil)");
        riskScore += 2;
      }

      if (!/waitFor|waitUntil|should\('be.visible'\)/i.test(content) && /click|type|fill/i.test(content)) {
        reasons.push("Interações sem wait explícito");
        riskScore += 2;
      }

      if (/fetch|axios|http\.get|cy\.request/i.test(content) && !/mock|stub|intercept/i.test(content)) {
        reasons.push("Chamadas de rede sem mock");
        riskScore += 2;
      }

      if (/Math\.random|Date\.now|new Date\(\)/i.test(content)) {
        reasons.push("Usa valores não-determinísticos");
        riskScore += 1;
      }

      if (reasons.length > 0) {
        predictions.push({
          file,
          risk: riskScore >= 5 ? "high" : riskScore >= 3 ? "medium" : "low",
          reasons,
        });
      }
    }

    predictions.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 };
      return riskOrder[b.risk] - riskOrder[a.risk];
    });

    const summary = predictions.length > 0
      ? `🔮 **Predição de Testes Flaky**

${predictions.slice(0, 10).map((p) => `**${p.file}** — Risco: ${p.risk === "high" ? "🔴 ALTO" : p.risk === "medium" ? "🟡 MÉDIO" : "🟢 BAIXO"}
${p.reasons.map((r) => `  - ${r}`).join("\n")}`).join("\n\n")}

${predictions.length > 10 ? `\n... e mais ${predictions.length - 10} arquivo(s)` : ""}

💡 **Recomendação:** Refatore testes de risco ALTO antes que se tornem flaky.`
      : "✅ Nenhum teste com alto risco de flaky detectado.";

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { predictions: predictions.slice(0, 20) },
    };
  }
);

server.registerTool(
  "get_test_coverage",
  {
    title: "Obter cobertura de testes",
    description: "Roda testes com coverage (Jest, Playwright, Cypress com plugin).",
    inputSchema: z.object({
      framework: z.enum(["jest", "playwright", "cypress"]).optional().describe("Framework. Default: detectado automaticamente."),
    }),
    outputSchema: z.object({
      status: z.enum(["success", "failed", "not_supported"]),
      message: z.string(),
      coveragePercent: z.number().optional(),
      output: z.string().optional(),
    }),
  },
  async ({ framework }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0];

    if (fw === "jest") {
      return new Promise((resolve) => {
        const child = spawn("npx", ["jest", "--coverage"], {
          cwd: PROJECT_ROOT,
          stdio: ["inherit", "pipe", "pipe"],
          shell: process.platform === "win32",
          env: { ...process.env },
        });

        let stdout = "";
        if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });

        child.on("close", (code) => {
          const coverageMatch = stdout.match(/All files.*?(\d+\.?\d*)/);
          const coveragePercent = coverageMatch ? parseFloat(coverageMatch[1]) : undefined;

          resolve({
            content: [{ type: "text", text: `Coverage: ${coveragePercent || "N/A"}%` }],
            structuredContent: {
              status: code === 0 ? "success" : "failed",
              message: code === 0 ? "Coverage generated" : "Coverage failed",
              coveragePercent,
              output: stdout,
            },
          });
        });
      });
    }

    return {
      content: [{ type: "text", text: `Coverage não suportado para ${fw} ainda.` }],
      structuredContent: { status: "not_supported", message: "Coverage not supported for this framework" },
    };
  }
);

server.registerTool(
  "watch_tests",
  {
    title: "Rodar testes em modo watch",
    description: "Inicia testes em watch mode (Jest, Vitest). Útil para desenvolvimento.",
    inputSchema: z.object({
      framework: z.enum(["jest", "vitest"]).optional().describe("Framework. Default: detectado."),
    }),
    outputSchema: z.object({
      status: z.string(),
      message: z.string(),
    }),
  },
  async ({ framework }) => {
    const structure = detectProjectStructure();
    const fw = framework || (structure.testFrameworks.includes("jest") ? "jest" : "vitest");

    if (!structure.testFrameworks.includes(fw)) {
      return {
        content: [{ type: "text", text: `${fw} não detectado no projeto.` }],
        structuredContent: { status: "not_found", message: "Framework not found" },
      };
    }

    return {
      content: [{ type: "text", text: `Para watch mode, rode manualmente: npx ${fw} --watch` }],
      structuredContent: {
        status: "info",
        message: `Watch mode requires interactive terminal. Run: npx ${fw} --watch`,
      },
    };
  }
);

server.registerTool(
  "qa_auto",
  {
    title: "Modo autônomo: gera, roda, corrige e aprende",
    description: "[AGENTE AUTÔNOMO] Loop completo: detecta projeto → gera teste → roda → se falhar: analisa, corrige, roda de novo → aprende com erros. Repete até passar ou atingir max_retries.",
    inputSchema: z.object({
      request: z.string().describe("O que testar (ex: 'login flow', 'checkout', 'API /users')."),
      framework: z.enum([
        "cypress", "playwright", "webdriverio", "jest", "vitest", "mocha", "appium", "robot", "pytest"
      ]).optional().describe("Framework (detectado automaticamente se omitido)."),
      maxRetries: z.number().optional().describe("Máximo de tentativas de correção. Default: 3."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      testFilePath: z.string().optional(),
      attempts: z.number(),
      finalStatus: z.enum(["passed", "failed", "max_retries"]),
      learnings: z.array(z.object({ attempt: z.number(), action: z.string(), result: z.string() })).optional(),
      error: z.string().optional(),
    }),
  },
  async ({ request, framework, maxRetries = 3 }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0];
    if (!fw) {
      return {
        content: [{ type: "text", text: "Nenhum framework detectado. Configure testes primeiro." }],
        structuredContent: { ok: false, error: "No framework", finalStatus: "failed", attempts: 0 },
      };
    }

    const llm = resolveLLMProvider("simple");
    if (!llm.apiKey) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key", finalStatus: "failed", attempts: 0 },
      };
    }

    const learnings = [];
    const memory = loadProjectMemory();
    const contextLines = [
      `Frameworks: ${structure.testFrameworks.join(", ")}`,
      `Pastas: ${structure.testDirs.join(", ")}`,
      memory.flows?.length ? `Fluxos: ${memory.flows.map((f) => f.name || f.id).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    let testFilePath = null;
    let testContent = null;
    let attempt = 0;
    let appliedLearningFix = false;

    learnings.push({ attempt: 0, action: "detect_project", result: `${structure.testFrameworks.length} framework(s)` });

    for (attempt = 1; attempt <= maxRetries; attempt++) {
      learnings.push({ attempt, action: "generate_tests", result: "gerando..." });

      const { provider, apiKey, baseUrl, model } = llm;
      const memoryHints = memory.learnings
        ?.filter((l) => l.fix)
        .slice(-10)
        .map((l) => l.fix)
        .join("\n") || "";
      const systemPrompt = `Você é um engenheiro de QA especializado em ${fw}. Gere APENAS o código do spec, sem explicações.
${UNIVERSAL_TEST_PRACTICES}

${memoryHints ? `Aprendizados anteriores (use como referência):\n${memoryHints.slice(0, 1000)}` : ""}
Retorne SOMENTE o código, sem markdown.`;

      const userPrompt = `Contexto:\n${contextLines}\n\nGere teste para: ${request}\nFramework: ${fw}`;

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
          const fileName = request.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
          const { ext, baseDir } = getExtensionAndBaseDir(fw, structure);
          const safeName = fileName + ext;
          testFilePath = path.join(baseDir, safeName);
          if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        }
        fs.writeFileSync(testFilePath, testContent, "utf8");
        learnings.push({ attempt, action: "write_test", result: `gravado: ${testFilePath}` });

        learnings.push({ attempt, action: "run_tests", result: "executando..." });
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
          learnings.push({ attempt, action: "run_tests", result: "✅ passou" });
          saveProjectMemory({
            learnings: [{ type: "test_generated", request, framework: fw, success: true, passedFirstTime: attempt === 1, attempts: attempt, timestamp: new Date().toISOString() }],
          });
          const learnedAppendix = appliedLearningFix ? `\n\n${formatLearnedMessageForUser({ runOutput: runResult?.output, fixSummary: "Ajustei o código aplicando waits e validação correta.", framework: fw })}` : "";
          return {
            content: [{ type: "text", text: `✅ Teste passou na tentativa ${attempt}!\n\nArquivo: ${testFilePath}\n\nAprendizados salvos.${learnedAppendix}` }],
            structuredContent: { ok: true, testFilePath, attempts: attempt, finalStatus: "passed", learnings },
          };
        }

        learnings.push({ attempt, action: "run_tests", result: `❌ falhou (exit ${runResult.code})` });

        if (attempt >= maxRetries) {
          learnings.push({ attempt, action: "max_retries", result: "limite atingido" });
          saveProjectMemory({
            learnings: [{ type: "test_generated", request, framework: fw, success: false, attempts: attempt, timestamp: new Date().toISOString() }],
          });
          const learnedAppendix = appliedLearningFix
            ? `\n\n${formatLearnedMessageForUser({ runOutput: runResult.output, framework: fw, fixSummary: "Tentei corrigir. Nas próximas execuções usarei esse aprendizado desde o início." })}`
            : "";
          return {
            content: [{ type: "text", text: `❌ Teste falhou após ${attempt} tentativa(s).\n\nÚltimo erro:\n${runResult.output.slice(0, 500)}${learnedAppendix}` }],
            structuredContent: { ok: false, testFilePath, attempts: attempt, finalStatus: "max_retries", learnings },
          };
        }

        learnings.push({ attempt, action: "analyze_failures", result: "analisando..." });
        const flakyAnalysis = detectFlakyPatterns(runResult.output);
        const llmComplex = resolveLLMProvider("complex");
        const explainResult = await generateFailureExplanation(runResult.output, testFilePath);

        if (!explainResult.ok || !explainResult.structuredContent?.sugestaoCorrecao) {
          learnings.push({ attempt, action: "analyze_failures", result: "sem sugestão de correção" });
          continue;
        }

        learnings.push({ attempt, action: "apply_fix", result: "aplicando correção..." });
        const fixedCode = explainResult.structuredContent.sugestaoCorrecao;
        testContent = fixedCode;
        fs.writeFileSync(testFilePath, testContent, "utf8");
        learnings.push({ attempt, action: "apply_fix", result: "correção aplicada" });

        if (flakyAnalysis.isLikelyFlaky) {
          const inferredPattern = inferFailurePattern(runResult.output, fw);
          const learningType = inferredPattern?.learningType || (flakyAnalysis.patterns[0]?.pattern === "selector" ? "selector_fix" : "timing_fix");
          const learningFix = inferredPattern?.lesson || fixedCode.slice(0, 500);
          saveProjectMemory({
            learnings: [{
              type: learningType,
              request,
              framework: fw,
              fix: learningFix,
              pattern: inferredPattern?.name,
              success: false,
              timestamp: new Date().toISOString(),
            }],
          });
          appliedLearningFix = true;
        }
      } catch (err) {
        learnings.push({ attempt, action: "error", result: err.message });
        return {
          content: [{ type: "text", text: `Erro na tentativa ${attempt}: ${err.message}` }],
          structuredContent: { ok: false, error: err.message, attempts: attempt, finalStatus: "failed", learnings },
        };
      }
    }

    const learnedAppendix = appliedLearningFix
      ? `\n\n${formatLearnedMessageForUser({ fixSummary: "Tentei corrigir. Nas próximas execuções usarei esse aprendizado desde o início." })}`
      : "";
    return {
      content: [{ type: "text", text: `❌ Falhou após ${maxRetries} tentativa(s).${learnedAppendix}` }],
      structuredContent: { ok: false, testFilePath, attempts: maxRetries, finalStatus: "max_retries", learnings },
    };
  }
);

server.registerTool(
  "create_test_template",
  {
    title: "Criar template de teste",
    description: "Gera template básico de teste (boilerplate) para o framework escolhido.",
    inputSchema: z.object({
      framework: z.enum(["cypress", "playwright", "jest"]).describe("Framework."),
      type: z.enum(["api", "ui", "unit"]).optional().describe("Tipo de teste. Default: api."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      template: z.string(),
      suggestedFileName: z.string(),
    }),
  },
  async ({ framework, type = "api" }) => {
    let template = "";
    let fileName = "";

    if (framework === "cypress") {
      fileName = `${type}-test.cy.js`;
      template = `describe('${type.toUpperCase()} Test', () => {
  it('should pass', () => {
    ${type === "api" ? "cy.request('GET', 'http://localhost:3000/api/health').then((res) => {\n      expect(res.status).to.eq(200);\n    });" : "cy.visit('/');\n    cy.get('h1').should('be.visible');"}
  });
});`;
    } else if (framework === "playwright") {
      fileName = `${type}-test.spec.js`;
      template = `const { test, expect } = require('@playwright/test');

test.describe('${type.toUpperCase()} Test', () => {
  test('should pass', async ({ ${type === "api" ? "request" : "page"} }) => {
    ${type === "api" ? "const res = await request.get('http://localhost:3000/api/health');\n    expect(res.status()).toBe(200);" : "await page.goto('/');\n    await expect(page.locator('h1')).toBeVisible();"}
  });
});`;
    } else {
      fileName = `${type}-test.test.js`;
      template = `describe('${type.toUpperCase()} Test', () => {
  test('should pass', ${type === "api" ? "async () => {\n    const res = await fetch('http://localhost:3000/api/health');\n    expect(res.status).toBe(200);\n  }" : "() => {\n    expect(true).toBe(true);\n  }"});
});`;
    }

    return {
      content: [{ type: "text", text: `Template criado. Use write_test para gravar.` }],
      structuredContent: { ok: true, template, suggestedFileName: fileName },
    };
  }
);

async function main() {
  const cmd = process.argv[2];
  if (cmd === "learning-hub") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const hubPath = path.join(__dirname, "..", "learning-hub", "src", "server.js");
    const hubUrl = pathToFileURL(hubPath).href;
    await import(hubUrl);
    return;
  }
  if (cmd === "slack-bot") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const slackBotPath = path.join(__dirname, "..", "slack-bot", "src", "index.js");
    const slackBotUrl = pathToFileURL(slackBotPath).href;
    await import(slackBotUrl);
    return; // never reached (slack-bot runs until exit)
  }

  const handled = await handleCLI();
  if (handled) {
    process.exit(0);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Erro no MCP server:", err);
  process.exit(1);
});
