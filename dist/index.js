#!/usr/bin/env node

// src/index.js
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
var PROJECT_ROOT = process.cwd();
config({ path: path.join(PROJECT_ROOT, ".env") });
var server = new McpServer({
  name: "mcp-lab-agent",
  version: "1.0.0"
});
function resolveLLMProvider(taskType = "simple") {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.QA_LAB_LLM_API_KEY;
  const simpleModel = process.env.QA_LAB_LLM_SIMPLE;
  const complexModel = process.env.QA_LAB_LLM_COMPLEX;
  let provider = GROQ_KEY ? "groq" : GEMINI_KEY ? "gemini" : "openai";
  const apiKey = GROQ_KEY || GEMINI_KEY || OPENAI_KEY;
  const baseUrl = provider === "groq" ? "https://api.groq.com/openai/v1" : provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1";
  let model;
  if (taskType === "complex") {
    model = complexModel || (provider === "groq" ? "llama-3.3-70b-versatile" : provider === "gemini" ? "gemini-1.5-pro" : "gpt-4o");
  } else {
    model = simpleModel || (provider === "groq" ? "llama-3.1-8b-instant" : provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
  }
  return { provider, apiKey, baseUrl, model };
}
var MEMORY_FILE = path.join(PROJECT_ROOT, ".qa-lab-memory.json");
var FLOWS_CONFIG_FILE = path.join(PROJECT_ROOT, "qa-lab-flows.json");
function loadProjectMemory() {
  const memory = { patterns: {}, conventions: {}, lastRun: null, selectors: [] };
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const raw = fs.readFileSync(MEMORY_FILE, "utf8");
      Object.assign(memory, JSON.parse(raw));
    } catch {
    }
  }
  if (fs.existsSync(FLOWS_CONFIG_FILE)) {
    try {
      const flows = JSON.parse(fs.readFileSync(FLOWS_CONFIG_FILE, "utf8"));
      memory.flows = flows.flows || [];
    } catch {
    }
  }
  return memory;
}
function saveProjectMemory(updates) {
  try {
    let data = loadProjectMemory();
    if (updates.patterns) data.patterns = { ...data.patterns, ...updates.patterns };
    if (updates.conventions) data.conventions = { ...data.conventions, ...updates.conventions };
    if (updates.selectors) data.selectors = [.../* @__PURE__ */ new Set([...data.selectors || [], ...updates.selectors])].slice(-100);
    if (updates.lastRun) data.lastRun = updates.lastRun;
    data.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
  }
}
var FLAKY_PATTERNS = [
  { name: "timing", regex: /timeout|timed out|exceeded|wait|delay|slow|race condition/i, suggestion: "Adicione wait expl\xEDcito (ex: page.waitForSelector) ou aumente o timeout." },
  { name: "ordering", regex: /order|sequenc|flaky|intermittent|sometimes|random/i, suggestion: "Issole o teste ou use beforeAll/afterAll para estado limpo. Evite depend\xEAncia de ordem entre testes." },
  { name: "selector", regex: /element not found|selector|locator|cy\.get|page\.locator|Unable to find/i, suggestion: "Use seletores est\xE1veis: data-testid, role, texto acess\xEDvel. Evite classes CSS din\xE2micas." },
  { name: "network", regex: /ECONNREFUSED|network|fetch|axios|request failed|404|500/i, suggestion: "Mocke APIs ou garanta que o backend esteja rodando. Use retry ou intercept." },
  { name: "shared_state", regex: /state|cleanup|beforeEach|afterEach|isolation/i, suggestion: "Garanta beforeEach/afterEach para resetar estado. Evite vari\xE1veis globais compartilhadas." }
];
function detectFlakyPatterns(runOutput) {
  const detected = [];
  for (const p of FLAKY_PATTERNS) {
    if (p.regex.test(runOutput)) {
      detected.push({ pattern: p.name, suggestion: p.suggestion });
    }
  }
  const confidence = detected.length > 0 ? Math.min(0.5 + detected.length * 0.2, 0.95) : 0;
  return { isLikelyFlaky: confidence > 0.5, confidence, patterns: detected };
}
function detectProjectStructure() {
  const structure = {
    hasTests: false,
    testFrameworks: [],
    testDirs: [],
    hasBackend: false,
    backendDir: null,
    hasFrontend: false,
    frontendDir: null,
    hasMobile: false,
    packageJson: null,
    pythonRequirements: null
  };
  const pkgPath = path.join(PROJECT_ROOT, "package.json");
  if (fs.existsSync(pkgPath)) {
    structure.packageJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = {
      ...structure.packageJson.dependencies,
      ...structure.packageJson.devDependencies
    };
    if (deps.cypress) {
      structure.testFrameworks.push("cypress");
      structure.hasTests = true;
    }
    if (deps["@playwright/test"] || deps.playwright) {
      structure.testFrameworks.push("playwright");
      structure.hasTests = true;
    }
    if (deps.webdriverio || deps["@wdio/cli"]) {
      structure.testFrameworks.push("webdriverio");
      structure.hasTests = true;
    }
    if (deps.jest) {
      structure.testFrameworks.push("jest");
      structure.hasTests = true;
    }
    if (deps.vitest) {
      structure.testFrameworks.push("vitest");
      structure.hasTests = true;
    }
    if (deps.mocha) {
      structure.testFrameworks.push("mocha");
      structure.hasTests = true;
    }
    if (deps.jasmine) {
      structure.testFrameworks.push("jasmine");
      structure.hasTests = true;
    }
    if (deps.appium || deps["appium-webdriverio"]) {
      structure.testFrameworks.push("appium");
      structure.hasTests = true;
      structure.hasMobile = true;
    }
    if (deps.detox) {
      structure.testFrameworks.push("detox");
      structure.hasTests = true;
      structure.hasMobile = true;
    }
    if (deps.supertest) {
      structure.testFrameworks.push("supertest");
      structure.hasTests = true;
    }
    if (deps["@pactum/pactum"] || deps.pactum) {
      structure.testFrameworks.push("pactum");
      structure.hasTests = true;
    }
    if (deps.testcafe || deps["testcafe"]) {
      structure.testFrameworks.push("testcafe");
      structure.hasTests = true;
    }
    if (deps.nightwatch || deps["nightwatch"]) {
      structure.testFrameworks.push("nightwatch");
      structure.hasTests = true;
    }
    if (deps.puppeteer) {
      structure.testFrameworks.push("puppeteer");
      structure.hasTests = true;
    }
    if (deps.codeceptjs || deps["codeceptjs"]) {
      structure.testFrameworks.push("codeceptjs");
      structure.hasTests = true;
    }
    if (deps.express || deps.fastify || deps["@nestjs/core"] || deps.koa) {
      structure.hasBackend = true;
    }
    if (deps.next || deps.react || deps.vue || deps.svelte || deps.angular) {
      structure.hasFrontend = true;
    }
  }
  const requirementsPath = path.join(PROJECT_ROOT, "requirements.txt");
  if (fs.existsSync(requirementsPath)) {
    const requirements = fs.readFileSync(requirementsPath, "utf8");
    structure.pythonRequirements = requirements;
    if (/robotframework/i.test(requirements)) {
      structure.testFrameworks.push("robot");
      structure.hasTests = true;
    }
    if (/pytest/i.test(requirements)) {
      structure.testFrameworks.push("pytest");
      structure.hasTests = true;
    }
    if (/behave/i.test(requirements)) {
      structure.testFrameworks.push("behave");
      structure.hasTests = true;
    }
    if (/requests/i.test(requirements)) {
      structure.hasBackend = true;
    }
  }
  const commonTestDirs = [
    "tests",
    "test",
    "e2e",
    "cypress",
    "playwright",
    "__tests__",
    "specs",
    "spec",
    "integration",
    "unit",
    "functional",
    "robot",
    "features",
    "scenarios",
    "mobile",
    "api",
    // Monorepo: subprojetos por framework
    "playwright-js",
    "puppeteer-js",
    "testcafe-js",
    "wdio-webdriver-io",
    "nightwatch-js",
    "codeceptjs",
    "robot-framework",
    "selenium-python"
  ];
  for (const dir of commonTestDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      structure.testDirs.push(dir);
    }
  }
  const skipDirs = ["node_modules", ".git", "dist", "build", ".next", ".venv"];
  try {
    const rootEntries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });
    for (const e of rootEntries) {
      if (!e.isDirectory() || skipDirs.includes(e.name)) continue;
      const subPath = path.join(PROJECT_ROOT, e.name);
      if (structure.testDirs.includes(e.name)) continue;
      const hasPkg = fs.existsSync(path.join(subPath, "package.json"));
      const hasTests = fs.existsSync(path.join(subPath, "tests")) || fs.existsSync(path.join(subPath, "test")) || fs.existsSync(path.join(subPath, "e2e")) || fs.existsSync(path.join(subPath, "__tests__")) || fs.existsSync(path.join(subPath, "specs"));
      if (hasPkg || hasTests) {
        structure.testDirs.push(e.name);
      }
    }
  } catch {
  }
  for (const dir of structure.testDirs) {
    const subPkg = path.join(PROJECT_ROOT, dir, "package.json");
    if (!fs.existsSync(subPkg)) continue;
    try {
      const sub = JSON.parse(fs.readFileSync(subPkg, "utf8"));
      const subDeps = { ...sub.dependencies || {}, ...sub.devDependencies || {} };
      const toAdd = [];
      if (subDeps.cypress && !structure.testFrameworks.includes("cypress")) toAdd.push("cypress");
      if ((subDeps["@playwright/test"] || subDeps.playwright) && !structure.testFrameworks.includes("playwright")) toAdd.push("playwright");
      if ((subDeps.webdriverio || subDeps["@wdio/cli"]) && !structure.testFrameworks.includes("webdriverio")) toAdd.push("webdriverio");
      if (subDeps.testcafe && !structure.testFrameworks.includes("testcafe")) toAdd.push("testcafe");
      if (subDeps.nightwatch && !structure.testFrameworks.includes("nightwatch")) toAdd.push("nightwatch");
      if (subDeps.puppeteer && !structure.testFrameworks.includes("puppeteer")) toAdd.push("puppeteer");
      if (subDeps.codeceptjs && !structure.testFrameworks.includes("codeceptjs")) toAdd.push("codeceptjs");
      if (subDeps.jest && !structure.testFrameworks.includes("jest")) toAdd.push("jest");
      toAdd.forEach((fw) => {
        structure.testFrameworks.push(fw);
        structure.hasTests = true;
      });
    } catch {
    }
  }
  for (const dir of structure.testDirs) {
    const reqPath = path.join(PROJECT_ROOT, dir, "requirements.txt");
    if (!fs.existsSync(reqPath)) continue;
    try {
      const req = fs.readFileSync(reqPath, "utf8");
      if (/robotframework/i.test(req) && !structure.testFrameworks.includes("robot")) {
        structure.testFrameworks.push("robot");
        structure.hasTests = true;
      }
      if (/pytest|selenium/i.test(req) && !structure.testFrameworks.includes("pytest")) {
        structure.testFrameworks.push("pytest");
        structure.hasTests = true;
      }
    } catch {
    }
  }
  const commonBackendDirs = ["backend", "server", "api", "src"];
  for (const dir of commonBackendDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath) && !structure.backendDir) {
      const hasServerFile = fs.existsSync(path.join(fullPath, "server.js")) || fs.existsSync(path.join(fullPath, "index.js")) || fs.existsSync(path.join(fullPath, "app.js"));
      if (hasServerFile) {
        structure.backendDir = dir;
      }
    }
  }
  const commonFrontendDirs = ["frontend", "client", "web", "app", "src"];
  for (const dir of commonFrontendDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath) && !structure.frontendDir) {
      const hasAppFile = fs.existsSync(path.join(fullPath, "App.js")) || fs.existsSync(path.join(fullPath, "App.tsx")) || fs.existsSync(path.join(fullPath, "index.html"));
      if (hasAppFile) {
        structure.frontendDir = dir;
      }
    }
  }
  return structure;
}
var UNIVERSAL_TEST_PATTERNS = [
  /\.(cy|spec|test)\.(js|ts|jsx|tsx)$/i,
  /_test\.(js|ts)$/i,
  // CodeceptJS
  /\.robot$/i,
  /\.feature$/i,
  /^(test_.*|.*_test)\.py$/i,
  /\.steps?\.(js|ts|py)$/i,
  /\.e2e\.(js|ts)$/i,
  /\.it\.(js|ts)$/i
];
function isTestFile(name) {
  return UNIVERSAL_TEST_PATTERNS.some((re) => re.test(name));
}
function collectTestFiles(structure, options = {}) {
  const { pattern, framework, maxContentFiles = 0 } = options;
  const results = [];
  for (const dir of structure.testDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    const walk = (p, base = "") => {
      if (!fs.existsSync(p)) return;
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === ".git" || e.name === ".venv") continue;
          walk(path.join(p, e.name), rel);
        } else if (e.isFile() && isTestFile(e.name)) {
          const filePath = `${dir}/${rel}`;
          if (pattern && !filePath.toLowerCase().includes(pattern.toLowerCase())) continue;
          const inferredFw = inferFrameworkFromFile(e.name, structure, filePath);
          if (framework && framework !== "all" && inferredFw !== framework && !matchesFramework(inferredFw, framework)) continue;
          const entry = { path: filePath, inferredFramework: inferredFw };
          if (maxContentFiles > 0 && results.length < maxContentFiles) {
            try {
              entry.content = fs.readFileSync(path.join(PROJECT_ROOT, filePath), "utf8");
            } catch {
            }
          }
          results.push(entry);
        }
      }
    };
    walk(fullPath);
  }
  return results;
}
function inferFrameworkFromFile(name, structure = {}, filePath = "") {
  const pathLower = (filePath || "").toLowerCase().replace(/\\/g, "/");
  if (/[\/]cypress[\/\-]/.test(pathLower)) return "cypress";
  if (/[\/]playwright[\/\-]/.test(pathLower)) return "playwright";
  if (/[\/]wdio[\/\-]|[\/]webdriver[\/\-]/.test(pathLower)) return "webdriverio";
  if (/[\/]appium[\/\-]/.test(pathLower)) return "appium";
  if (/[\/]selenium-python[\/]|[\/]pytest[\/\-]/.test(pathLower)) return "pytest";
  if (/[\/]robot[\/\-]/.test(pathLower)) return "robot";
  if (/[\/]codecept[\/\-]/.test(pathLower)) return "codeceptjs";
  if (/[\/]nightwatch[\/\-]/.test(pathLower)) return "nightwatch";
  if (/[\/]testcafe[\/\-]/.test(pathLower)) return "testcafe";
  if (/[\/]puppeteer[\/\-]/.test(pathLower)) return "puppeteer";
  if (/[\/]behave[\/\-]|[\/]features[\/]/.test(pathLower)) return "behave";
  if (/\.cy\.(js|ts|jsx|tsx)/i.test(name)) return "cypress";
  if (/_test\.(js|ts)$/i.test(name)) return "codeceptjs";
  if (/\.spec\.(js|ts|jsx|tsx)/i.test(name)) {
    if (structure?.testFrameworks?.includes("webdriverio")) return "webdriverio";
    if (structure?.testFrameworks?.includes("appium")) return "appium";
    return "playwright";
  }
  if (/\.test\.(js|ts|jsx|tsx)/i.test(name)) return structure?.testFrameworks?.includes("vitest") ? "vitest" : "jest";
  if (/\.robot$/i.test(name)) return "robot";
  if (/\.feature$/i.test(name)) return "behave";
  if (/\.(py|steps?\.py)$/i.test(name) || /^(test_.*|.*_test)\.py$/i.test(name)) return "pytest";
  if (/\.e2e\.(js|ts)/i.test(name)) return "playwright";
  return "unknown";
}
function matchesFramework(inferred, requested) {
  const aliases = { spec: ["playwright", "webdriverio", "appium"] };
  if (inferred === requested) return true;
  return aliases[inferred]?.includes(requested);
}
function getFrameworkCwd(structure, preferredDirs) {
  for (const dir of preferredDirs) {
    if (structure.testDirs.includes(dir)) {
      return path.join(PROJECT_ROOT, dir);
    }
  }
  const fallback = structure.testDirs[0];
  return fallback ? path.join(PROJECT_ROOT, fallback) : PROJECT_ROOT;
}
var METRICS_FILE = path.join(PROJECT_ROOT, ".qa-lab-metrics.json");
function parseTestRunResult(runOutput, exitCode) {
  let passed = 0;
  let failed = 0;
  const jestMatch = runOutput.match(/Tests:\s+(\d+)\s+passed(?:,\s*(\d+)\s+failed)?/);
  if (jestMatch) {
    passed = parseInt(jestMatch[1], 10);
    failed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0;
  }
  const cypressPass = runOutput.match(/(\d+)\s+passing/);
  const cypressFail = runOutput.match(/(\d+)\s+failing/);
  if (cypressPass) passed = parseInt(cypressPass[1], 10);
  if (cypressFail) failed = parseInt(cypressFail[1], 10);
  const pwPass = runOutput.match(/(\d+)\s+passed/);
  const pwFail = runOutput.match(/(\d+)\s+failed/);
  if (pwPass) passed = parseInt(pwPass[1], 10);
  if (pwFail) failed = parseInt(pwFail[1], 10);
  if (passed === 0 && failed === 0) {
    if (exitCode === 0) passed = 1;
    else failed = 1;
  }
  return { passed, failed };
}
function appendMetricsEvent(event) {
  try {
    let data = { events: [], lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
    if (fs.existsSync(METRICS_FILE)) {
      const raw = fs.readFileSync(METRICS_FILE, "utf8");
      try {
        data = JSON.parse(raw);
      } catch {
      }
    }
    data.events = data.events || [];
    data.events.push({ ...event, timestamp: event.timestamp || (/* @__PURE__ */ new Date()).toISOString() });
    data.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    if (data.events.length > 500) data.events = data.events.slice(-400);
    fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
  }
}
function extractFailuresFromOutput(runOutput) {
  const failures = [];
  const lines = runOutput.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/fail|error|assertion|timeout|element not found|selector/i.test(line)) {
      failures.push({
        test: lines[Math.max(0, i - 1)]?.trim() || "unknown",
        message: line.trim().slice(0, 500)
      });
    }
  }
  return failures.slice(0, 20);
}
server.registerTool(
  "read_file",
  {
    title: "Ler qualquer arquivo",
    description: "L\xEA o conte\xFAdo de QUALQUER arquivo do projeto por caminho. Use para specs, page objects, componentes, c\xF3digo fonte - qualquer formato.",
    inputSchema: z.object({
      path: z.string().describe("Caminho relativo ao projeto (ex: cypress/e2e/login.cy.js, src/pages/Login.tsx, tests/login.robot)."),
      encoding: z.enum(["utf8", "utf-8"]).optional().describe("Encoding. Default: utf8")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      content: z.string().optional(),
      error: z.string().optional()
    })
  },
  async ({ path: filePath, encoding = "utf8" }) => {
    const normalized = filePath.replace(/^\//, "").replace(/\\/g, "/");
    const fullPath = path.join(PROJECT_ROOT, normalized);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return {
        content: [{ type: "text", text: "Caminho fora do projeto." }],
        structuredContent: { ok: false, error: "Path outside project" }
      };
    }
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Arquivo n\xE3o encontrado: ${normalized}` }],
        structuredContent: { ok: false, error: "File not found" }
      };
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        content: [{ type: "text", text: "\xC9 um diret\xF3rio. Use um caminho de arquivo." }],
        structuredContent: { ok: false, error: "Is directory" }
      };
    }
    try {
      const content = fs.readFileSync(fullPath, encoding);
      return {
        content: [{ type: "text", text: content }],
        structuredContent: { ok: true, content }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao ler: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
      };
    }
  }
);
server.registerTool(
  "detect_project",
  {
    title: "Detectar estrutura do projeto",
    description: "Analisa o projeto e identifica frameworks de teste, pastas, backend, frontend.",
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
        frontendDir: z.string().nullable()
      })
    })
  },
  async () => {
    const structure = detectProjectStructure();
    const summary = [
      `Frameworks de teste: ${structure.testFrameworks.join(", ") || "nenhum"}`,
      `Pastas de teste: ${structure.testDirs.join(", ") || "nenhuma"}`,
      `Backend: ${structure.backendDir || "n\xE3o detectado"}`,
      `Frontend: ${structure.frontendDir || "n\xE3o detectado"}`
    ].join("\n");
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { ok: true, structure }
    };
  }
);
server.registerTool(
  "web_eval_browser",
  {
    title: "Avaliar app no browser (screenshots, network, console)",
    description: "[Agente especializado: Browser] Abre a URL no navegador, captura screenshot, erros de console e requisi\xE7\xF5es de rede. Inspirado em web-eval-agent. Requer: npm install playwright",
    inputSchema: z.object({
      url: z.string().describe("URL para avaliar (ex: http://localhost:3000, https://exemplo.com)."),
      screenshotPath: z.string().optional().describe("Caminho para salvar screenshot. Default: .qa-lab-screenshot.png"),
      captureNetwork: z.boolean().optional().describe("Capturar requisi\xE7\xF5es de rede. Default: true"),
      captureConsole: z.boolean().optional().describe("Capturar logs e erros do console. Default: true")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      screenshotPath: z.string().optional(),
      consoleLogs: z.array(z.string()).optional(),
      consoleErrors: z.array(z.string()).optional(),
      networkRequests: z.array(z.object({ url: z.string(), method: z.string(), status: z.number().optional() })).optional(),
      error: z.string().optional()
    })
  },
  async ({ url, screenshotPath, captureNetwork = true, captureConsole = true }) => {
    let playwright;
    try {
      playwright = await import("playwright");
    } catch (e) {
      return {
        content: [{
          type: "text",
          text: "Playwright n\xE3o instalado. Rode: npm install playwright (ou npx playwright install para browsers)."
        }],
        structuredContent: { ok: false, error: "Playwright not installed. Run: npm install playwright" }
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
          networkRequests.push({ url: req.url(), method: req.method(), status: void 0 });
        });
        page.on("response", (res) => {
          const req = networkRequests.find((r) => r.url === res.request().url());
          if (req) req.status = res.status();
        });
      }
      await page.goto(url, { waitUntil: "networkidle", timeout: 3e4 });
      await page.screenshot({ path: outPath, fullPage: false });
      await browser.close();
      const relPath = path.relative(PROJECT_ROOT, outPath);
      let summary = `Screenshot salvo: ${relPath}`;
      if (consoleErrors.length) summary += `

\u26A0\uFE0F ${consoleErrors.length} erro(s) no console:
${consoleErrors.slice(0, 5).join("\n")}`;
      if (networkRequests.length) summary += `

Requisi\xE7\xF5es: ${networkRequests.length}`;
      return {
        content: [{ type: "text", text: summary }],
        structuredContent: {
          ok: true,
          screenshotPath: relPath,
          consoleLogs: captureConsole ? consoleLogs.slice(0, 50) : void 0,
          consoleErrors: captureConsole && consoleErrors.length ? consoleErrors : void 0,
          networkRequests: captureNetwork ? networkRequests.slice(0, 30) : void 0
        }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
      };
    }
  }
);
var QA_AGENTS = {
  detection: { tools: ["detect_project", "read_project", "list_test_files"], desc: "Detec\xE7\xE3o de estrutura, frameworks e arquivos" },
  execution: { tools: ["run_tests", "watch_tests", "get_test_coverage"], desc: "Execu\xE7\xE3o de testes e cobertura" },
  generation: { tools: ["generate_tests", "write_test", "create_test_template"], desc: "Gera\xE7\xE3o de testes com LLM" },
  analysis: { tools: ["analyze_failures", "por_que_falhou", "suggest_fix", "suggest_selector_fix"], desc: "An\xE1lise de falhas e sugest\xF5es" },
  browser: { tools: ["web_eval_browser"], desc: "Avalia\xE7\xE3o em browser real (screenshots, network, console)" },
  reporting: { tools: ["create_bug_report", "get_business_metrics"], desc: "Relat\xF3rios e m\xE9tricas" },
  maintenance: { tools: ["run_linter", "install_dependencies", "analyze_file_methods"], desc: "Manuten\xE7\xE3o e an\xE1lise de c\xF3digo" }
};
server.registerTool(
  "qa_route_task",
  {
    title: "Roteador de tarefas QA (agentes especializados)",
    description: "Recebe uma descri\xE7\xE3o da tarefa e retorna qual agente (conjunto de ferramentas) deve ser usado. \xDAtil para encaminhar a ferramenta certa.",
    inputSchema: z.object({
      task: z.string().describe("Descri\xE7\xE3o da tarefa (ex: 'rodar os testes', 'gerar teste de login', 'analisar por que falhou').")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      suggestedAgent: z.string(),
      suggestedTools: z.array(z.string()),
      description: z.string()
    })
  },
  async ({ task }) => {
    const t = task.toLowerCase();
    if (/rodar|executar|run|test|coverage|watch/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: execution \u2192 run_tests, get_test_coverage" }], structuredContent: { ok: true, suggestedAgent: "execution", suggestedTools: QA_AGENTS.execution.tools, description: QA_AGENTS.execution.desc } };
    }
    if (/gerar|criar|escrever|generate|write|template/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation \u2192 generate_tests, write_test" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: QA_AGENTS.generation.tools, description: QA_AGENTS.generation.desc } };
    }
    if (/analisar|por que|falhou|suggest|correção|selector|fix/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: analysis \u2192 analyze_failures, por_que_falhou, suggest_fix" }], structuredContent: { ok: true, suggestedAgent: "analysis", suggestedTools: QA_AGENTS.analysis.tools, description: QA_AGENTS.analysis.desc } };
    }
    if (/browser|screenshot|navegador|avaliar|ux|network|console/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: browser \u2192 web_eval_browser" }], structuredContent: { ok: true, suggestedAgent: "browser", suggestedTools: QA_AGENTS.browser.tools, description: QA_AGENTS.browser.desc } };
    }
    if (/detectar|estrutura|listar|arquivos|framework/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: detection \u2192 detect_project, list_test_files" }], structuredContent: { ok: true, suggestedAgent: "detection", suggestedTools: QA_AGENTS.detection.tools, description: QA_AGENTS.detection.desc } };
    }
    if (/relatório|bug|métricas|metrics|coverage/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: reporting \u2192 create_bug_report, get_business_metrics" }], structuredContent: { ok: true, suggestedAgent: "reporting", suggestedTools: QA_AGENTS.reporting.tools, description: QA_AGENTS.reporting.desc } };
    }
    return { content: [{ type: "text", text: "Agente: detection (gen\xE9rico)" }], structuredContent: { ok: true, suggestedAgent: "detection", suggestedTools: QA_AGENTS.detection.tools, description: QA_AGENTS.detection.desc } };
  }
);
server.registerTool(
  "run_tests",
  {
    title: "Executar testes",
    description: "Roda testes do projeto. Suporta: Cypress, Playwright, WebdriverIO, Jest, Vitest, Mocha, Appium, Detox, Robot Framework, pytest, e mais. Detecta automaticamente.",
    inputSchema: z.object({
      framework: z.enum([
        "cypress",
        "playwright",
        "webdriverio",
        "jest",
        "vitest",
        "mocha",
        "appium",
        "detox",
        "robot",
        "pytest",
        "supertest",
        "pactum",
        "testcafe",
        "nightwatch",
        "puppeteer",
        "codeceptjs",
        "npm"
      ]).optional().describe("Framework espec\xEDfico ou 'npm' para npm test."),
      spec: z.string().optional().describe("Caminho do spec (ex: cypress/e2e/test.cy.js)."),
      suite: z.string().optional().describe("Suite ou pattern (ex: e2e, api)."),
      explainOnFailure: z.boolean().optional().describe("Se true, quando falhar gera automaticamente: O que aconteceu, Por que falhou, O que fazer, Sugest\xE3o de corre\xE7\xE3o. Requer API key.")
    }),
    outputSchema: z.object({
      status: z.enum(["passed", "failed", "not_found"]),
      message: z.string(),
      exitCode: z.number(),
      runOutput: z.string().optional()
    })
  },
  async ({ framework, spec, suite, explainOnFailure }) => {
    const structure = detectProjectStructure();
    if (!structure.hasTests) {
      return {
        content: [{ type: "text", text: "Nenhum framework de teste detectado no projeto." }],
        structuredContent: {
          status: "not_found",
          message: "No test framework found",
          exitCode: 1
        }
      };
    }
    let selectedFramework = framework;
    if (!selectedFramework && structure.testFrameworks.length > 0) {
      selectedFramework = structure.testFrameworks[0];
    }
    let cmd, args, cwd;
    if (selectedFramework === "cypress") {
      cmd = "npx";
      args = spec ? ["cypress", "run", "--spec", spec] : ["cypress", "run"];
      cwd = structure.testDirs.includes("cypress") ? path.join(PROJECT_ROOT, "cypress") : structure.testDirs[0] ? path.join(PROJECT_ROOT, structure.testDirs[0]) : PROJECT_ROOT;
    } else if (selectedFramework === "playwright") {
      cmd = "npx";
      args = spec ? ["playwright", "test", spec] : ["playwright", "test"];
      cwd = structure.testDirs.includes("playwright") ? path.join(PROJECT_ROOT, "playwright") : structure.testDirs[0] ? path.join(PROJECT_ROOT, structure.testDirs[0]) : PROJECT_ROOT;
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
    } else if (selectedFramework === "appium") {
      cmd = "npx";
      args = spec ? ["wdio", "run", spec] : ["wdio", "run"];
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "detox") {
      cmd = "npx";
      args = ["detox", "test"];
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "robot") {
      cmd = "robot";
      args = spec ? [spec] : [structure.testDirs[0] || "tests"];
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "pytest") {
      cmd = "pytest";
      args = spec ? [spec] : [];
      cwd = PROJECT_ROOT;
    } else if (selectedFramework === "supertest" || selectedFramework === "pactum") {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT;
    } else {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT;
    }
    const startTime = Date.now();
    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
        shell: process.platform === "win32",
        env: { ...process.env }
      });
      let stdout = "";
      let stderr = "";
      if (child.stdout) {
        child.stdout.on("data", (d) => {
          const s = d.toString();
          stdout += s;
          process.stdout.write(s);
        });
      }
      if (child.stderr) {
        child.stderr.on("data", (d) => {
          const s = d.toString();
          stderr += s;
          process.stderr.write(s);
        });
      }
      child.on("close", (code) => {
        const runOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
        const passed = code === 0;
        const durationSeconds = Math.round((Date.now() - startTime) / 1e3);
        if (!passed && runOutput) {
          try {
            fs.writeFileSync(path.join(PROJECT_ROOT, ".qa-lab-last-failure.log"), runOutput, "utf8");
          } catch {
          }
        }
        const { passed: p, failed: f } = parseTestRunResult(runOutput, code);
        appendMetricsEvent({
          type: "test_run",
          framework: selectedFramework,
          spec: spec || void 0,
          passed: p,
          failed: f,
          durationSeconds,
          exitCode: code ?? 1,
          failures: !passed ? extractFailuresFromOutput(runOutput) : void 0
        });
        if (passed) saveProjectMemory({ lastRun: { spec: spec || null, framework: selectedFramework, passed: p } });
        resolve({
          content: [{ type: "text", text: passed ? "Testes executados com sucesso." : "Falha na execu\xE7\xE3o dos testes." }],
          structuredContent: {
            status: passed ? "passed" : "failed",
            message: passed ? "Tests passed" : "Tests failed",
            exitCode: code ?? 1,
            runOutput: !passed ? runOutput : void 0
          }
        });
      });
    });
  }
);
server.registerTool(
  "read_project",
  {
    title: "Ler estrutura do projeto",
    description: "L\xEA package.json, specs existentes (qualquer framework: Cypress, Playwright, WDIO, Robot, pytest, etc) e retorna contexto. Use includeContent para trazer c\xF3digo de exemplos.",
    inputSchema: z.object({
      includeContent: z.boolean().optional().describe("Se true, inclui conte\xFAdo dos primeiros 3 arquivos de teste como refer\xEAncia. Default: false."),
      maxFiles: z.number().optional().describe("M\xE1ximo de arquivos cujo conte\xFAdo ser\xE1 lido. Default: 3.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      summary: z.string(),
      packageJson: z.object({}).passthrough().optional(),
      testFiles: z.array(z.string()).optional(),
      testFilesWithContent: z.array(z.object({ path: z.string(), content: z.string() })).optional()
    })
  },
  async ({ includeContent = false, maxFiles = 3 } = {}) => {
    const structure = detectProjectStructure();
    const collected = collectTestFiles(structure, {
      maxContentFiles: includeContent ? maxFiles : 0
    });
    const testFiles = collected.map((e) => e.path);
    const testFilesWithContent = includeContent ? collected.filter((e) => e.content).map((e) => ({ path: e.path, content: e.content })) : void 0;
    const summary = [
      `Frameworks: ${structure.testFrameworks.join(", ") || "nenhum"}`,
      `Arquivos de teste: ${testFiles.length} (qualquer framework)`,
      `Backend: ${structure.backendDir || "n\xE3o detectado"}`,
      `Frontend: ${structure.frontendDir || "n\xE3o detectado"}`,
      includeContent && testFilesWithContent?.length ? `Conte\xFAdo inclu\xEDdo: ${testFilesWithContent.length} arquivo(s) como refer\xEAncia` : ""
    ].filter(Boolean).join("\n");
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        ok: true,
        summary,
        packageJson: structure.packageJson,
        testFiles: testFiles.slice(0, 100),
        testFilesWithContent,
        structure
      }
    };
  }
);
server.registerTool(
  "generate_tests",
  {
    title: "Gerar ou traduzir testes com LLM",
    description: "Gera spec em QUALQUER framework. Aceita refer\xEAncia de outro framework: leia com read_file e passe em referenceCode. Traduz automaticamente (ex: Robot\u2192Playwright, Cypress\u2192WDIO).",
    inputSchema: z.object({
      context: z.string().describe("Contexto do projeto (read_project) ou descri\xE7\xE3o."),
      request: z.string().describe("O que testar (ex: 'logout flow', 'teste de login') ou 'traduzir o teste abaixo'."),
      framework: z.enum([
        "cypress",
        "playwright",
        "webdriverio",
        "jest",
        "vitest",
        "mocha",
        "appium",
        "robot",
        "pytest",
        "supertest",
        "behave",
        "detox"
      ]).optional().describe("Framework alvo (detectado do projeto se omitido)."),
      referenceCode: z.string().optional().describe("C\xF3digo de refer\xEAncia em QUALQUER framework (Cypress, Robot, WDIO, etc). O LLM traduz/adapta para o framework alvo."),
      referencePaths: z.array(z.string()).optional().describe("Caminhos de arquivos para ler como refer\xEAncia. O agente l\xEA e usa como padr\xE3o.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      specContent: z.string().optional(),
      suggestedFileName: z.string().optional(),
      error: z.string().optional()
    })
  },
  async ({ context, request, framework, referenceCode, referencePaths }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0] || "cypress";
    let referenceBlock = "";
    if (referenceCode) referenceBlock += `

--- C\xD3DIGO DE REFER\xCANCIA (use como padr\xE3o, traduza/adapte para ${fw}) ---
${referenceCode.slice(0, 8e3)}`;
    if (referencePaths?.length) {
      for (const p of referencePaths.slice(0, 5)) {
        const full = path.join(PROJECT_ROOT, p.replace(/^\//, "").replace(/\\/g, "/"));
        if (fs.existsSync(full)) {
          try {
            const content = fs.readFileSync(full, "utf8");
            referenceBlock += `

--- Arquivo: ${p} ---
${content.slice(0, 6e3)}`;
          } catch {
          }
        }
      }
    }
    const llm = resolveLLMProvider("simple");
    if (!llm.apiKey) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key configured" }
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;
    const memory = loadProjectMemory();
    const memoryBlock = memory.flows?.length ? `

Fluxos do projeto (use como refer\xEAncia): ${memory.flows.map((f) => f.name || f.id).join(", ")}` : "";
    const contextWithMemory = context + memoryBlock;
    const hasReference = Boolean(referenceBlock?.trim());
    const systemPrompt = hasReference ? `Voc\xEA \xE9 um engenheiro de QA. TRADUZA/ADAPTE o c\xF3digo de refer\xEAncia para o framework ${fw}.
O c\xF3digo de refer\xEAncia pode estar em QUALQUER framework (Cypress, Robot, Playwright, WDIO, Appium, pytest, etc).
- Mantenha a MESMA l\xF3gica e fluxo de teste
- Traduza seletores, comandos e asser\xE7\xF5es para ${fw}
- Use Page Objects se o projeto j\xE1 usa
- Retorne SOMENTE o c\xF3digo, sem markdown` : `Voc\xEA \xE9 um engenheiro de QA especializado em ${fw}. Gere APENAS o c\xF3digo do spec, sem explica\xE7\xF5es.
Framework: ${fw}
Regras:
- Cypress: cy.request(), cy.visit(), cy.get()
- Playwright: test(), test.describe(), page.goto(), page.locator()
- WebdriverIO/Appium: describe(), it(), $(), browser.$
- Jest/Vitest: describe(), test(), expect()
- Robot: Keywords, [Tags], Steps
- pytest: def test_*, assert, fixtures
- C\xF3digo limpo. Retorne SOMENTE o c\xF3digo, sem markdown`;
    const userPrompt = `Contexto do projeto:
${contextWithMemory.slice(0, 5e3)}

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
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
          })
        });
        const data = await res.json();
        specContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 4096
          })
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
          suggestedFileName: fileName
        }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao gerar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
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
    pactum: ".test.js"
  };
  const ext = extMap[fw] || ".spec.js";
  const baseMap = {
    cypress: structure.testDirs.includes("cypress") ? "cypress" : structure.testDirs[0] || "tests",
    playwright: structure.testDirs.includes("playwright") ? "playwright" : structure.testDirs[0] || "tests",
    webdriverio: structure.testDirs.includes("specs") ? "specs" : structure.testDirs[0] || "tests",
    appium: structure.testDirs.includes("specs") ? "specs" : structure.testDirs[0] || "tests",
    robot: structure.testDirs.includes("robot") ? "robot" : structure.testDirs[0] || "tests",
    behave: structure.testDirs.includes("features") ? "features" : structure.testDirs[0] || "tests"
  };
  const baseDir = path.join(PROJECT_ROOT, baseMap[fw] || structure.testDirs[0] || "tests");
  return { ext, baseDir };
}
server.registerTool(
  "write_test",
  {
    title: "Escrever arquivo de teste",
    description: "Grava spec no disco. Suporta QUALQUER framework (Cypress, Playwright, WDIO, Appium, Robot, pytest, etc.). Detecta automaticamente pasta e extens\xE3o.",
    inputSchema: z.object({
      name: z.string().describe("Nome do arquivo (ex: login-test, logout_spec)."),
      content: z.string().describe("Conte\xFAdo do spec."),
      framework: z.enum([
        "cypress",
        "playwright",
        "jest",
        "vitest",
        "mocha",
        "webdriverio",
        "appium",
        "detox",
        "robot",
        "pytest",
        "behave",
        "supertest"
      ]).optional().describe("Framework (detectado automaticamente se omitido)."),
      subdir: z.string().optional().describe("Subpasta (ex: e2e, api). Default: raiz da pasta de testes.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      path: z.string().optional(),
      error: z.string().optional()
    })
  },
  async ({ name, content, framework, subdir }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0];
    if (!fw) {
      return {
        content: [{ type: "text", text: "Nenhum framework de teste detectado." }],
        structuredContent: { ok: false, error: "No test framework" }
      };
    }
    const { ext, baseDir } = getExtensionAndBaseDir(fw, structure);
    const safeName = name.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/_+/g, "_").replace(/\.(cy|spec|test|robot|feature|py)\.?(js|ts|py)?$/i, "").replace(/^[-_]+|[-_]+$/g, "");
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
        structuredContent: { ok: true, path: filePath }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao gravar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
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
      runOutput: z.string().describe("Output do teste (stdout/stderr).")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      summary: z.string(),
      failures: z.array(z.object({
        test: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional()
      })).optional()
    })
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
          stack: lines.slice(i, i + 5).join("\n")
        });
      }
    }
    const flakyAnalysis = detectFlakyPatterns(runOutput);
    let summary = failures.length ? `${failures.length} falha(s) detectada(s).` : "Nenhuma falha detectada.";
    if (flakyAnalysis.isLikelyFlaky) {
      summary += `

\u26A0\uFE0F Poss\xEDvel teste flaky (${Math.round(flakyAnalysis.confidence * 100)}% confian\xE7a). Padr\xF5es: ${flakyAnalysis.patterns.map((p) => p.pattern).join(", ")}.`;
      summary += "\n\nSugest\xF5es:";
      flakyAnalysis.patterns.forEach((p) => {
        summary += `
\u2022 ${p.pattern}: ${p.suggestion}`;
      });
      if (flakyAnalysis.patterns.some((p) => p.pattern === "timing" || p.pattern === "network")) {
        summary += "\n\u2022 Considere adicionar test.retry(2) ou equivalente para retries autom\xE1ticos.";
      }
    }
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        ok: true,
        summary,
        failures: failures.length ? failures : void 0,
        flaky: flakyAnalysis.isLikelyFlaky ? { confidence: flakyAnalysis.confidence, patterns: flakyAnalysis.patterns } : void 0
      }
    };
  }
);
function formatFailureExplanation(data) {
  const lines = [
    "## O que aconteceu",
    "",
    data.oQueAconteceu || "",
    "",
    "## Por que provavelmente falhou",
    "",
    ...Array.isArray(data.porQueProvavelmenteFalhou) ? data.porQueProvavelmenteFalhou.map((s) => `\u2022 ${s}`) : [data.porQueProvavelmenteFalhou || ""],
    "",
    "## O que fazer agora",
    "",
    ...Array.isArray(data.oQueFazerAgora) ? data.oQueFazerAgora.map((s, i) => `${i + 1}. ${s}`) : [data.oQueFazerAgora || ""]
  ];
  if (data.sugestaoCorrecao) {
    lines.push("", "## Sugest\xE3o de corre\xE7\xE3o", "", "```" + (data.framework || "js"), data.sugestaoCorrecao, "```");
  }
  if (data.conceito) {
    lines.push("", "## Conceito", "", data.conceito);
  }
  return lines.filter(Boolean).join("\n");
}
async function callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt) {
  if (provider === "gemini") {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const res2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      })
    });
    const data2 = await res2.json();
    return data2.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 4096
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
server.registerTool(
  "por_que_falhou",
  {
    title: "Por que falhou? Explica\xE7\xE3o para juniores",
    description: "Traduz stack trace em explica\xE7\xE3o humana. Recebe output do terminal/log, l\xEA o projeto e o teste (se path dado), e retorna: O que aconteceu, Por que falhou, O que fazer, Sugest\xE3o de corre\xE7\xE3o, Conceito. Escal\xE1vel e procedural.",
    inputSchema: z.object({
      errorOutput: z.string().optional().describe("Output do terminal quando o teste falhou. Se vazio, l\xEA automaticamente de .qa-lab-last-failure.log (capturado pelo run_tests). Cole aqui ou deixe vazio para usar \xFAltima falha."),
      testFilePath: z.string().optional().describe("Caminho do arquivo de teste que falhou (ex: specs/login.spec.js). Se informado, o agente l\xEA o c\xF3digo e d\xE1 sugest\xE3o mais precisa.")
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
      error: z.string().optional()
    })
  },
  async ({ errorOutput, testFilePath }) => {
    const structure = detectProjectStructure();
    const fw = structure.testFrameworks[0] || "unknown";
    let resolvedOutput = errorOutput?.trim() || "";
    if (!resolvedOutput) {
      const lastFailurePath = path.join(PROJECT_ROOT, ".qa-lab-last-failure.log");
      if (fs.existsSync(lastFailurePath)) {
        try {
          resolvedOutput = fs.readFileSync(lastFailurePath, "utf8");
        } catch {
        }
      }
    }
    if (!resolvedOutput) {
      return {
        content: [{
          type: "text",
          text: "Nenhum output de erro fornecido e nenhuma falha recente capturada.\n\nComo usar:\n1. Rode os testes (run_tests) \u2013 se falhar, a sa\xEDda \xE9 salva automaticamente.\n2. Ou cole aqui o output do terminal quando o teste falhou.\n3. Depois pe\xE7a: 'Por que falhou?' ou chame por_que_falhou."
        }],
        structuredContent: { ok: false, error: "No error output" }
      };
    }
    let testCode = "";
    if (testFilePath) {
      const normalized = testFilePath.replace(/^\//, "").replace(/\\/g, "/");
      const fullPath = path.join(PROJECT_ROOT, normalized);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        try {
          testCode = fs.readFileSync(fullPath, "utf8");
        } catch {
        }
      }
    }
    const llm = resolveLLMProvider("complex");
    if (!llm.apiKey) {
      return {
        content: [{
          type: "text",
          text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env do projeto para usar a explica\xE7\xE3o com LLM."
        }],
        structuredContent: { ok: false, error: "No API key configured" }
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;
    const fwHints = {
      webdriverio: "WebdriverIO (describe/it, $, browser.$)",
      appium: "Appium/WebdriverIO (mobile, $, browser.$)",
      playwright: "Playwright (test, page, locator)",
      cypress: "Cypress (cy.get, cy.click)",
      jest: "Jest (describe, test, expect)",
      vitest: "Vitest (describe, test, expect)",
      robot: "Robot Framework",
      pytest: "pytest"
    };
    const systemPrompt = `Voc\xEA \xE9 um mentor de QA. Analise o output de falha e responda em JSON (apenas o JSON, sem markdown) com as chaves:
- oQueAconteceu: string (explica\xE7\xE3o em portugu\xEAs do que aconteceu, simples)
- porQueProvavelmenteFalhou: array de strings (lista de poss\xEDveis causas, uma por item)
- oQueFazerAgora: array de strings (passos numerados do que fazer)
- sugestaoCorrecao: string ou null (c\xF3digo de corre\xE7\xE3o se aplic\xE1vel, no formato do framework)
- conceito: string ou null (ex: "Flaky test = teste intermitente. Geralmente por timing ou seletores fr\xE1geis.")
- framework: string (framework do projeto)

Framework do projeto: ${fw}. ${fwHints[fw] || ""}
Responda APENAS com o JSON v\xE1lido, sem texto antes ou depois.`;
    const userPrompt = `Output do terminal/log (teste falhou):
---
${resolvedOutput.slice(0, 12e3)}
---
${testCode ? `
C\xF3digo do teste que falhou:
---
${testCode.slice(0, 6e3)}
---` : ""}`;
    try {
      let raw = await callLlmForExplanation(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          oQueAconteceu: raw.slice(0, 500) || "N\xE3o foi poss\xEDvel parsear a resposta.",
          porQueProvavelmenteFalhou: [],
          oQueFazerAgora: [],
          sugestaoCorrecao: null,
          conceito: null,
          framework: fw
        };
      }
      data.framework = data.framework || fw;
      const formattedText = formatFailureExplanation(data);
      return {
        content: [{ type: "text", text: formattedText }],
        structuredContent: {
          ok: true,
          oQueAconteceu: data.oQueAconteceu,
          porQueProvavelmenteFalhou: data.porQueProvavelmenteFalhou,
          oQueFazerAgora: data.oQueFazerAgora,
          sugestaoCorrecao: data.sugestaoCorrecao ?? null,
          conceito: data.conceito ?? null,
          framework: data.framework,
          formattedText
        }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao analisar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
      };
    }
  }
);
server.registerTool(
  "suggest_fix",
  {
    title: "Sugerir corre\xE7\xE3o para falhas",
    description: "Recebe an\xE1lise de falhas e sugere corre\xE7\xF5es (patch, refactor, etc.).",
    inputSchema: z.object({
      failures: z.array(z.object({
        test: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional()
      })).describe("Resultado de analyze_failures.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      suggestions: z.array(z.object({
        test: z.string().optional(),
        description: z.string(),
        fix: z.string().optional()
      }))
    })
  },
  async ({ failures }) => {
    const suggestions = [];
    for (const f of failures) {
      const msg = f.message || "";
      if (/element not found|selector|timeout/i.test(msg)) {
        suggestions.push({
          test: f.test,
          description: "Elemento n\xE3o encontrado ou timeout",
          fix: "Verifique seletores, adicione waits ou aumente timeout. Use data-testid para seletores mais est\xE1veis."
        });
      } else if (/expected.*to.*but/i.test(msg)) {
        suggestions.push({
          test: f.test,
          description: "Asser\xE7\xE3o falhou",
          fix: "Revise o valor esperado. Verifique se o estado da aplica\xE7\xE3o est\xE1 correto antes da asser\xE7\xE3o."
        });
      } else if (/network|fetch|ECONNREFUSED/i.test(msg)) {
        suggestions.push({
          test: f.test,
          description: "Erro de rede ou API n\xE3o dispon\xEDvel",
          fix: "Verifique se o backend est\xE1 rodando. Confirme a URL e porta da API."
        });
      } else {
        suggestions.push({
          test: f.test,
          description: "Falha detectada",
          fix: "Revise o stack trace e o c\xF3digo do teste."
        });
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(suggestions, null, 2) }],
      structuredContent: { ok: true, suggestions }
    };
  }
);
server.registerTool(
  "suggest_selector_fix",
  {
    title: "Sugerir corre\xE7\xE3o de seletor (Self-healing)",
    description: "Quando um teste falha por elemento n\xE3o encontrado (seletor quebrado ap\xF3s mudan\xE7a de UI), usa LLM para sugerir seletor alternativo mais resiliente. Prioriza data-testid, role, texto acess\xEDvel.",
    inputSchema: z.object({
      testFilePath: z.string().describe("Caminho do arquivo de teste que falhou (ex: specs/login.spec.js)."),
      errorOutput: z.string().optional().describe("Output do terminal da falha. Se vazio, l\xEA de .qa-lab-last-failure.log."),
      framework: z.enum(["cypress", "playwright", "webdriverio", "appium"]).optional().describe("Framework do teste. Detectado automaticamente se omitido.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      selectorSugerido: z.string().optional(),
      codigoCorrigido: z.string().optional(),
      explicacao: z.string().optional(),
      error: z.string().optional()
    })
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
        content: [{ type: "text", text: "Nenhum output de erro. Rode os testes primeiro ou forne\xE7a errorOutput." }],
        structuredContent: { ok: false, error: "No error output" }
      };
    }
    if (!/element not found|selector|timeout|locator|cy\.get|page\.locator/i.test(resolvedOutput)) {
      return {
        content: [{ type: "text", text: "A falha n\xE3o parece ser de seletor/elemento. Use por_que_falhou ou suggest_fix para outros tipos de falha." }],
        structuredContent: { ok: false, error: "Not a selector-related failure" }
      };
    }
    let testCode = "";
    const fullPath = path.join(PROJECT_ROOT, testFilePath.replace(/^\//, "").replace(/\\/g, "/"));
    if (fs.existsSync(fullPath)) {
      try {
        testCode = fs.readFileSync(fullPath, "utf8");
      } catch {
      }
    }
    const llm = resolveLLMProvider("complex");
    if (!llm.apiKey) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key configured" }
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;
    const fwHints = {
      cypress: "Cypress: cy.get('[data-testid=...]'), cy.contains(), cy.get('button').filter(':visible')",
      playwright: `Playwright: page.getByRole(), page.getByTestId(), page.locator('button:has-text("...")')`,
      webdriverio: "WebdriverIO: $('[data-testid=...]'), $('button=Texto')",
      appium: "Appium: $('~accessibility-id'), $('//android.view.View')"
    };
    const systemPrompt = `Voc\xEA \xE9 um especialista em testes E2E. O teste falhou porque um seletor n\xE3o encontrou o elemento (UI mudou).
Analise o erro e o c\xF3digo e responda APENAS em JSON (sem markdown) com as chaves:
- selectorSugerido: string (o novo seletor recomendado, mais resiliente)
- codigoCorrigido: string (bloco de c\xF3digo completo corrigido, apenas a parte relevante do teste)
- explicacao: string (breve explica\xE7\xE3o em portugu\xEAs: por que o antigo falhou e por que o novo \xE9 melhor)

Priorize nesta ordem: data-testid > role + accessible name > texto vis\xEDvel > estrutura. Evite classes CSS e IDs que mudam.

Framework: ${fw}. ${fwHints[fw] || ""}`;
    const userPrompt = `Output do erro:
---
${resolvedOutput.slice(0, 8e3)}
---
C\xF3digo do teste:
---
${testCode ? testCode.slice(0, 6e3) : "N\xE3o dispon\xEDvel"}
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
          codigoCorrigido: raw.slice(0, 2e3),
          explicacao: "N\xE3o foi poss\xEDvel parsear. Resposta do LLM acima."
        };
      }
      const text = [
        data.explicacao && `## Explica\xE7\xE3o
${data.explicacao}`,
        data.selectorSugerido && `## Seletor sugerido
\`${data.selectorSugerido}\``,
        data.codigoCorrigido && `## C\xF3digo corrigido
\`\`\`${fw}
${data.codigoCorrigido}
\`\`\``
      ].filter(Boolean).join("\n\n");
      return {
        content: [{ type: "text", text: text || JSON.stringify(data, null, 2) }],
        structuredContent: {
          ok: true,
          selectorSugerido: data.selectorSugerido,
          codigoCorrigido: data.codigoCorrigido,
          explicacao: data.explicacao
        }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao chamar LLM: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
      };
    }
  }
);
server.registerTool(
  "analyze_file_methods",
  {
    title: "Analisar m\xE9todos de um arquivo",
    description: "L\xEA um arquivo, faz varredura em todos os m\xE9todos/fun\xE7\xF5es e retorna an\xE1lise detalhada: m\xE9todo correto?, melhor forma de escrever?, falso positivo?, coer\xEAncia?, itens faltando?, par\xE2metros faltando?, imports faltando?. Requer API key (Groq/Gemini/OpenAI).",
    inputSchema: z.object({
      path: z.string().describe("Caminho do arquivo (ex: src/utils.js, tests/login.cy.js, cypress/support/commands.js).")
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
        sugestao: z.string().optional()
      })).optional(),
      importsFaltandoGlobal: z.array(z.string()).optional(),
      resumo: z.string().optional(),
      error: z.string().optional()
    })
  },
  async ({ path: filePath }) => {
    const normalized = filePath.replace(/^\//, "").replace(/\\/g, "/");
    const fullPath = path.join(PROJECT_ROOT, normalized);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return {
        content: [{ type: "text", text: "Caminho fora do projeto." }],
        structuredContent: { ok: false, error: "Path outside project" }
      };
    }
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Arquivo n\xE3o encontrado: ${normalized}` }],
        structuredContent: { ok: false, error: "File not found" }
      };
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        content: [{ type: "text", text: "\xC9 um diret\xF3rio. Informe um arquivo." }],
        structuredContent: { ok: false, error: "Is directory" }
      };
    }
    let fileContent = "";
    try {
      fileContent = fs.readFileSync(fullPath, "utf8");
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao ler: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
      };
    }
    const llm = resolveLLMProvider("complex");
    if (!llm.apiKey) {
      return {
        content: [{
          type: "text",
          text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env para usar an\xE1lise com LLM."
        }],
        structuredContent: { ok: false, error: "No API key configured" }
      };
    }
    const { provider, apiKey, baseUrl, model } = llm;
    const ext = path.extname(fullPath).toLowerCase();
    const lang = [".ts", ".tsx"].includes(ext) ? "TypeScript" : [".js", ".jsx"].includes(ext) ? "JavaScript" : [".py"].includes(ext) ? "Python" : "c\xF3digo";
    const systemPrompt = `Voc\xEA \xE9 um revisor de c\xF3digo experiente em QA e testes. Analise o arquivo e cada m\xE9todo/fun\xE7\xE3o, respondendo em JSON v\xE1lido (sem markdown) com a estrutura:

{
  "methods": [
    {
      "name": "nomeDoMetodo",
      "correto": true | false,
      "melhorForma": "explica\xE7\xE3o curta se h\xE1 forma melhor de escrever",
      "falsoPositivo": true | false,
      "falsoPositivoRazao": "se falso positivo, por qu\xEA (ex: asser\xE7\xE3o muito permissiva)",
      "coerente": true | false,
      "coerenteDetalhe": "se incoerente, o que est\xE1 inconsistente",
      "itensFaltando": ["item1", "item2"],
      "parametrosFaltando": ["param1"],
      "importsFaltando": ["moduloX"],
      "sugestao": "c\xF3digo ou texto de sugest\xE3o de melhoria"
    }
  ],
  "importsFaltandoGlobal": ["imports faltando no topo do arquivo"],
  "resumo": "resumo geral em 2-3 linhas"
}

Para CADA m\xE9todo/fun\xE7\xE3o no arquivo, verifique:
1. correto: a l\xF3gica est\xE1 correta?
2. melhorForma: h\xE1 forma mais leg\xEDvel, perform\xE1tica ou idiom\xE1tica de escrever?
3. falsoPositivo: o m\xE9todo pode passar quando n\xE3o deveria (asser\xE7\xE3o fraca, mock incorreto)?
4. coerente: o m\xE9todo \xE9 coerente com o restante do c\xF3digo, naming, padr\xF5es?
5. itensFaltando: falta try/catch, valida\xE7\xE3o, cleanup, etc?
6. parametrosFaltando: par\xE2metros que deveriam existir?
7. importsFaltando: imports que o m\xE9todo usa mas n\xE3o est\xE3o declarados?

Responda APENAS com o JSON v\xE1lido. Linguagem: ${lang}.`;
    const userPrompt = `Arquivo: ${normalized}

\`\`\`${lang}
${fileContent.slice(0, 18e3)}
\`\`\`

Analise cada m\xE9todo/fun\xE7\xE3o e retorne o JSON conforme especificado.`;
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
          resumo: raw.slice(0, 1e3) || "N\xE3o foi poss\xEDvel parsear a resposta do LLM."
        };
      }
      const lines = [
        `# An\xE1lise de m\xE9todos: ${normalized}`,
        "",
        data.resumo && `## Resumo
${data.resumo}`,
        data.importsFaltandoGlobal?.length > 0 ? `
## Imports faltando (global)
${data.importsFaltandoGlobal.map((i) => `- ${i}`).join("\n")}` : "",
        "\n## M\xE9todos analisados\n"
      ];
      for (const m of data.methods || []) {
        lines.push(`### ${m.name}`);
        lines.push("");
        if (m.correto !== void 0) lines.push(`- **Correto:** ${m.correto ? "\u2705 Sim" : "\u274C N\xE3o"}`);
        if (m.melhorForma) lines.push(`- **Melhor forma:** ${m.melhorForma}`);
        if (m.falsoPositivo) lines.push(`- **Falso positivo:** \u26A0\uFE0F Sim - ${m.falsoPositivoRazao || "verificar"}`);
        if (m.coerente !== void 0) lines.push(`- **Coerente:** ${m.coerente ? "\u2705 Sim" : "\u274C N\xE3o"}`);
        if (m.itensFaltando?.length) lines.push(`- **Itens faltando:** ${m.itensFaltando.join(", ")}`);
        if (m.parametrosFaltando?.length) lines.push(`- **Par\xE2metros faltando:** ${m.parametrosFaltando.join(", ")}`);
        if (m.importsFaltando?.length) lines.push(`- **Imports faltando:** ${m.importsFaltando.join(", ")}`);
        if (m.sugestao) lines.push(`
**Sugest\xE3o:**
\`\`\`
${m.sugestao}
\`\`\``);
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
          resumo: data.resumo
        }
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro ao analisar: ${err.message}` }],
        structuredContent: { ok: false, error: err.message }
      };
    }
  }
);
server.registerTool(
  "create_bug_report",
  {
    title: "Criar relat\xF3rio de bug",
    description: "Gera um bug report estruturado a partir de falhas de teste.",
    inputSchema: z.object({
      failures: z.array(z.object({
        test: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional()
      })).describe("Falhas (de analyze_failures)."),
      title: z.string().optional().describe("T\xEDtulo do bug.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      report: z.string(),
      title: z.string()
    })
  },
  async ({ failures, title }) => {
    const bugTitle = title || `Falha em ${failures.length} teste(s)`;
    const lines = [
      `# ${bugTitle}`,
      "",
      "## Resumo",
      "",
      `${failures.length} teste(s) falharam durante a execu\xE7\xE3o.`,
      "",
      "## Falhas detectadas",
      ""
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
    lines.push("## Pr\xF3ximos passos");
    lines.push("");
    lines.push("- [ ] Reproduzir localmente");
    lines.push("- [ ] Identificar causa raiz");
    lines.push("- [ ] Aplicar corre\xE7\xE3o");
    lines.push("- [ ] Validar com testes");
    const report = lines.join("\n");
    appendMetricsEvent({ type: "bug_reported", failuresCount: failures.length, title: bugTitle });
    return {
      content: [{ type: "text", text: report }],
      structuredContent: { ok: true, report, title: bugTitle }
    };
  }
);
server.registerTool(
  "get_business_metrics",
  {
    title: "Obter m\xE9tricas de neg\xF3cio",
    description: "Retorna m\xE9tricas: tempo at\xE9 bug, custo por defeito (tempo estimado), cobertura por fluxo. Requer run_tests executados e opcionalmente qa-lab-flows.json.",
    inputSchema: z.object({
      period: z.enum(["7d", "30d", "all"]).optional().describe("Per\xEDodo para analisar. Default: 30d.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      timeToBug: z.object({
        avgHours: z.number(),
        lastFailureAt: z.string().optional(),
        runsWithFailures: z.number()
      }).optional(),
      costPerDefect: z.object({
        avgMinutesPerDefect: z.number(),
        totalFailures: z.number(),
        estimatedHoursSpent: z.number()
      }).optional(),
      flowCoverage: z.object({
        totalFlows: z.number(),
        coveredFlows: z.number(),
        percent: z.number(),
        details: z.array(z.object({ flow: z.string(), covered: z.boolean() }))
      }).optional(),
      summary: z.string()
    })
  },
  async ({ period = "30d" } = {}) => {
    const now = Date.now();
    const msByPeriod = { "7d": 7 * 24 * 60 * 60 * 1e3, "30d": 30 * 24 * 60 * 60 * 1e3, all: Infinity };
    const cutoff = now - msByPeriod[period];
    let data = { events: [] };
    if (fs.existsSync(METRICS_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(METRICS_FILE, "utf8"));
      } catch {
      }
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
        runsWithFailures: failedRuns.length
      };
      if (failedRuns.length >= 2) {
        const deltas = [];
        for (let i = 1; i < failedRuns.length; i++) {
          const prev = new Date(failedRuns[i - 1].timestamp).getTime();
          const curr = new Date(failedRuns[i].timestamp).getTime();
          deltas.push((curr - prev) / (1e3 * 60 * 60));
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
        estimatedHoursSpent: Math.round(estimatedMinutesSpent / 60 * 10) / 10
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
          percent: flows.length ? Math.round(details.filter((d) => d.covered).length / flows.length * 100) : 0,
          details
        };
      } catch {
      }
    }
    const lines = [
      "## M\xE9tricas de neg\xF3cio",
      "",
      `Per\xEDodo: ${period}`,
      "",
      timeToBug ? [
        "### Tempo at\xE9 bug",
        `- \xDAltima falha: ${timeToBug.lastFailureAt || "N/A"}`,
        `- Execu\xE7\xF5es com falha: ${timeToBug.runsWithFailures}`,
        timeToBug.avgHours > 0 ? `- M\xE9dia entre falhas: ${timeToBug.avgHours.toFixed(1)}h` : ""
      ].filter(Boolean).join("\n") : "",
      costPerDefect ? [
        "### Custo por defeito (estimativa)",
        `- Total de falhas: ${costPerDefect.totalFailures}`,
        `- Tempo m\xE9dio por defeito: ~${costPerDefect.avgMinutesPerDefect} min`,
        `- Horas estimadas gastas: ${costPerDefect.estimatedHoursSpent}h`
      ].join("\n") : "",
      flowCoverage ? [
        "### Cobertura por fluxo",
        `- Fluxos cobertos: ${flowCoverage.coveredFlows}/${flowCoverage.totalFlows} (${flowCoverage.percent}%)`,
        flowCoverage.details.map((d) => `  - ${d.flow}: ${d.covered ? "\u2705" : "\u274C"}`).join("\n")
      ].join("\n") : ""
    ].filter(Boolean).join("\n\n");
    if (!timeToBug && !costPerDefect && !flowCoverage) {
      const msg = "Nenhuma m\xE9trica dispon\xEDvel. Rode run_tests para gerar dados. Para cobertura por fluxo, crie qa-lab-flows.json.";
      return {
        content: [{ type: "text", text: msg }],
        structuredContent: { ok: false, summary: msg }
      };
    }
    const summary = [
      timeToBug && `${timeToBug.runsWithFailures} execu\xE7\xF5es com falha`,
      costPerDefect && `${costPerDefect.totalFailures} falhas (~${costPerDefect.avgMinutesPerDefect} min/defeito)`,
      flowCoverage && `${flowCoverage.coveredFlows}/${flowCoverage.totalFlows} fluxos cobertos`
    ].filter(Boolean).join(" | ");
    return {
      content: [{ type: "text", text: lines || summary }],
      structuredContent: {
        ok: true,
        timeToBug,
        costPerDefect,
        flowCoverage,
        summary
      }
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
        "cypress",
        "playwright",
        "jest",
        "webdriverio",
        "appium",
        "robot",
        "pytest",
        "behave",
        "detox",
        "all"
      ]).optional().describe("Filtrar por framework. Default: all."),
      pattern: z.string().optional().describe("Pattern para filtrar (ex: 'login', 'api').")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      files: z.array(z.string()),
      total: z.number()
    })
  },
  async ({ framework = "all", pattern } = {}) => {
    const structure = detectProjectStructure();
    const collected = collectTestFiles(structure, { framework, pattern });
    const allFiles = collected.map((e) => e.path);
    const summary = `Encontrados ${allFiles.length} arquivo(s) de teste (qualquer framework).`;
    return {
      content: [{ type: "text", text: `${summary}

${allFiles.slice(0, 50).join("\n")}` }],
      structuredContent: { ok: true, files: allFiles, total: allFiles.length }
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
      path: z.string().optional().describe("Caminho espec\xEDfico (ex: src/). Default: todo o projeto.")
    }),
    outputSchema: z.object({
      status: z.enum(["passed", "failed", "not_found"]),
      message: z.string(),
      exitCode: z.number(),
      output: z.string().optional()
    })
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
        content: [{ type: "text", text: "Linter n\xE3o detectado no projeto." }],
        structuredContent: { status: "not_found", message: "No linter found", exitCode: 1 }
      };
    }
    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: PROJECT_ROOT,
        stdio: ["inherit", "pipe", "pipe"],
        shell: process.platform === "win32",
        env: { ...process.env }
      });
      let stdout = "";
      let stderr = "";
      if (child.stdout) child.stdout.on("data", (d) => {
        stdout += d.toString();
      });
      if (child.stderr) child.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        const passed = code === 0;
        resolve({
          content: [{ type: "text", text: passed ? "Linter passou." : "Linter encontrou problemas." }],
          structuredContent: {
            status: passed ? "passed" : "failed",
            message: passed ? "Lint passed" : "Lint failed",
            exitCode: code ?? 1,
            output: !passed ? output : void 0
          }
        });
      });
    });
  }
);
server.registerTool(
  "install_dependencies",
  {
    title: "Instalar depend\xEAncias",
    description: "Roda npm install, yarn install ou pnpm install (detecta automaticamente).",
    inputSchema: z.object({
      packageManager: z.enum(["npm", "yarn", "pnpm", "auto"]).optional().describe("Package manager. Default: auto.")
    }),
    outputSchema: z.object({
      status: z.enum(["success", "failed"]),
      message: z.string(),
      exitCode: z.number()
    })
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
        env: { ...process.env }
      });
      child.on("close", (code) => {
        const passed = code === 0;
        resolve({
          content: [{ type: "text", text: passed ? "Depend\xEAncias instaladas." : "Erro ao instalar depend\xEAncias." }],
          structuredContent: {
            status: passed ? "success" : "failed",
            message: passed ? "Dependencies installed" : "Install failed",
            exitCode: code ?? 1
          }
        });
      });
    });
  }
);
server.registerTool(
  "get_test_coverage",
  {
    title: "Obter cobertura de testes",
    description: "Roda testes com coverage (Jest, Playwright, Cypress com plugin).",
    inputSchema: z.object({
      framework: z.enum(["jest", "playwright", "cypress"]).optional().describe("Framework. Default: detectado automaticamente.")
    }),
    outputSchema: z.object({
      status: z.enum(["success", "failed", "not_supported"]),
      message: z.string(),
      coveragePercent: z.number().optional(),
      output: z.string().optional()
    })
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
          env: { ...process.env }
        });
        let stdout = "";
        if (child.stdout) child.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        child.on("close", (code) => {
          const coverageMatch = stdout.match(/All files.*?(\d+\.?\d*)/);
          const coveragePercent = coverageMatch ? parseFloat(coverageMatch[1]) : void 0;
          resolve({
            content: [{ type: "text", text: `Coverage: ${coveragePercent || "N/A"}%` }],
            structuredContent: {
              status: code === 0 ? "success" : "failed",
              message: code === 0 ? "Coverage generated" : "Coverage failed",
              coveragePercent,
              output: stdout
            }
          });
        });
      });
    }
    return {
      content: [{ type: "text", text: `Coverage n\xE3o suportado para ${fw} ainda.` }],
      structuredContent: { status: "not_supported", message: "Coverage not supported for this framework" }
    };
  }
);
server.registerTool(
  "watch_tests",
  {
    title: "Rodar testes em modo watch",
    description: "Inicia testes em watch mode (Jest, Vitest). \xDAtil para desenvolvimento.",
    inputSchema: z.object({
      framework: z.enum(["jest", "vitest"]).optional().describe("Framework. Default: detectado.")
    }),
    outputSchema: z.object({
      status: z.string(),
      message: z.string()
    })
  },
  async ({ framework }) => {
    const structure = detectProjectStructure();
    const fw = framework || (structure.testFrameworks.includes("jest") ? "jest" : "vitest");
    if (!structure.testFrameworks.includes(fw)) {
      return {
        content: [{ type: "text", text: `${fw} n\xE3o detectado no projeto.` }],
        structuredContent: { status: "not_found", message: "Framework not found" }
      };
    }
    return {
      content: [{ type: "text", text: `Para watch mode, rode manualmente: npx ${fw} --watch` }],
      structuredContent: {
        status: "info",
        message: `Watch mode requires interactive terminal. Run: npx ${fw} --watch`
      }
    };
  }
);
server.registerTool(
  "create_test_template",
  {
    title: "Criar template de teste",
    description: "Gera template b\xE1sico de teste (boilerplate) para o framework escolhido.",
    inputSchema: z.object({
      framework: z.enum(["cypress", "playwright", "jest"]).describe("Framework."),
      type: z.enum(["api", "ui", "unit"]).optional().describe("Tipo de teste. Default: api.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      template: z.string(),
      suggestedFileName: z.string()
    })
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
      structuredContent: { ok: true, template, suggestedFileName: fileName }
    };
  }
);
async function main() {
  const cmd = process.argv[2];
  if (cmd === "--help" || cmd === "-h") {
    console.log(`
mcp-lab-agent - MCP server para QA automation

USO:
  mcp-lab-agent [comando]   # Sem comando: inicia servidor MCP
  mcp-lab-agent --help     # Mostra esta ajuda

COMANDOS CLI:
  detect [--json]          Detecta frameworks e estrutura. Padr\xE3o: resumo. --json: JSON completo para scripts.
  route <tarefa>           Sugere qual ferramenta usar (ex: route "rodar testes")
  list                     Lista ferramentas MCP dispon\xEDveis

INTEGRA\xC7\xC3O MCP (Cursor/Cline/Windsurf):
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
`);
    process.exit(0);
  }
  if (cmd === "detect") {
    const structure = detectProjectStructure();
    const jsonOnly = process.argv.includes("--json");
    if (jsonOnly) {
      console.log(JSON.stringify(structure, null, 2));
    } else {
      const lines = [
        "",
        "mcp-lab-agent \xB7 detec\xE7\xE3o",
        "\u2500".repeat(40),
        `Frameworks: ${structure.testFrameworks.length ? structure.testFrameworks.join(", ") : "nenhum"}`,
        `Pastas:    ${structure.testDirs.length ? structure.testDirs.join(", ") : "nenhuma"}`,
        `Backend:   ${structure.backendDir || "\u2014"}`,
        `Frontend:  ${structure.frontendDir || "\u2014"}`,
        `Mobile:    ${structure.hasMobile ? "sim" : "\u2014"}`,
        "\u2500".repeat(40),
        "(use --json para sa\xEDda completa)",
        ""
      ];
      console.log(lines.join("\n"));
    }
    process.exit(0);
  }
  if (cmd === "list") {
    const agents = Object.entries(QA_AGENTS).map(([k, v]) => `  ${k}: ${v.tools.join(", ")}`);
    console.log("Agentes e ferramentas:\n" + agents.join("\n"));
    process.exit(0);
  }
  if (cmd === "route" && process.argv[3]) {
    const task = process.argv.slice(3).join(" ");
    const t = task.toLowerCase();
    let agent = "detection";
    if (/rodar|executar|run|test|coverage|watch/i.test(t)) agent = "execution";
    else if (/gerar|criar|escrever|generate|write|template/i.test(t)) agent = "generation";
    else if (/analisar|por que|falhou|sugerir|fix|selector/i.test(t)) agent = "analysis";
    else if (/browser|navegador|screenshot|network|console/i.test(t)) agent = "browser";
    else if (/relatório|métrica|bug report/i.test(t)) agent = "reporting";
    else if (/linter|dependência|instalar|analisar método/i.test(t)) agent = "maintenance";
    const a = QA_AGENTS[agent] || QA_AGENTS.detection;
    console.log(JSON.stringify({ suggestedAgent: agent, suggestedTools: a.tools, description: a.desc }, null, 2));
    process.exit(0);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((err) => {
  console.error("Erro no MCP server:", err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map