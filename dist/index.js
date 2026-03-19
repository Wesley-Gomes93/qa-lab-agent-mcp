#!/usr/bin/env node

// src/index.js
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn as spawn2 } from "child_process";
import path6 from "path";
import fs6 from "fs";
import { fileURLToPath, pathToFileURL } from "url";

// src/core/llm-router.js
function resolveLLMProvider(taskType = "simple") {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.QA_LAB_LLM_API_KEY;
  const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const CUSTOM_URL = process.env.QA_LAB_LLM_BASE_URL;
  const simpleModel = process.env.QA_LAB_LLM_SIMPLE;
  const complexModel = process.env.QA_LAB_LLM_COMPLEX;
  if (CUSTOM_URL) {
    const model2 = taskType === "complex" ? complexModel || "llama3.1:70b" : simpleModel || "llama3.1:8b";
    return { provider: "custom", apiKey: process.env.QA_LAB_LLM_API_KEY || "not-needed", baseUrl: CUSTOM_URL, model: model2 };
  }
  if (!GROQ_KEY && !GEMINI_KEY && !OPENAI_KEY) {
    const model2 = taskType === "complex" ? complexModel || "llama3.1:70b" : simpleModel || "llama3.1:8b";
    return { provider: "ollama", apiKey: "not-needed", baseUrl: `${OLLAMA_URL}/v1`, model: model2 };
  }
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

// src/core/memory.js
import path from "path";
import fs from "fs";

// src/core/hub-client.js
var hubUrl = null;
function getHubUrl() {
  if (hubUrl) return hubUrl;
  const env = process.env.LEARNING_HUB_URL || process.env.QA_LAB_LEARNING_HUB_URL;
  if (env) {
    hubUrl = env.replace(/\/$/, "");
    return hubUrl;
  }
  return null;
}
async function syncLearningsToHub(learnings) {
  const baseUrl = getHubUrl();
  if (!baseUrl) return;
  const entries = Array.isArray(learnings) ? learnings : [learnings];
  if (entries.length === 0) return;
  const projectId = process.env.LEARNING_HUB_PROJECT_ID || process.cwd().split("/").pop() || "default";
  const payload = entries.map((e) => ({
    ...e,
    projectId
  }));
  try {
    const res = await fetch(`${baseUrl}/learning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnings: payload })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[learning-hub] POST /learning failed ${res.status}: ${txt}`);
    }
  } catch (err) {
    console.warn("[learning-hub] sync failed:", err.message);
  }
}

// src/core/memory.js
var PROJECT_ROOT = process.cwd();
var MEMORY_FILE = path.join(PROJECT_ROOT, ".qa-lab-memory.json");
var FLOWS_CONFIG_FILE2 = path.join(PROJECT_ROOT, "qa-lab-flows.json");
function loadProjectMemory() {
  const memory = { patterns: {}, conventions: {}, lastRun: null, selectors: [] };
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const raw = fs.readFileSync(MEMORY_FILE, "utf8");
      Object.assign(memory, JSON.parse(raw));
    } catch {
    }
  }
  if (fs.existsSync(FLOWS_CONFIG_FILE2)) {
    try {
      const flows = JSON.parse(fs.readFileSync(FLOWS_CONFIG_FILE2, "utf8"));
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
    if (updates.learnings) {
      data.learnings = data.learnings || [];
      data.learnings.push(...updates.learnings);
      if (data.learnings.length > 200) data.learnings = data.learnings.slice(-150);
      syncLearningsToHub(updates.learnings).catch(() => {
      });
    }
    if (updates.execution) {
      data.executions = data.executions || [];
      data.executions.push(updates.execution);
      if (data.executions.length > 500) data.executions = data.executions.slice(-300);
    }
    data.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
  }
}
var LEARNING_TYPES = ["selector_fix", "timing_fix", "element_not_rendered", "element_not_visible", "element_stale", "mobile_mapping_invisible"];
function getMemoryStats() {
  const memory = loadProjectMemory();
  const learnings = memory.learnings || [];
  const successfulFixes = learnings.filter((l) => l.success);
  const selectorFixes = learnings.filter((l) => l.type === "selector_fix");
  const timingFixes = learnings.filter((l) => l.type === "timing_fix");
  const byLearningType = {};
  for (const t of LEARNING_TYPES) {
    byLearningType[t] = learnings.filter((l) => l.type === t).length;
  }
  const totalTests = learnings.filter((l) => l.type === "test_generated").length;
  const firstAttemptSuccess = learnings.filter((l) => l.type === "test_generated" && l.passedFirstTime).length;
  return {
    totalLearnings: learnings.length,
    successfulFixes: successfulFixes.length,
    selectorFixes: selectorFixes.length,
    timingFixes: timingFixes.length,
    byLearningType,
    testsGenerated: totalTests,
    firstAttemptSuccessRate: totalTests > 0 ? Math.round(firstAttemptSuccess / totalTests * 100) : 0
  };
}
function analyzeTestStability() {
  const memory = loadProjectMemory();
  const executions = memory.executions || [];
  if (executions.length === 0) return { tests: [], message: "Nenhuma execu\xE7\xE3o registrada ainda." };
  const byTest = {};
  executions.forEach((ex) => {
    if (!byTest[ex.testFile]) {
      byTest[ex.testFile] = { total: 0, passed: 0, failed: 0, durations: [] };
    }
    byTest[ex.testFile].total++;
    if (ex.passed) byTest[ex.testFile].passed++;
    else byTest[ex.testFile].failed++;
    if (ex.duration) byTest[ex.testFile].durations.push(ex.duration);
  });
  const tests = Object.entries(byTest).map(([file, data]) => {
    const failureRate = Math.round(data.failed / data.total * 100);
    const avgDuration = data.durations.length > 0 ? (data.durations.reduce((a, b) => a + b, 0) / data.durations.length).toFixed(1) : 0;
    const stability = failureRate === 0 ? "stable" : failureRate < 20 ? "mostly_stable" : failureRate < 50 ? "flaky" : "unstable";
    return {
      file,
      total: data.total,
      passed: data.passed,
      failed: data.failed,
      failureRate,
      avgDuration: parseFloat(avgDuration),
      stability
    };
  }).sort((a, b) => b.failureRate - a.failureRate);
  return { tests, message: `Analisadas ${executions.length} execu\xE7\xF5es de ${tests.length} teste(s).` };
}

// src/core/flaky-detection.js
var FLAKY_PATTERNS = [
  { name: "timing", regex: /timeout|timed out|exceeded|wait|delay|slow|race condition/i, suggestion: "Adicione wait expl\xEDcito (ex: page.waitForSelector) ou aumente o timeout." },
  { name: "ordering", regex: /order|sequenc|flaky|intermittent|sometimes|random/i, suggestion: "Issole o teste ou use beforeAll/afterAll para estado limpo. Evite depend\xEAncia de ordem entre testes." },
  { name: "selector", regex: /element not found|selector|locator|cy\.get|page\.locator|Unable to find/i, suggestion: "Use seletores est\xE1veis: data-testid, role, texto acess\xEDvel. Evite classes CSS din\xE2micas." },
  { name: "network", regex: /ECONNREFUSED|network|fetch|axios|request failed|404|500/i, suggestion: "Mocke APIs ou garanta que o backend esteja rodando. Use retry ou intercept." },
  { name: "shared_state", regex: /state|cleanup|beforeEach|afterEach|isolation/i, suggestion: "Garanta beforeEach/afterEach para resetar estado. Evite vari\xE1veis globais compartilhadas." }
];
var FAILURE_ANALYSIS_PATTERNS = [
  {
    name: "element_not_rendered",
    regex: /timeout|not found|element not found|no such element|element.*not.*in.*dom|waiting for/i,
    oQueAconteceu: "O elemento ainda n\xE3o foi renderizado no DOM quando o teste tentou interagir. Pode ser carregamento ass\xEDncrono, lazy load ou anima\xE7\xE3o.",
    lesson: `Espere o elemento estar dispon\xEDvel ANTES de interagir:
- Playwright: await element.waitFor({ state: 'attached' }) ou waitForSelector
- Cypress: cy.get(sel).should('exist') antes de clicar
- WDIO/Appium: $(sel).waitForDisplayed() ou waitForExist({ timeout: 10000 })
- Use waits inteligentes: waitForDisplayed, waitForClickable, waitForExist`,
    learningType: "element_not_rendered"
  },
  {
    name: "element_not_visible",
    regex: /element.*not.*visible|not visible|is not visible|element is not displayed|hidden|display.*none|off.?screen/i,
    oQueAconteceu: "O elemento existe no DOM mas n\xE3o est\xE1 vis\xEDvel (display:none, off-screen, opacity:0 ou ainda carregando).",
    lesson: `Verifique visibilidade antes de interagir:
- Playwright: waitFor({ state: 'visible' })
- Cypress: .should('be.visible') antes de click
- Appium/WDIO: waitForDisplayed() ou isDisplayed()
- Adicione wait expl\xEDcito: elemento pode estar em anima\xE7\xE3o ou carregando`,
    learningType: "element_not_visible"
  },
  {
    name: "element_stale",
    regex: /stale element|stale element reference|element.*no longer attached/i,
    oQueAconteceu: "O elemento foi encontrado mas a p\xE1gina/DOM mudou antes da intera\xE7\xE3o (elemento ficou obsoleto).",
    lesson: `Re-localize o elemento antes de cada a\xE7\xE3o:
- Evite guardar refer\xEAncia: busque novamente antes de clicar
- Use waits que revalidam: cy.get().first().click() com retry
- Em listas din\xE2micas: espere estabiliza\xE7\xE3o antes de interagir`,
    learningType: "element_stale"
  },
  {
    name: "mobile_mapping_invisible",
    regex: /element not found|selector|Unable to find|no such element/i,
    oQueAconteceu: "Em mobile: o mapeamento ficou invis\xEDvel ou os seletores n\xE3o est\xE3o estruturados. Pode ser estrutura do c\xF3digo ou seletor incorreto.",
    lesson: `Em testes mobile (Appium/Detox), SEMPRE:
- Mapeamento VIS\xCDVEL: const ELEMENTS = { btn: '~id' }; $(ELEMENTS.btn).click()
- Antes de clicar: $(sel).waitForDisplayed({ timeout: 10000 })
- Ao final: expect(await $(sel).isDisplayed()).toBe(true) \u2014 valida\xE7\xE3o expl\xEDcita para o usu\xE1rio entender que houve valida\xE7\xE3o`,
    learningType: "mobile_mapping_invisible",
    mobileOnly: true
  },
  {
    name: "selector",
    regex: /selector|locator|element not found|Unable to find/i,
    oQueAconteceu: "O seletor n\xE3o encontrou o elemento. Pode ser seletor incorreto, mudan\xE7a de UI ou elemento em outro contexto (iframe, shadow DOM).",
    lesson: "Use seletores est\xE1veis: data-testid, role+name, accessibility-id. Evite classes CSS din\xE2micas. Priorize: data-testid > role > texto vis\xEDvel.",
    learningType: "selector_fix"
  },
  {
    name: "timing",
    regex: /timeout|timed out|exceeded|slow/i,
    oQueAconteceu: "O teste excedeu o tempo de espera. O elemento pode demorar para aparecer ou h\xE1 race condition.",
    lesson: "Adicione wait expl\xEDcito antes de interagir. Aumente timeout se necess\xE1rio. Use waitForDisplayed/waitForSelector.",
    learningType: "timing_fix"
  }
];
function oneLineFailureSummary(runOutput, framework = "", oQueAconteceu = "", sugestaoCorrecao = "") {
  const p = inferFailurePattern(runOutput, framework);
  const causa = oQueAconteceu || p?.oQueAconteceu || "erro desconhecido";
  const solucao = sugestaoCorrecao || (p ? p.lesson.split("\n")[0].replace(/^-\s*/, "") : "");
  const tipo = p?.name || "geral";
  if (solucao) {
    return `Falhou porque ${causa.slice(0, 80)}${causa.length > 80 ? "\u2026" : ""} (${tipo}). Solu\xE7\xE3o: ${solucao.slice(0, 100)}${solucao.length > 100 ? "\u2026" : ""}`;
  }
  return `Falhou porque ${causa.slice(0, 120)}${causa.length > 120 ? "\u2026" : ""} (${tipo}).`;
}
function inferFailurePattern(runOutput, framework = "") {
  const output = (runOutput || "").toLowerCase();
  for (const p of FAILURE_ANALYSIS_PATTERNS) {
    if (p.mobileOnly && !/appium|detox/i.test(framework)) continue;
    if (p.regex.test(output)) return p;
  }
  return null;
}
var MOBILE_SELECTOR_HIERARCHY = `HIERARQUIA DE SELETORES MOBILE (\xFAnica e inovadora):
1. id: ~accessibility-id, testID \u2014 prioridade m\xE1xima, sem\xE2ntico e est\xE1vel
2. XPath relacional: \xE2ncora est\xE1vel + eixos + TIPO ESPEC\xCDFICO (android.widget.Button, XCUIElementTypeButton). NUNCA use * \u2014 quebra por timing e m\xFAltiplos matches. Ex: //android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']. Evite XPath por \xEDndice (//Button[3])
3. resource-id: id=com.app:id/btn \u2014 fallback`;
var MOBILE_MAPPING_LESSON = `Em testes mobile (Appium/Detox), SEMPRE inclua o mapeamento de elementos de forma VIS\xCDVEL e estruturada no c\xF3digo:
- Use constantes ou Page Object no TOPO do spec: const ELEMENTS = { loginBtn: '~btn_login', ... };
- No teste: $(ELEMENTS.loginBtn).click();
- Nunca deixe seletores "invis\xEDveis" (hardcoded inline repetidos). Isso dificulta manuten\xE7\xE3o e causa falhas.
- Hierarquia: id > XPath relacional (\xE2ncora + eixos + tipo espec\xEDfico: android.widget.Button) > resource-id. Evite * e \xEDndice.`;
var UNIVERSAL_TEST_PRACTICES = `PR\xC1TICAS OBRIGAT\xD3RIAS em todo teste gerado:
1. Esperas inteligentes: ANTES de interagir, verifique que o elemento est\xE1 dispon\xEDvel (waitForDisplayed, waitForExist, waitForSelector)
2. Valida\xE7\xE3o no final: SEMPRE adicione um expect/assert ao final para o usu\xE1rio entender que houve valida\xE7\xE3o (ex: expect(element).toBeVisible() ou cy.get(sel).should('be.visible'))
3. N\xE3o assuma que o elemento est\xE1 pronto: elemento pode n\xE3o estar renderizado, vis\xEDvel ou dispon\xEDvel \u2014 use waits expl\xEDcitos`;
function formatLearnedMessageForUser({ pattern, fixSummary, runOutput, framework }) {
  const p = pattern || (runOutput ? inferFailurePattern(runOutput, framework) : null);
  const oQueAconteceu = p?.oQueAconteceu || "O teste falhou por um problema de elemento ou timing.";
  const oQueFiz = fixSummary || (p ? `Apliquei a corre\xE7\xE3o para esse tipo de falha: ${p.name}.` : "Ajustei o c\xF3digo.");
  return `**Entendi o erro e apliquei a corre\xE7\xE3o**

**O que aconteceu:** ${oQueAconteceu}

**O que fiz:** ${oQueFiz}

**O que aprendi:** Salvei esse cen\xE1rio no meu hist\xF3rico. Nas pr\xF3ximas gera\xE7\xF5es, vou aplicar as pr\xE1ticas corretas (waits inteligentes, valida\xE7\xE3o final) desde o in\xEDcio.

Use \`mcp-lab-agent stats\` ou \`get_learning_report\` para ver a evolu\xE7\xE3o dos aprendizados.`;
}
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

// src/core/project-structure.js
import path2 from "path";
import fs2 from "fs";
var PROJECT_ROOT2 = process.cwd();
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
  const pkgPath = path2.join(PROJECT_ROOT2, "package.json");
  if (fs2.existsSync(pkgPath)) {
    structure.packageJson = JSON.parse(fs2.readFileSync(pkgPath, "utf8"));
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
    if (deps["react-native"]) {
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
  const requirementsPath = path2.join(PROJECT_ROOT2, "requirements.txt");
  if (fs2.existsSync(requirementsPath)) {
    const requirements = fs2.readFileSync(requirementsPath, "utf8");
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
    const fullPath = path2.join(PROJECT_ROOT2, dir);
    if (fs2.existsSync(fullPath) && fs2.statSync(fullPath).isDirectory()) {
      structure.testDirs.push(dir);
    }
  }
  const skipDirs = ["node_modules", ".git", "dist", "build", ".next", ".venv"];
  try {
    const rootEntries = fs2.readdirSync(PROJECT_ROOT2, { withFileTypes: true });
    for (const e of rootEntries) {
      if (!e.isDirectory() || skipDirs.includes(e.name)) continue;
      const subPath = path2.join(PROJECT_ROOT2, e.name);
      if (structure.testDirs.includes(e.name)) continue;
      const hasPkg = fs2.existsSync(path2.join(subPath, "package.json"));
      const hasTests = fs2.existsSync(path2.join(subPath, "tests")) || fs2.existsSync(path2.join(subPath, "test")) || fs2.existsSync(path2.join(subPath, "e2e")) || fs2.existsSync(path2.join(subPath, "__tests__")) || fs2.existsSync(path2.join(subPath, "specs"));
      if (hasPkg || hasTests) {
        structure.testDirs.push(e.name);
      }
    }
  } catch {
  }
  for (const dir of structure.testDirs) {
    const subPkg = path2.join(PROJECT_ROOT2, dir, "package.json");
    if (!fs2.existsSync(subPkg)) continue;
    try {
      const sub = JSON.parse(fs2.readFileSync(subPkg, "utf8"));
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
    const reqPath = path2.join(PROJECT_ROOT2, dir, "requirements.txt");
    if (!fs2.existsSync(reqPath)) continue;
    try {
      const req = fs2.readFileSync(reqPath, "utf8");
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
    const fullPath = path2.join(PROJECT_ROOT2, dir);
    if (fs2.existsSync(fullPath) && !structure.backendDir) {
      const hasServerFile = fs2.existsSync(path2.join(fullPath, "server.js")) || fs2.existsSync(path2.join(fullPath, "index.js")) || fs2.existsSync(path2.join(fullPath, "app.js"));
      if (hasServerFile) {
        structure.backendDir = dir;
      }
    }
  }
  const commonFrontendDirs = ["frontend", "client", "web", "app", "src"];
  for (const dir of commonFrontendDirs) {
    const fullPath = path2.join(PROJECT_ROOT2, dir);
    if (fs2.existsSync(fullPath) && !structure.frontendDir) {
      const hasAppFile = fs2.existsSync(path2.join(fullPath, "App.js")) || fs2.existsSync(path2.join(fullPath, "App.tsx")) || fs2.existsSync(path2.join(fullPath, "index.html"));
      if (hasAppFile) {
        structure.frontendDir = dir;
      }
    }
  }
  const hints = [];
  if (structure.hasMobile) hints.push("mobile");
  if (structure.testFrameworks.includes("appium")) hints.push("appium");
  if (structure.testFrameworks.includes("detox")) hints.push("detox");
  const pkg = structure.packageJson || {};
  const allDeps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
  if (allDeps["react-native"]) hints.push("react-native");
  const webFrameworks = ["cypress", "playwright", "webdriverio", "selenium", "puppeteer", "testcafe"];
  const hasWebFrameworks = structure.testFrameworks.some((f) => webFrameworks.includes(f));
  if (hasWebFrameworks) hints.push("web");
  if (structure.testDirs.includes("mobile")) hints.push("mobile-dir");
  const configPath = path2.join(PROJECT_ROOT2, "qa-lab-agent.config.json");
  if (fs2.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs2.readFileSync(configPath, "utf8"));
      const customDirs = cfg.testDirs || cfg.qa?.testDirs;
      if (Array.isArray(customDirs)) {
        for (const dir of customDirs) {
          const d = String(dir).trim();
          if (d && !structure.testDirs.includes(d)) {
            const fullPath = path2.join(PROJECT_ROOT2, d);
            if (fs2.existsSync(fullPath) && fs2.statSync(fullPath).isDirectory()) {
              structure.testDirs.push(d);
            }
          }
        }
      }
    } catch {
    }
  }
  let environment = "web";
  if (structure.hasMobile && !hasWebFrameworks) environment = "mobile";
  else if (structure.hasMobile && hasWebFrameworks) environment = "both";
  structure.environment = environment;
  structure.environmentHints = [...new Set(hints)];
  return structure;
}
var UNIVERSAL_TEST_PATTERNS = [
  /\.(cy|spec|test)\.(js|ts|jsx|tsx)$/i,
  /_test\.(js|ts)$/i,
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
    const fullPath = path2.join(PROJECT_ROOT2, dir);
    const walk = (p, base = "") => {
      if (!fs2.existsSync(p)) return;
      const entries = fs2.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === ".git" || e.name === ".venv") continue;
          walk(path2.join(p, e.name), rel);
        } else if (e.isFile() && isTestFile(e.name)) {
          const filePath = `${dir}/${rel}`;
          if (pattern && !filePath.toLowerCase().includes(pattern.toLowerCase())) continue;
          const inferredFw = inferFrameworkFromFile(e.name, structure, filePath);
          if (framework && framework !== "all" && inferredFw !== framework && !matchesFramework(inferredFw, framework)) continue;
          const entry = { path: filePath, inferredFramework: inferredFw };
          if (maxContentFiles > 0 && results.length < maxContentFiles) {
            try {
              entry.content = fs2.readFileSync(path2.join(PROJECT_ROOT2, filePath), "utf8");
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
function detectDeviceConfig(structure) {
  const result = { device: null, configuration: null, platform: null, envOverrides: {} };
  if (!structure.hasMobile) return result;
  const configPath = path2.join(PROJECT_ROOT2, "qa-lab-agent.config.json");
  if (fs2.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs2.readFileSync(configPath, "utf8"));
      const deviceCfg = cfg.device || cfg.mobile || cfg.appium || cfg.detox;
      if (deviceCfg) {
        result.device = deviceCfg.deviceName || deviceCfg.device || deviceCfg.udid;
        result.configuration = deviceCfg.configuration || deviceCfg.config;
        result.platform = deviceCfg.platformName || deviceCfg.platform;
        if (deviceCfg.udid) result.envOverrides.APPIUM_UDID = deviceCfg.udid;
        if (deviceCfg.deviceName) result.envOverrides.APPIUM_DEVICE_NAME = deviceCfg.deviceName;
      }
    } catch {
    }
  }
  if (process.env.DETOX_CONFIGURATION) result.configuration = process.env.DETOX_CONFIGURATION;
  if (process.env.APPIUM_UDID) result.envOverrides.APPIUM_UDID = process.env.APPIUM_UDID;
  if (process.env.APPIUM_DEVICE_NAME) result.envOverrides.APPIUM_DEVICE_NAME = process.env.APPIUM_DEVICE_NAME;
  const detoxPath = path2.join(PROJECT_ROOT2, ".detoxrc.js");
  if (fs2.existsSync(detoxPath) && !result.configuration) {
    try {
      const content = fs2.readFileSync(detoxPath, "utf8");
      const configMatch = content.match(/configurations:\s*\{([^}]+)\}/s);
      if (configMatch) {
        const firstConfig = configMatch[1].match(/"([^"]+)":\s*\{/);
        if (firstConfig) result.configuration = firstConfig[1];
      }
    } catch {
    }
  }
  const wdioPaths = ["wdio.conf.js", "wdio.conf.cjs", "wdio.conf.mjs", "wdio.conf.ts"];
  for (const name of wdioPaths) {
    const wdioPath = path2.join(PROJECT_ROOT2, name);
    if (fs2.existsSync(wdioPath) && !result.device) {
      try {
        const content = fs2.readFileSync(wdioPath, "utf8");
        const capMatch = content.match(/capabilities:\s*\[([\s\S]*?)\]/);
        if (capMatch) {
          const deviceMatch = capMatch[1].match(/deviceName:\s*['"]([^'"]+)['"]/);
          const udidMatch = capMatch[1].match(/udid:\s*['"]([^'"]+)['"]/);
          const platformMatch = capMatch[1].match(/platformName:\s*['"]([^'"]+)['"]/);
          if (deviceMatch) result.device = deviceMatch[1];
          if (udidMatch) result.envOverrides.APPIUM_UDID = udidMatch[1];
          if (platformMatch) result.platform = platformMatch[1];
        }
      } catch {
      }
      break;
    }
  }
  return result;
}
function getFrameworkCwd(structure, preferredDirs) {
  for (const dir of preferredDirs) {
    if (structure.testDirs.includes(dir)) {
      return path2.join(PROJECT_ROOT2, dir);
    }
  }
  const fallback = structure.testDirs[0];
  return fallback ? path2.join(PROJECT_ROOT2, fallback) : PROJECT_ROOT2;
}
function analyzeCodeRisks() {
  const structure = detectProjectStructure();
  const risks = [];
  const srcDirs = ["src", "app", "lib", "components", "pages", "api", "services", "controllers"];
  const foundDirs = srcDirs.filter((dir) => fs2.existsSync(path2.join(PROJECT_ROOT2, dir)));
  foundDirs.forEach((dir) => {
    const fullPath = path2.join(PROJECT_ROOT2, dir);
    const files = fs2.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(js|ts|jsx|tsx|py)$/.test(f));
    const hasTests = structure.testDirs.some((testDir) => {
      const testPath = path2.join(PROJECT_ROOT2, testDir);
      if (!fs2.existsSync(testPath)) return false;
      const testFiles = fs2.readdirSync(testPath, { recursive: true });
      return testFiles.some((tf) => tf.includes(dir) || tf.toLowerCase().includes(dir.toLowerCase()));
    });
    if (!hasTests && files.length > 0) {
      risks.push({
        area: dir,
        files: files.length,
        risk: files.length > 20 ? "high" : files.length > 10 ? "medium" : "low",
        reason: "Sem testes detectados para esta \xE1rea"
      });
    }
  });
  return risks.sort((a, b) => {
    const riskOrder = { high: 3, medium: 2, low: 1 };
    return riskOrder[b.risk] - riskOrder[a.risk];
  });
}

// src/core/llm-call.js
import path3 from "path";
import fs3 from "fs";
var PROJECT_ROOT3 = process.cwd();
async function callLlm(provider, apiKey, baseUrl, model, systemPrompt, userPrompt) {
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
async function applySelectorFixAndRetry(testFilePath, errorOutput, framework) {
  const structure = detectProjectStructure();
  const fw = framework || inferFrameworkFromFile(testFilePath.split("/").pop(), structure);
  const fullPath = path3.join(PROJECT_ROOT3, testFilePath.replace(/^\//, "").replace(/\\/g, "/"));
  if (!fs3.existsSync(fullPath)) return { applied: false };
  let testCode = "";
  try {
    testCode = fs3.readFileSync(fullPath, "utf8");
  } catch {
    return { applied: false };
  }
  const llm = resolveLLMProvider("complex");
  if (!llm.apiKey) return { applied: false };
  const { provider, apiKey, baseUrl, model } = llm;
  const systemPrompt = `Voc\xEA \xE9 um especialista em testes E2E. O teste falhou porque um seletor n\xE3o encontrou o elemento.
Retorne APENAS em JSON (sem markdown) com a chave:
- codigoCorrigido: string (o ARQUIVO COMPLETO do teste corrigido, com imports e toda a estrutura. Substitua o seletor quebrado por um mais resiliente: data-testid, role, ~accessibility-id, ou XPath relacional com tipo espec\xEDfico.)

Framework: ${fw}. Priorize seletores est\xE1veis.`;
  const userPrompt = `Output do erro:
---
${(errorOutput || "").slice(0, 8e3)}
---

C\xF3digo atual:
---
${testCode.slice(0, 6e3)}
---`;
  try {
    let raw = await callLlm(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const data = JSON.parse(raw);
    const fixed = (data.codigoCorrigido || "").trim();
    if (fixed.length > 50 && /describe|it\(|test\(|cy\.|page\.|\$\(/.test(fixed)) {
      fs3.writeFileSync(fullPath, fixed, "utf8");
      return { applied: true };
    }
  } catch {
  }
  return { applied: false };
}

// src/core/tool-helpers.js
import path4 from "path";
import fs4 from "fs";
var PROJECT_ROOT4 = process.cwd();
var METRICS_FILE = path4.join(PROJECT_ROOT4, ".qa-lab-metrics.json");
function parseTestRunResult(runOutput, exitCode) {
  let passed = 0;
  let failed = 0;
  const jestMatch = runOutput.match(/Tests:\s+(\d+)\s+passed(?:,\s*(\d+)\s+failed)?/);
  if (jestMatch) {
    passed = parseInt(jestMatch[1], 10);
    failed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0;
  }
  return { passed, failed, success: exitCode === 0 };
}
function recordMetricEvent(event) {
  try {
    let data = {};
    if (fs4.existsSync(METRICS_FILE)) {
      const raw = fs4.readFileSync(METRICS_FILE, "utf8");
      try {
        data = JSON.parse(raw);
      } catch {
      }
    }
    data.events = data.events || [];
    data.events.push({ ...event, timestamp: event.timestamp || (/* @__PURE__ */ new Date()).toISOString() });
    data.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    if (data.events.length > 500) data.events = data.events.slice(-400);
    fs4.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), "utf8");
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

// src/cli/commands.js
import path5 from "path";
import fs5 from "fs";
import { spawn } from "child_process";
var PROJECT_ROOT5 = process.cwd();
var QA_AGENTS = {
  autonomous: { desc: "Modo aut\xF4nomo: gera, testa, corrige e aprende", tools: ["qa_auto"] },
  detection: { desc: "Detecta estrutura, frameworks, testes", tools: ["detect_project", "read_project", "list_test_files"] },
  execution: { desc: "Executa testes, coverage, watch", tools: ["run_tests", "watch_tests", "get_test_coverage"] },
  generation: { desc: "Gera e escreve testes", tools: ["generate_tests", "write_test", "create_test_template"] },
  analysis: { desc: "Analisa falhas, sugere corre\xE7\xF5es", tools: ["analyze_failures", "por_que_falhou", "suggest_fix", "suggest_selector_fix", "analyze_file_methods"] },
  browser: { desc: "Browser mode: screenshots, network, console", tools: ["web_eval_browser"] },
  reporting: { desc: "Relat\xF3rios e m\xE9tricas", tools: ["create_bug_report", "get_business_metrics"] },
  intelligence: { desc: "An\xE1lise preditiva e insights", tools: ["qa_full_analysis", "qa_health_check", "qa_suggest_next_test", "qa_predict_flaky", "qa_compare_with_industry", "qa_time_travel"] },
  learning: { desc: "Sistema de aprendizado", tools: ["qa_learning_stats", "get_learning_report"] },
  maintenance: { desc: "Linter, deps, an\xE1lise de c\xF3digo", tools: ["run_linter", "install_dependencies"] }
};
function getExtensionAndBaseDir(fw, structure) {
  const extMap = { cypress: ".cy.js", playwright: ".spec.js", jest: ".test.js", vitest: ".test.js", robot: ".robot", pytest: ".py" };
  const ext = extMap[fw] || ".spec.js";
  const baseDir = structure.testDirs[0] ? path5.join(PROJECT_ROOT5, structure.testDirs[0]) : path5.join(PROJECT_ROOT5, "tests");
  return { ext, baseDir };
}
async function handleCLI() {
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
  analyze                               An\xE1lise completa: executa, analisa estabilidade, prev\xEA riscos e recomenda a\xE7\xF5es
  auto <descri\xE7\xE3o> [--max-retries N]    Modo aut\xF4nomo: gera teste, roda, corrige e aprende (default: 3 tentativas)
  stats                                 Estat\xEDsticas de aprendizado (taxa de sucesso, corre\xE7\xF5es, etc.)
  report [--full]                        Relat\xF3rio de evolu\xE7\xE3o e aprendizado (--full = completo com recomenda\xE7\xF5es)
  metrics-report [--json] [--output FILE] [path1 path2 ...]  Relat\xF3rio de m\xE9tricas (m\xE9todo, resultado). Sem paths = projeto atual.
  flaky-report [--runs N] [--spec FILE] [--output FILE]      Detecta testes flaky: roda N vezes (default 3), identifica intermit\xEAncia e causa prov\xE1vel
  run [spec] [--device NAME] [--no-auto-fix]                 Roda testes: detecta device, executa e aplica auto-fix de seletor se falhar
  detect [--json]                       Detecta frameworks e estrutura
  route <tarefa>                        Sugere qual ferramenta usar
  list                                  Lista ferramentas MCP dispon\xEDveis

EXEMPLOS:
  mcp-lab-agent slack-bot                       # Slack Bot
  mcp-lab-agent learning-hub                   # Learning Hub (API + Dashboard)
  npx mcp-lab-agent slack-bot                   # Usar sem instalar (sem clonar o projeto)
  mcp-lab-agent analyze                         # An\xE1lise completa + recomenda\xE7\xF5es
  mcp-lab-agent auto "login flow" --max-retries 5
  mcp-lab-agent stats
  mcp-lab-agent flaky-report --runs 5 --output flaky.md
  mcp-lab-agent run specs/login.spec.js
  mcp-lab-agent run specs/login.spec.js --device iPhone_15
  mcp-lab-agent detect --json

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
\u{1F4CA} Estat\xEDsticas de Aprendizado

Total de aprendizados: ${stats.totalLearnings}
Corre\xE7\xF5es bem-sucedidas: ${stats.successfulFixes}
Corre\xE7\xF5es de seletores: ${stats.selectorFixes}
Corre\xE7\xF5es de timing: ${stats.timingFixes}
Testes gerados: ${stats.testsGenerated}
Taxa de sucesso na 1\xAA tentativa: ${stats.firstAttemptSuccessRate}%
${byTypeLines ? `
Por tipo:
${byTypeLines}` : ""}

${stats.totalLearnings === 0 ? "\u26A0\uFE0F Ainda n\xE3o h\xE1 aprendizados. Use 'mcp-lab-agent auto <descri\xE7\xE3o>' para gerar testes e aprender com erros." : ""}
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
      recommendations.push("Use waits expl\xEDcitos (waitForSelector, waitForDisplayed) ANTES de interagir com elementos.");
    }
    if (byType.timing_fix > 0 || byType.element_stale > 0) {
      recommendations.push("Aumente timeouts e use re-localiza\xE7\xE3o de elementos em listas din\xE2micas.");
    }
    if (byType.selector_fix > 0 || byType.mobile_mapping_invisible > 0) {
      recommendations.push("Priorize data-testid, role e seletores est\xE1veis; em mobile, use mapeamento vis\xEDvel no topo do spec.");
    }
    if (stats.firstAttemptSuccessRate < 70 && stats.testsGenerated > 0) {
      recommendations.push("Aplique waits inteligentes + assert final em cada teste gerado.");
    }
    const byTypeStr = Object.entries(byType).filter(([, v]) => v > 0).map(([t, v]) => `  - ${t}: ${v}`).join("\n");
    console.log(`
\u{1F4C8} Relat\xF3rio de Evolu\xE7\xE3o e Aprendizado

Resumo por tipo:
${byTypeStr || "  Nenhum aprendizado por tipo ainda"}

M\xE9tricas gerais:
  Total de aprendizados: ${stats.totalLearnings}
  Taxa de sucesso (1\xAA tentativa): ${stats.firstAttemptSuccessRate}%
  Testes gerados: ${stats.testsGenerated}
${format === "full" && recommendations.length > 0 ? `
Recomenda\xE7\xF5es para aprimorar o c\xF3digo:
${recommendations.map((r) => `  \u2022 ${r}`).join("\n")}` : ""}
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
async function handleMetricsReportCommand() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const outputIdx = argv.indexOf("--output");
  const outputFile = outputIdx !== -1 && argv[outputIdx + 1] ? argv[outputIdx + 1] : null;
  const paths = argv.filter((a) => {
    if (a.startsWith("--") || a === "metrics-report") return false;
    if (outputIdx !== -1 && a === argv[outputIdx + 1]) return false;
    return true;
  });
  const projectDirs = paths.length > 0 ? paths : [PROJECT_ROOT5];
  const reports = [];
  for (const dir of projectDirs) {
    const resolved = path5.resolve(dir);
    if (!fs5.existsSync(resolved)) {
      console.warn(`\u26A0\uFE0F Diret\xF3rio n\xE3o encontrado: ${dir}`);
      continue;
    }
    const memoryPath = path5.join(resolved, ".qa-lab-memory.json");
    const metricsPath = path5.join(resolved, ".qa-lab-metrics.json");
    let memory = {};
    let metrics = { events: [] };
    if (fs5.existsSync(memoryPath)) {
      try {
        memory = JSON.parse(fs5.readFileSync(memoryPath, "utf8"));
      } catch {
      }
    }
    if (fs5.existsSync(metricsPath)) {
      try {
        metrics = JSON.parse(fs5.readFileSync(metricsPath, "utf8"));
      } catch {
      }
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
      byFramework[f] = byFramework[f] || { total: 0, passed: 0, failed: 0 };
      byFramework[f].total++;
      if (e.exitCode === 0) byFramework[f].passed++;
      else byFramework[f].failed++;
    });
    const byLearningType = {};
    learnings.forEach((l) => {
      const t = l.type || "unknown";
      byLearningType[t] = byLearningType[t] || { total: 0, success: 0 };
      byLearningType[t].total++;
      if (l.success) byLearningType[t].success++;
    });
    const execByFramework = {};
    executions.forEach((e) => {
      const f = e.framework || "unknown";
      execByFramework[f] = execByFramework[f] || { total: 0, passed: 0 };
      execByFramework[f].total++;
      if (e.passed) execByFramework[f].passed++;
    });
    const projectName = path5.basename(resolved);
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
        lastUpdated: metrics.lastUpdated || memory.updatedAt
      },
      recentEvents: events.slice(-20).map((e) => ({
        type: e.type,
        timestamp: e.timestamp,
        framework: e.framework,
        spec: e.spec,
        passed: e.passed,
        failed: e.failed,
        exitCode: e.exitCode,
        durationSeconds: e.durationSeconds
      }))
    });
  }
  if (jsonOnly) {
    const out = JSON.stringify({ projects: reports, generatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2);
    if (outputFile) fs5.writeFileSync(outputFile, out, "utf8");
    else console.log(out);
    return;
  }
  let report = `# Relat\xF3rio de M\xE9tricas \u2014 mcp-lab-agent

`;
  report += `Gerado em: ${(/* @__PURE__ */ new Date()).toISOString()}
`;
  report += `Projetos: ${reports.length}

`;
  report += `---

`;
  for (const r of reports) {
    report += `## ${r.project}

`;
    report += `**Caminho:** \`${r.path}\`

`;
    const s = r.summary;
    report += `### Eventos (.qa-lab-metrics.json)

`;
    report += `| M\xE9todo/Tipo | Total | Descri\xE7\xE3o |
`;
    report += `|-------------|-------|
`;
    for (const [t, count] of Object.entries(s.eventTypes || {})) {
      let desc = "";
      if (t === "test_run") desc = `Execu\xE7\xE3o de testes (passed/failed por framework abaixo)`;
      else if (t === "bug_reported") desc = "Bug report gerado";
      else desc = t;
      report += `| ${t} | ${count} | ${desc} |
`;
    }
    if (Object.keys(s.eventTypes || {}).length === 0) {
      report += `| \u2014 | 0 | Nenhum evento registrado |
`;
    }
    report += `
`;
    if (s.testRuns?.total > 0) {
      report += `### Resultado de Execu\xE7\xF5es (run_tests)

`;
      report += `| Framework | Total | Passed | Failed | Taxa sucesso |
`;
      report += `|-----------|-------|--------|--------|---------------|
`;
      for (const [fw, data] of Object.entries(s.byFramework || {})) {
        const rate = data.total > 0 ? Math.round(data.passed / data.total * 100) : 0;
        report += `| ${fw} | ${data.total} | ${data.passed} | ${data.failed} | ${rate}% |
`;
      }
      report += `
`;
      report += `**Resumo:** ${s.testRuns.passed} passed, ${s.testRuns.failed} failed (total: ${s.testRuns.total})

`;
    }
    if (s.executions?.total > 0) {
      report += `### Hist\xF3rico de Execu\xE7\xF5es (memory)

`;
      report += `| Framework | Total | Passed | Taxa |
`;
      report += `|-----------|-------|--------|------|
`;
      for (const [fw, data] of Object.entries(s.executions.byFramework || {})) {
        const rate = data.total > 0 ? Math.round(data.passed / data.total * 100) : 0;
        report += `| ${fw} | ${data.total} | ${data.passed} | ${rate}% |
`;
      }
      report += `
`;
    }
    if (s.learnings?.total > 0) {
      report += `### Aprendizados (.qa-lab-memory.json)

`;
      report += `| Tipo | Total | Sucesso | Taxa |
`;
      report += `|------|-------|---------|------|
`;
      for (const [t, data] of Object.entries(s.learnings.byType || {})) {
        const rate = data.total > 0 ? Math.round(data.success / data.total * 100) : 0;
        report += `| ${t} | ${data.total} | ${data.success} | ${rate}% |
`;
      }
      report += `
`;
    }
    if (r.recentEvents?.length > 0) {
      report += `### \xDAltimos 20 eventos

`;
      report += `| Data | Tipo | Framework | Spec | Passed | Failed | Exit | Dura\xE7\xE3o(s) |
`;
      report += `|------|------|-----------|------|--------|--------|------|------------|
`;
      for (const e of r.recentEvents.slice(-10)) {
        const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : "\u2014";
        report += `| ${ts} | ${e.type || "\u2014"} | ${e.framework || "\u2014"} | ${(e.spec || "\u2014").slice(0, 20)} | ${e.passed ?? "\u2014"} | ${e.failed ?? "\u2014"} | ${e.exitCode ?? "\u2014"} | ${e.durationSeconds ?? "\u2014"} |
`;
      }
      report += `
`;
    }
    if (s.lastUpdated) {
      report += `*\xDAltima atualiza\xE7\xE3o: ${s.lastUpdated}*

`;
    }
    report += `---

`;
  }
  if (outputFile) {
    fs5.writeFileSync(outputFile, report, "utf8");
    console.log(`
\u{1F4C4} Relat\xF3rio salvo em: ${outputFile}
`);
  } else {
    console.log(report);
  }
}
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
    console.error("\u274C Nenhum framework de teste detectado.");
    process.exit(1);
  }
  const fw = structure.testFrameworks[0];
  const { cmd, args, cwd } = getRunCommand(structure, fw, spec);
  console.log(`
\u{1F52C} Relat\xF3rio de testes flaky
`);
  console.log(`Framework: ${fw}`);
  console.log(`Execu\xE7\xF5es: ${runs}`);
  if (spec) console.log(`Spec: ${spec}`);
  console.log(`
Rodando testes ${runs}x...
`);
  const results = [];
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  [${i + 1}/${runs}] `);
    const result = await runTestsOnce(cmd, args, cwd);
    results.push(result);
    process.stdout.write(result.passed ? "\u2705 passou\n" : "\u274C falhou\n");
  }
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const isFlaky = passed > 0 && failed > 0;
  const failureOutput = results.find((r) => !r.passed)?.output || "";
  const flakyAnalysis = failureOutput ? detectFlakyPatterns(failureOutput) : null;
  const probableCause = flakyAnalysis?.isLikelyFlaky ? flakyAnalysis.patterns.map((p) => `${p.pattern}: ${p.suggestion}`).join("; ") : "N\xE3o foi poss\xEDvel inferir (rode com explainOnFailure para an\xE1lise detalhada)";
  let report = `# Relat\xF3rio de testes flaky \u2014 mcp-lab-agent

`;
  report += `Gerado em: ${(/* @__PURE__ */ new Date()).toISOString()}
`;
  report += `Framework: ${fw}
`;
  report += `Execu\xE7\xF5es: ${runs}
`;
  if (spec) report += `Spec: ${spec}
`;
  report += `
---

`;
  report += `## Resultado

`;
  report += `| M\xE9trica | Valor |
`;
  report += `|---------|-------|
`;
  report += `| Passou | ${passed}/${runs} |
`;
  report += `| Falhou | ${failed}/${runs} |
`;
  report += `| Taxa de falha | ${Math.round(failed / runs * 100)}% |
`;
  report += `| **Flaky?** | ${isFlaky ? "\u26A0\uFE0F SIM" : failed === runs ? "\u274C Falha consistente" : "\u2705 Est\xE1vel"} |

`;
  if (isFlaky) {
    report += `## Causa prov\xE1vel

`;
    report += `${probableCause}

`;
    if (flakyAnalysis?.patterns?.length) {
      report += `### Sugest\xF5es

`;
      flakyAnalysis.patterns.forEach((p) => {
        report += `- **${p.pattern}:** ${p.suggestion}
`;
      });
      report += `
`;
    }
  }
  if (failed > 0 && failureOutput) {
    report += `## \xDAltima sa\xEDda de falha (trecho)

`;
    report += "```\n";
    report += failureOutput.slice(0, 1500).trim();
    if (failureOutput.length > 1500) report += "\n...";
    report += "\n```\n\n";
  }
  report += `---

`;
  report += `*Use \`mcp-lab-agent por_que_falhou\` (via MCP) ou \`run_tests\` com \`explainOnFailure: true\` para an\xE1lise detalhada.*
`;
  if (outputFile) {
    fs5.writeFileSync(outputFile, report, "utf8");
    console.log(`
\u{1F4C4} Relat\xF3rio salvo em: ${outputFile}
`);
  } else {
    console.log("\n" + report);
  }
  process.exit(isFlaky ? 1 : 0);
}
function getRunCommand(structure, fw, spec) {
  const cwdMap = {
    cypress: structure.testDirs.includes("cypress") ? path5.join(PROJECT_ROOT5, "cypress") : structure.testDirs[0] ? path5.join(PROJECT_ROOT5, structure.testDirs[0]) : PROJECT_ROOT5,
    playwright: structure.testDirs.includes("playwright") ? path5.join(PROJECT_ROOT5, "playwright") : structure.testDirs[0] ? path5.join(PROJECT_ROOT5, structure.testDirs[0]) : PROJECT_ROOT5
  };
  const cwd = cwdMap[fw] || getFrameworkCwd(structure, ["specs", "tests", "e2e"]) || PROJECT_ROOT5;
  if (fw === "cypress") {
    return { cmd: "npx", args: spec ? ["cypress", "run", "--spec", spec] : ["cypress", "run"], cwd };
  }
  if (fw === "playwright") {
    return { cmd: "npx", args: spec ? ["playwright", "test", spec] : ["playwright", "test"], cwd };
  }
  if (fw === "webdriverio" || fw === "appium") {
    return { cmd: "npx", args: spec ? ["wdio", "run", spec] : ["wdio", "run"], cwd: PROJECT_ROOT5 };
  }
  if (fw === "jest") {
    return { cmd: "npx", args: spec ? ["jest", spec] : ["jest"], cwd: PROJECT_ROOT5 };
  }
  if (fw === "vitest") {
    return { cmd: "npx", args: ["vitest", "run", ...spec ? [spec] : []], cwd: PROJECT_ROOT5 };
  }
  if (fw === "mocha") {
    return { cmd: "npx", args: spec ? ["mocha", spec] : ["mocha"], cwd: PROJECT_ROOT5 };
  }
  if (fw === "pytest") {
    return { cmd: "pytest", args: spec ? [spec] : [], cwd: PROJECT_ROOT5 };
  }
  if (fw === "robot") {
    return { cmd: "robot", args: spec ? [spec] : [structure.testDirs[0] || "tests"], cwd: PROJECT_ROOT5 };
  }
  return { cmd: "npm", args: ["test"], cwd: PROJECT_ROOT5 };
}
async function handleRunCommand() {
  const argv = process.argv.slice(2);
  const deviceIdx = argv.indexOf("--device");
  const device = deviceIdx !== -1 && argv[deviceIdx + 1] ? argv[deviceIdx + 1] : null;
  const noAutoFix = argv.includes("--no-auto-fix");
  const spec = argv.filter((a) => !a.startsWith("--") && a !== "run")[0] || null;
  const structure = detectProjectStructure();
  if (!structure.hasTests) {
    console.error("\u274C Nenhum framework de teste detectado.");
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
  console.log(`
\u25B6\uFE0F Rodando testes${spec ? `: ${spec}` : ""}
`);
  if (useDevice) console.log(`   Device: ${useDevice}
`);
  let result = await runTestsOnce(cmd, args, cwd, runEnv);
  let autoFixed = false;
  if (!result.passed && doAutoFix && isSelectorFailure(result.runOutput) && resolveLLMProvider("complex").apiKey) {
    console.log("\n\u26A0\uFE0F Falha por seletor. Aplicando corre\xE7\xE3o autom\xE1tica...\n");
    const fixResult = await applySelectorFixAndRetry(spec, result.runOutput, fw);
    if (fixResult.applied) {
      autoFixed = true;
      result = await runTestsOnce(cmd, args, cwd, runEnv);
    }
  }
  if (result.passed) {
    console.log(`
\u2705 Testes passaram${autoFixed ? " (ap\xF3s corre\xE7\xE3o de seletor)" : ""}.
`);
  } else {
    console.log(`
\u274C Testes falharam.
`);
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
      env: { ...process.env, ...env }
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
      const output = [stdout, stderr].filter(Boolean).join("\n");
      resolve({ passed: code === 0, code: code ?? 1, output });
    });
  });
}
async function handleAutoCommand() {
  const request = process.argv.slice(3).join(" ");
  if (!request) {
    console.error("\u274C Uso: mcp-lab-agent auto <descri\xE7\xE3o do teste> [--max-retries N]");
    process.exit(1);
  }
  const maxRetriesIdx = process.argv.indexOf("--max-retries");
  const maxRetries = maxRetriesIdx !== -1 && process.argv[maxRetriesIdx + 1] ? parseInt(process.argv[maxRetriesIdx + 1], 10) : 3;
  const cleanRequest = request.replace(/--max-retries\s+\d+/g, "").trim();
  console.log(`
\u{1F916} Modo aut\xF4nomo iniciado: "${cleanRequest}"
`);
  const structure = detectProjectStructure();
  const fw = structure.testFrameworks[0];
  if (!fw) {
    console.error("\u274C Nenhum framework detectado.");
    process.exit(1);
  }
  const llm = resolveLLMProvider("simple");
  if (!llm.apiKey) {
    console.error("\u274C Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env");
    process.exit(1);
  }
  const memory = loadProjectMemory();
  const contextLines = [
    `Frameworks: ${structure.testFrameworks.join(", ")}`,
    `Pastas: ${structure.testDirs.join(", ")}`,
    memory.flows?.length ? `Fluxos: ${memory.flows.map((f) => f.name || f.id).join(", ")}` : ""
  ].filter(Boolean).join("\n");
  let testFilePath = null;
  let testContent = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`
[Tentativa ${attempt}/${maxRetries}] Gerando teste...`);
    const { provider, apiKey, baseUrl, model } = llm;
    const memoryHints = memory.learnings?.filter((l) => l.success).slice(-10).map((l) => l.fix).join("\n") || "";
    const systemPrompt = `Voc\xEA \xE9 um engenheiro de QA especializado em ${fw}. Gere APENAS o c\xF3digo do spec, sem explica\xE7\xF5es.
${memoryHints ? `
Aprendizados anteriores (use como refer\xEAncia):
${memoryHints.slice(0, 1e3)}` : ""}
Retorne SOMENTE o c\xF3digo, sem markdown.`;
    const userPrompt = `Contexto:
${contextLines}

Gere teste para: ${cleanRequest}
Framework: ${fw}`;
    try {
      let specContent = "";
      if (provider === "gemini") {
        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
          })
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
            max_tokens: 4096
          })
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
        testFilePath = path5.join(baseDir, safeName);
        if (!fs5.existsSync(baseDir)) fs5.mkdirSync(baseDir, { recursive: true });
      }
      fs5.writeFileSync(testFilePath, testContent, "utf8");
      console.log(`\u2705 Teste gravado: ${testFilePath}`);
      console.log(`
[Tentativa ${attempt}/${maxRetries}] Executando teste...`);
      const runArg = fw === "playwright" ? path5.relative(PROJECT_ROOT5, testFilePath).replace(/\\/g, "/") : testFilePath;
      const runResult = await new Promise((resolve) => {
        const child = spawn("npx", [fw === "cypress" ? "cypress" : fw === "playwright" ? "playwright" : fw, fw === "cypress" ? "run" : fw === "playwright" ? "test" : "run", runArg], {
          cwd: PROJECT_ROOT5,
          stdio: ["inherit", "pipe", "pipe"],
          shell: process.platform === "win32"
        });
        let stdout = "", stderr = "";
        if (child.stdout) child.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        if (child.stderr) child.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        child.on("close", (code) => resolve({ code, output: [stdout, stderr].filter(Boolean).join("\n") }));
      });
      if (runResult.code === 0) {
        console.log(`
\u2705 Teste passou na tentativa ${attempt}!`);
        saveProjectMemory({
          learnings: [{ type: "test_generated", request: cleanRequest, framework: fw, success: true, passedFirstTime: attempt === 1, attempts: attempt, timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
        });
        console.log(`
\u{1F4CA} Aprendizado salvo. Use "mcp-lab-agent stats" para ver m\xE9tricas.
`);
        process.exit(0);
      }
      console.log(`
\u274C Teste falhou (exit ${runResult.code})`);
      console.log(`
Sa\xEDda:
${runResult.output.slice(0, 800)}
`);
      if (attempt >= maxRetries) {
        console.log(`
\u274C Limite de tentativas atingido (${maxRetries}).
`);
        saveProjectMemory({
          learnings: [{ type: "test_generated", request: cleanRequest, framework: fw, success: false, attempts: attempt, timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
        });
        process.exit(1);
      }
      console.log(`
[Tentativa ${attempt}/${maxRetries}] Analisando falha...`);
      const flakyAnalysis = detectFlakyPatterns(runResult.output);
      if (flakyAnalysis.isLikelyFlaky) {
        console.log(`\u26A0\uFE0F Flaky detectado (${flakyAnalysis.confidence.toFixed(2)}): ${flakyAnalysis.patterns.map((p) => p.pattern).join(", ")}`);
      }
      console.log(`
[Tentativa ${attempt}/${maxRetries}] Aplicando corre\xE7\xE3o (simulada)...`);
      console.log(`\u26A0\uFE0F Corre\xE7\xE3o autom\xE1tica ainda n\xE3o implementada nesta vers\xE3o CLI. Tentando novamente...`);
    } catch (err) {
      console.error(`
\u274C Erro na tentativa ${attempt}: ${err.message}
`);
      process.exit(1);
    }
  }
  console.log(`
\u274C Falhou ap\xF3s ${maxRetries} tentativa(s).
`);
  process.exit(1);
}
async function handleAnalyzeCommand() {
  console.log("\n\u{1F916} An\xE1lise completa iniciada...\n");
  const structure = detectProjectStructure();
  console.log("[1/4] \u{1F50D} Detectando estrutura...");
  console.log(`\u2705 ${structure.testFrameworks.join(", ")} detectado(s)
`);
  const testFiles = structure.testDirs.flatMap((dir) => {
    const fullPath = path5.join(PROJECT_ROOT5, dir);
    if (!fs5.existsSync(fullPath)) return [];
    return fs5.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
  });
  console.log(`\u2705 ${testFiles.length} teste(s) encontrado(s)
`);
  console.log("[2/4] \u{1F9E0} Analisando estabilidade...");
  const stabilityAnalysis = analyzeTestStability();
  const unstableTests = stabilityAnalysis.tests.filter((t) => t.failureRate > 20);
  if (unstableTests.length > 0) {
    console.log(`\u26A0\uFE0F ${unstableTests.length} teste(s) inst\xE1vel(is):`);
    unstableTests.slice(0, 3).forEach((t) => {
      console.log(`   - ${t.file}: ${t.failureRate}% de falha (${t.failed}/${t.total} execu\xE7\xF5es)`);
    });
  } else {
    console.log("\u2705 Todos os testes s\xE3o est\xE1veis");
  }
  console.log();
  console.log("[3/4] \u{1F52E} Analisando riscos por \xE1rea...");
  const codeRisks = analyzeCodeRisks();
  const highRisks = codeRisks.filter((r) => r.risk === "high");
  if (highRisks.length > 0) {
    console.log(`\u{1F534} ${highRisks.length} \xE1rea(s) de RISCO ALTO:`);
    highRisks.slice(0, 3).forEach((r) => {
      console.log(`   - ${r.area}/: ${r.files} arquivo(s) sem testes`);
    });
  } else {
    console.log("\u2705 Todas as \xE1reas principais t\xEAm cobertura");
  }
  console.log();
  console.log("[4/4] \u{1F4A1} Gerando recomenda\xE7\xF5es...\n");
  const actions = [];
  unstableTests.forEach((t) => {
    actions.push({ priority: "\u{1F534} URGENTE", action: `Refatore ${t.file} (falha ${t.failureRate}%)`, command: `mcp-lab-agent auto "corrigir ${t.file}"` });
  });
  highRisks.forEach((r) => {
    actions.push({ priority: "\u{1F534} URGENTE", action: `Adicione testes para ${r.area}/`, command: `mcp-lab-agent auto "testes para ${r.area}"` });
  });
  let score = 100;
  score -= unstableTests.length * 10;
  score -= highRisks.length * 15;
  score = Math.max(0, score);
  const emoji = score >= 80 ? "\u{1F680}" : score >= 60 ? "\u2705" : "\u26A0\uFE0F";
  console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
  console.log(`${emoji} RELAT\xD3RIO COMPLETO
`);
  console.log(`Nota: ${score}/100
`);
  console.log("A\xC7\xD5ES RECOMENDADAS:\n");
  actions.slice(0, 5).forEach((a, i) => {
    console.log(`${i + 1}. ${a.priority}: ${a.action}`);
    console.log(`   \u2192 ${a.command}
`);
  });
  if (actions.length === 0) {
    console.log("\u2705 Projeto em excelente estado!\n");
  }
  console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
}

// src/index.js
var PROJECT_ROOT6 = process.cwd();
config({ path: path6.join(PROJECT_ROOT6, ".env") });
var server = new McpServer({
  name: "mcp-lab-agent",
  version: "2.1.9"
});
var METRICS_FILE2 = path6.join(PROJECT_ROOT6, ".qa-lab-metrics.json");
function appendMetricsEvent(event) {
  recordMetricEvent(event);
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
    const fullPath = path6.join(PROJECT_ROOT6, normalized);
    if (!fullPath.startsWith(PROJECT_ROOT6)) {
      return {
        content: [{ type: "text", text: "Caminho fora do projeto." }],
        structuredContent: { ok: false, error: "Path outside project" }
      };
    }
    if (!fs6.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Arquivo n\xE3o encontrado: ${normalized}` }],
        structuredContent: { ok: false, error: "File not found" }
      };
    }
    const stat = fs6.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        content: [{ type: "text", text: "\xC9 um diret\xF3rio. Use um caminho de arquivo." }],
        structuredContent: { ok: false, error: "Is directory" }
      };
    }
    try {
      const content = fs6.readFileSync(fullPath, encoding);
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
    description: "Analisa o projeto e identifica frameworks de teste, pastas, backend, frontend, ambiente (web/mobile) e hints para gera\xE7\xE3o de testes.",
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
        environmentHints: z.array(z.string()).optional()
      })
    })
  },
  async () => {
    const structure = detectProjectStructure();
    const envLine = structure.environment ? `Ambiente: ${structure.environment}${structure.environmentHints?.length ? ` (${structure.environmentHints.join(", ")})` : ""}` : "";
    const summary = [
      `Frameworks de teste: ${structure.testFrameworks.join(", ") || "nenhum"}`,
      `Pastas de teste: ${structure.testDirs.join(", ") || "nenhuma"}`,
      `Backend: ${structure.backendDir || "n\xE3o detectado"}`,
      `Frontend: ${structure.frontendDir || "n\xE3o detectado"}`,
      ...envLine ? [envLine] : []
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
    const outPath = screenshotPath ? path6.join(PROJECT_ROOT6, screenshotPath.replace(/^\//, "")) : path6.join(PROJECT_ROOT6, ".qa-lab-screenshot.png");
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
      const relPath = path6.relative(PROJECT_ROOT6, outPath);
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
var QA_AGENTS2 = {
  autonomous: { tools: ["qa_auto"], desc: "Modo aut\xF4nomo: gera, roda, corrige e aprende (loop completo)" },
  intelligence: { tools: ["qa_full_analysis", "qa_health_check", "qa_suggest_next_test", "qa_predict_flaky", "qa_compare_with_industry"], desc: "Executor + Consultor: an\xE1lise completa, diagn\xF3stico, sugest\xF5es e predi\xE7\xF5es" },
  detection: { tools: ["detect_project", "read_project", "list_test_files"], desc: "Detec\xE7\xE3o de estrutura, frameworks e arquivos" },
  execution: { tools: ["run_tests", "watch_tests", "get_test_coverage"], desc: "Execu\xE7\xE3o de testes e cobertura" },
  generation: { tools: ["generate_tests", "write_test", "create_test_template", "map_mobile_elements"], desc: "Gera\xE7\xE3o de testes com LLM" },
  analysis: { tools: ["analyze_failures", "por_que_falhou", "suggest_fix", "suggest_selector_fix"], desc: "An\xE1lise de falhas e sugest\xF5es" },
  browser: { tools: ["web_eval_browser"], desc: "Avalia\xE7\xE3o em browser real (screenshots, network, console)" },
  reporting: { tools: ["create_bug_report", "get_business_metrics"], desc: "Relat\xF3rios e m\xE9tricas" },
  learning: { tools: ["qa_learning_stats", "get_learning_report", "qa_time_travel"], desc: "Estat\xEDsticas de aprendizado e evolu\xE7\xE3o" },
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
    if (/autônomo|auto|completo|loop|aprende|corrige automaticamente/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: autonomous \u2192 qa_auto (loop completo: gera, roda, corrige, aprende)" }], structuredContent: { ok: true, suggestedAgent: "autonomous", suggestedTools: QA_AGENTS2.autonomous.tools, description: QA_AGENTS2.autonomous.desc } };
    }
    if (/health|saúde|diagnóstico|nota|score|próximo teste|sugerir|prever|flaky|benchmark|comparar|indústria/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: intelligence \u2192 qa_health_check, qa_suggest_next_test, qa_predict_flaky, qa_compare_with_industry" }], structuredContent: { ok: true, suggestedAgent: "intelligence", suggestedTools: QA_AGENTS2.intelligence.tools, description: QA_AGENTS2.intelligence.desc } };
    }
    if (/estatística|métrica de aprendizado|taxa de sucesso|learning|stats|evolução|timeline|tempo|histórico/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: learning \u2192 qa_learning_stats, qa_time_travel" }], structuredContent: { ok: true, suggestedAgent: "learning", suggestedTools: QA_AGENTS2.learning.tools, description: QA_AGENTS2.learning.desc } };
    }
    if (/rodar|executar|run|test|coverage|watch/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: execution \u2192 run_tests, get_test_coverage" }], structuredContent: { ok: true, suggestedAgent: "execution", suggestedTools: QA_AGENTS2.execution.tools, description: QA_AGENTS2.execution.desc } };
    }
    if (/mapear|elementos mobile|deep link|deeplink|app package|bundle.?id|appium inspector/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation \u2192 map_mobile_elements (mapear elementos), depois generate_tests + write_test" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: ["map_mobile_elements", "generate_tests", "write_test"], description: QA_AGENTS2.generation.desc } };
    }
    if (/mapear|elementos mobile|deep link|deeplink|app package|bundle.?id/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation \u2192 map_mobile_elements (mapear elementos), depois generate_tests + write_test" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: ["map_mobile_elements", "generate_tests", "write_test"], description: "Mapeamento de elementos mobile + gera\xE7\xE3o de testes" } };
    }
    if (/mobile|deeplink|deep link|elementos|mapear.*app|appium|detox/i.test(t) && !/rodar|run|executar/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation \u2192 map_mobile_elements, generate_tests, write_test (mobile)" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: QA_AGENTS2.generation.tools, description: QA_AGENTS2.generation.desc } };
    }
    if (/gerar|criar|escrever|generate|write|template/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: generation \u2192 generate_tests, write_test, map_mobile_elements" }], structuredContent: { ok: true, suggestedAgent: "generation", suggestedTools: QA_AGENTS2.generation.tools, description: QA_AGENTS2.generation.desc } };
    }
    if (/analisar|por que|falhou|suggest|correção|selector|fix/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: analysis \u2192 analyze_failures, por_que_falhou, suggest_fix" }], structuredContent: { ok: true, suggestedAgent: "analysis", suggestedTools: QA_AGENTS2.analysis.tools, description: QA_AGENTS2.analysis.desc } };
    }
    if (/browser|screenshot|navegador|avaliar|ux|network|console/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: browser \u2192 web_eval_browser" }], structuredContent: { ok: true, suggestedAgent: "browser", suggestedTools: QA_AGENTS2.browser.tools, description: QA_AGENTS2.browser.desc } };
    }
    if (/detectar|estrutura|listar|arquivos|framework/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: detection \u2192 detect_project, list_test_files" }], structuredContent: { ok: true, suggestedAgent: "detection", suggestedTools: QA_AGENTS2.detection.tools, description: QA_AGENTS2.detection.desc } };
    }
    if (/relatório|bug|métricas|metrics/i.test(t)) {
      return { content: [{ type: "text", text: "Agente: reporting \u2192 create_bug_report, get_business_metrics" }], structuredContent: { ok: true, suggestedAgent: "reporting", suggestedTools: QA_AGENTS2.reporting.tools, description: QA_AGENTS2.reporting.desc } };
    }
    return { content: [{ type: "text", text: "Agente: detection (gen\xE9rico)" }], structuredContent: { ok: true, suggestedAgent: "detection", suggestedTools: QA_AGENTS2.detection.tools, description: QA_AGENTS2.detection.desc } };
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
      device: z.string().optional().describe("Device/configuration para mobile. Se vazio, detecta de qa-lab-agent.config.json, wdio.conf ou .detoxrc."),
      explainOnFailure: z.boolean().optional().describe("Se true, quando falhar gera automaticamente: O que aconteceu, Por que falhou, O que fazer, Sugest\xE3o de corre\xE7\xE3o. Requer API key."),
      autoFixSelector: z.boolean().optional().describe("Se true e falhar por seletor, aplica corre\xE7\xE3o automaticamente e tenta novamente. Requer spec e API key. Default: true para mobile.")
    }),
    outputSchema: z.object({
      status: z.enum(["passed", "failed", "not_found"]),
      message: z.string(),
      exitCode: z.number(),
      runOutput: z.string().optional()
    })
  },
  async ({ framework, spec, suite, explainOnFailure, device, autoFixSelector }) => {
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
    if (selectedFramework === "cypress") {
      cmd = "npx";
      args = spec ? ["cypress", "run", "--spec", spec] : ["cypress", "run"];
      cwd = structure.testDirs.includes("cypress") ? path6.join(PROJECT_ROOT6, "cypress") : structure.testDirs[0] ? path6.join(PROJECT_ROOT6, structure.testDirs[0]) : PROJECT_ROOT6;
    } else if (selectedFramework === "playwright") {
      cmd = "npx";
      args = spec ? ["playwright", "test", spec] : ["playwright", "test"];
      cwd = structure.testDirs.includes("playwright") ? path6.join(PROJECT_ROOT6, "playwright") : structure.testDirs[0] ? path6.join(PROJECT_ROOT6, structure.testDirs[0]) : PROJECT_ROOT6;
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
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "vitest") {
      cmd = "npx";
      args = ["vitest", "run"];
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "mocha") {
      cmd = "npx";
      args = spec ? ["mocha", spec] : ["mocha"];
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "appium") {
      cmd = "npx";
      args = spec ? ["wdio", "run", spec] : ["wdio", "run"];
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "detox") {
      cmd = "npx";
      args = ["detox", "test"];
      if (useDevice) args.push("--configuration", useDevice);
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "robot") {
      cmd = "robot";
      args = spec ? [spec] : [structure.testDirs[0] || "tests"];
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "pytest") {
      cmd = "pytest";
      args = spec ? [spec] : [];
      cwd = PROJECT_ROOT6;
    } else if (selectedFramework === "supertest" || selectedFramework === "pactum") {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT6;
    } else {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT6;
    }
    const runTestsOnce2 = () => new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn2(cmd, args, {
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
        shell: process.platform === "win32",
        env: runEnv
      });
      let stdout = "";
      let stderr = "";
      if (child.stdout) child.stdout.on("data", (d) => {
        stdout += d.toString();
        process.stdout.write(d);
      });
      if (child.stderr) child.stderr.on("data", (d) => {
        stderr += d.toString();
        process.stderr.write(d);
      });
      child.on("close", (code) => {
        const runOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
        resolve({
          passed: code === 0,
          exitCode: code ?? 1,
          runOutput,
          durationSeconds: Math.round((Date.now() - startTime) / 1e3)
        });
      });
    });
    const isSelectorFailure = (out) => /element not found|selector|timeout|locator|cy\.get|page\.locator|Unable to find/i.test(out || "");
    let result = await runTestsOnce2();
    let autoFixed = false;
    if (!result.passed && doAutoFixSelector && spec && isSelectorFailure(result.runOutput) && resolveLLMProvider("complex").apiKey) {
      const fixResult = await applySelectorFixAndRetry(spec, result.runOutput, selectedFramework);
      if (fixResult.applied) {
        autoFixed = true;
        result = await runTestsOnce2();
      }
    }
    if (!result.passed && result.runOutput) {
      try {
        fs6.writeFileSync(path6.join(PROJECT_ROOT6, ".qa-lab-last-failure.log"), result.runOutput, "utf8");
      } catch {
      }
    }
    const { passed: p, failed: f } = parseTestRunResult(result.runOutput, result.exitCode);
    appendMetricsEvent({
      type: "test_run",
      framework: selectedFramework,
      spec: spec || void 0,
      passed: p,
      failed: f,
      durationSeconds: result.durationSeconds,
      exitCode: result.exitCode,
      failures: !result.passed ? extractFailuresFromOutput(result.runOutput) : void 0
    });
    if (result.passed) saveProjectMemory({ lastRun: { spec: spec || null, framework: selectedFramework, passed: p } });
    saveProjectMemory({
      execution: {
        testFile: spec || "all",
        passed: result.passed,
        duration: result.durationSeconds,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        framework: selectedFramework
      }
    });
    const baseMsg = result.passed ? autoFixed ? "Testes executados com sucesso (ap\xF3s corre\xE7\xE3o autom\xE1tica de seletor)." : "Testes executados com sucesso." : "Falha na execu\xE7\xE3o dos testes.";
    const structured = {
      status: result.passed ? "passed" : "failed",
      message: result.passed ? "Tests passed" : "Tests failed",
      exitCode: result.exitCode,
      runOutput: !result.passed ? result.runOutput : void 0,
      autoFixed: autoFixed || void 0
    };
    if (!result.passed && explainOnFailure && result.runOutput) {
      const explainResult = await generateFailureExplanation(result.runOutput, spec || void 0);
      if (explainResult.ok && explainResult.structuredContent) {
        const oneLine = explainResult.structuredContent.resumoEmUmaFrase || oneLineFailureSummary(result.runOutput, selectedFramework, explainResult.structuredContent.oQueAconteceu, explainResult.structuredContent.sugestaoCorrecao);
        structured.explanation = explainResult.structuredContent.formattedText;
        structured.resumoEmUmaFrase = oneLine;
        return {
          content: [{ type: "text", text: `${baseMsg}

**${oneLine}**

---

${explainResult.structuredContent.formattedText}` }],
          structuredContent: structured
        };
      }
    }
    return {
      content: [{ type: "text", text: baseMsg }],
      structuredContent: structured
    };
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
        const full = path6.join(PROJECT_ROOT6, p.replace(/^\//, "").replace(/\\/g, "/"));
        if (fs6.existsSync(full)) {
          try {
            const content = fs6.readFileSync(full, "utf8");
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
- Retorne SOMENTE o c\xF3digo, sem markdown

${UNIVERSAL_TEST_PRACTICES}
${fw === "appium" || fw === "detox" ? `
IMPORTANTE: ${MOBILE_MAPPING_LESSON}

HIERARQUIA DE SELETORES: ${MOBILE_SELECTOR_HIERARCHY}` : ""}` : `Voc\xEA \xE9 um engenheiro de QA especializado em ${fw}. Gere APENAS o c\xF3digo do spec, sem explica\xE7\xF5es.
Framework: ${fw}

${UNIVERSAL_TEST_PRACTICES}

Regras:
- Cypress: cy.request(), cy.visit(), cy.get()
- Playwright: test(), test.describe(), page.goto(), page.locator()
- WebdriverIO/Appium: describe(), it(), $(), browser.$
- Jest/Vitest: describe(), test(), expect()
- Robot: Keywords, [Tags], Steps
- pytest: def test_*, assert, fixtures
- C\xF3digo limpo. Retorne SOMENTE o c\xF3digo, sem markdown${fw === "appium" || fw === "detox" ? `

IMPORTANTE (Appium/Detox): ${MOBILE_MAPPING_LESSON}

HIERARQUIA: ${MOBILE_SELECTOR_HIERARCHY}` : ""}`;
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
      if (!specContent) {
        return {
          content: [{ type: "text", text: "Erro: LLM retornou conte\xFAdo vazio. Verifique API key (GROQ_API_KEY, GEMINI_API_KEY) e tente novamente." }],
          structuredContent: { ok: false, error: "Empty LLM response" }
        };
      }
      const textWithCode = `Spec gerado (${specContent.length} chars). Use write_test para gravar com name="${fileName}" e content abaixo:

--- C\xF3digo (passe em content para write_test) ---
${specContent}`;
      return {
        content: [{ type: "text", text: textWithCode }],
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
function getExtensionAndBaseDir2(fw, structure) {
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
  const baseDir = path6.join(PROJECT_ROOT6, baseMap[fw] || structure.testDirs[0] || "tests");
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
    if (!content || !String(content).trim()) {
      return {
        content: [{ type: "text", text: "Erro: content n\xE3o pode ser vazio. Chame generate_tests primeiro e passe o specContent retornado em content." }],
        structuredContent: { ok: false, error: "Empty content" }
      };
    }
    const { ext, baseDir } = getExtensionAndBaseDir2(fw, structure);
    const safeName = name.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/_+/g, "_").replace(/\.(cy|spec|test|robot|feature|py)\.?(js|ts|py)?$/i, "").replace(/^[-_]+|[-_]+$/g, "");
    const fileName = ext.startsWith("_") ? `${safeName}${ext}` : `${safeName}${ext}`;
    const targetDir = subdir ? path6.join(baseDir, subdir) : baseDir;
    const filePath = path6.join(targetDir, fileName);
    try {
      if (!fs6.existsSync(targetDir)) {
        fs6.mkdirSync(targetDir, { recursive: true });
      }
      fs6.writeFileSync(filePath, content, "utf8");
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
    ...Array.isArray(data.porQueProvavelmenteFalhou) ? data.porQueProvavelmenteFalhou.map((s) => `\u2022 ${s}`) : [data.porQueProvavelmenteFalhou || ""],
    "",
    "## O que fazer agora",
    "",
    ...Array.isArray(data.oQueFazerAgora) ? data.oQueFazerAgora.map((s, i) => `${i + 1}. ${s}`) : [data.oQueFazerAgora || ""]
  );
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
async function generateFailureExplanation(resolvedOutput, testFilePath = null) {
  const structure = detectProjectStructure();
  const fw = structure.testFrameworks[0] || "unknown";
  let testCode = "";
  if (testFilePath) {
    const normalized = testFilePath.replace(/^\//, "").replace(/\\/g, "/");
    const fullPath = path6.join(PROJECT_ROOT6, normalized);
    if (fs6.existsSync(fullPath) && !fs6.statSync(fullPath).isDirectory()) {
      try {
        testCode = fs6.readFileSync(fullPath, "utf8");
      } catch {
      }
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
    pytest: "pytest"
  };
  const systemPrompt = `Voc\xEA \xE9 um mentor de QA. Analise o output de falha e responda em JSON (apenas o JSON, sem markdown) com as chaves:
- resumoEmUmaFrase: string (OBRIGAT\xD3RIO - uma frase: "Falhou porque X. Solu\xE7\xE3o: Y.")
- oQueAconteceu: string (explica\xE7\xE3o em portugu\xEAs do que aconteceu, simples)
- porQueProvavelmenteFalhou: array de strings (lista de poss\xEDveis causas)
- oQueFazerAgora: array de strings (passos numerados do que fazer)
- sugestaoCorrecao: string ou null (c\xF3digo de corre\xE7\xE3o no formato do framework)
- conceito: string ou null
- framework: string (framework do projeto)

Framework: ${fw}. ${fwHints[fw] || ""}
Responda APENAS com o JSON v\xE1lido, sem texto antes ou depois.`;
  const userPrompt = `Output do terminal/log (teste falhou):
---
${resolvedOutput.slice(0, 12e3)}
---
${testCode ? `
C\xF3digo do teste:
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
      data = { oQueAconteceu: raw.slice(0, 500) || "N\xE3o foi poss\xEDvel parsear.", porQueProvavelmenteFalhou: [], oQueFazerAgora: [], sugestaoCorrecao: null, conceito: null, framework: fw };
    }
    data.framework = data.framework || fw;
    const oneLine = oneLineFailureSummary(resolvedOutput, fw, data.oQueAconteceu, data.sugestaoCorrecao);
    const formattedText = formatFailureExplanation(data, data.resumoEmUmaFrase || oneLine);
    return { ok: true, formattedText, structuredContent: { ...data, formattedText } };
  } catch (err) {
    return { ok: false, error: err.message, structuredContent: null };
  }
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
    let resolvedOutput = errorOutput?.trim() || "";
    if (!resolvedOutput) {
      const lastFailurePath = path6.join(PROJECT_ROOT6, ".qa-lab-last-failure.log");
      if (fs6.existsSync(lastFailurePath)) {
        try {
          resolvedOutput = fs6.readFileSync(lastFailurePath, "utf8");
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
    const explainResult = await generateFailureExplanation(resolvedOutput, testFilePath);
    if (!explainResult.ok) {
      if (!resolveLLMProvider("complex").apiKey) {
        return {
          content: [{
            type: "text",
            text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env do projeto para usar a explica\xE7\xE3o com LLM."
          }],
          structuredContent: { ok: false, error: "No API key configured" }
        };
      }
      return {
        content: [{ type: "text", text: `Erro ao analisar: ${explainResult.error || "erro desconhecido"}` }],
        structuredContent: { ok: false, error: explainResult.error }
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
        formattedText: sc.formattedText
      }
    };
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
      framework: z.enum(["cypress", "playwright", "webdriverio", "appium", "detox"]).optional().describe("Framework do teste. Detectado automaticamente se omitido.")
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
      const logPath = path6.join(PROJECT_ROOT6, ".qa-lab-last-failure.log");
      if (fs6.existsSync(logPath)) {
        resolvedOutput = fs6.readFileSync(logPath, "utf8");
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
    const fullPath = path6.join(PROJECT_ROOT6, testFilePath.replace(/^\//, "").replace(/\\/g, "/"));
    if (fs6.existsSync(fullPath)) {
      try {
        testCode = fs6.readFileSync(fullPath, "utf8");
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
      appium: `Appium (HIERARQUIA \xDANICA): 1) id: $('~accessibility-id') ou $('~content-desc'). 2) XPath relacional: \xE2ncora est\xE1vel + eixos + TIPO ESPEC\xCDFICO (android.widget.Button, XCUIElementTypeButton). NUNCA use * em XPath \u2014 quebra por timing e m\xFAltiplos matches. Ex: //android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']. 3) resource-id. Explique a hierarquia.`,
      detox: `Detox: testID > accessibilityLabel > text. Explique por que \xE9 mais est\xE1vel.`
    };
    const mobileRules = fw === "appium" || fw === "detox" ? "\n\nMOBILE: 1) id. 2) XPath relacional: \xE2ncora + eixos + TIPO ESPEC\xCDFICO (android.widget.Button, XCUIElementTypeButton). NUNCA use * \u2014 quebra por timing. Ex: //android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']. 3) resource-id. Explique por que o seletor \xE9 forte." : "";
    const systemPrompt = `Voc\xEA \xE9 um especialista em testes E2E. O teste falhou porque um seletor n\xE3o encontrou o elemento (UI mudou).
Analise o erro e o c\xF3digo e responda APENAS em JSON (sem markdown) com as chaves:
- selectorSugerido: string (o novo seletor recomendado, mais resiliente)
- codigoCorrigido: string (bloco de c\xF3digo completo corrigido, apenas a parte relevante do teste)
- explicacao: string (breve explica\xE7\xE3o em portugu\xEAs: por que o antigo falhou e por que o novo \xE9 melhor. Em mobile: mencione a hierarquia de estabilidade)

Priorize nesta ordem: data-testid > role + accessible name > texto vis\xEDvel > estrutura. Evite classes CSS e IDs que mudam.
${mobileRules}

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
  "map_mobile_elements",
  {
    title: "Mapear elementos mobile (estrutura para testes)",
    description: "Gera estrutura/template de elementos para testes mobile. Aceita deep link, appPackage/appActivity (Android) ou bundleId (iOS). Retorna instru\xE7\xF5es para mapear elementos (Appium Inspector, uiautomator) e template para usar em generate_tests. Se elementsJsonPath fornecido, l\xEA arquivo e formata para contexto.",
    inputSchema: z.object({
      deepLink: z.string().optional().describe("Deep link do app (ex: meuapp://login). Indica ambiente mobile."),
      appPackage: z.string().optional().describe("Android: package do app (ex: com.example.app)."),
      appActivity: z.string().optional().describe("Android: activity principal (ex: .MainActivity)."),
      bundleId: z.string().optional().describe("iOS: bundle identifier do app."),
      elementsJsonPath: z.string().optional().describe("Caminho para arquivo JSON com elementos mapeados (id, text, accessibilityId, xpath).")
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
        className: z.string().optional()
      })).optional(),
      instructions: z.string().optional(),
      contextForGenerate: z.string().optional().describe("Texto formatado para passar em generate_tests como contexto."),
      error: z.string().optional()
    })
  },
  async ({ deepLink, appPackage, appActivity, bundleId, elementsJsonPath }) => {
    const hasMobileContext = deepLink || appPackage || bundleId;
    const elements = [];
    let instructions = "";
    let contextForGenerate = "";
    if (elementsJsonPath) {
      const fullPath = path6.join(PROJECT_ROOT6, elementsJsonPath.replace(/^\//, "").replace(/\\/g, "/"));
      if (fs6.existsSync(fullPath)) {
        try {
          const raw = fs6.readFileSync(fullPath, "utf8");
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : parsed.elements || parsed.items || [];
          arr.forEach((el) => {
            elements.push({
              id: el.id || el.resourceId,
              text: el.text || el.label,
              accessibilityId: el.accessibilityId || el["content-desc"] || el.contentDesc,
              xpath: el.xpath,
              resourceId: el.resourceId || el.id,
              className: el.className || el.class
            });
          });
          contextForGenerate = `
Elementos mapeados da tela (use para seletores est\xE1veis em Appium/WDIO):
${JSON.stringify(elements, null, 2)}
`;
        } catch (err) {
          return {
            content: [{ type: "text", text: `Erro ao ler ${elementsJsonPath}: ${err.message}` }],
            structuredContent: { ok: false, error: err.message }
          };
        }
      } else {
        return {
          content: [{ type: "text", text: `Arquivo n\xE3o encontrado: ${elementsJsonPath}` }],
          structuredContent: { ok: false, error: "File not found" }
        };
      }
    }
    if (hasMobileContext || elementsJsonPath) {
      instructions = [
        "## Como mapear elementos do app mobile",
        "",
        "**Android (Appium):**",
        "- Use Appium Inspector (appium.io) com appPackage/appActivity",
        "- Ou: `adb shell uiautomator dump` \u2192 analise o XML exportado",
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
        "Salve em um arquivo e passe em `elementsJsonPath` na pr\xF3xima chamada."
      ].join("\n");
    }
    const env = deepLink ? "mobile" : appPackage || bundleId ? "mobile" : elements.length ? "mobile" : "unknown";
    const text = [
      contextForGenerate && `## Contexto para generate_tests
${contextForGenerate}`,
      instructions && `## Instru\xE7\xF5es
${instructions}`
    ].filter(Boolean).join("\n\n");
    return {
      content: [{ type: "text", text: text || (hasMobileContext ? `Ambiente: ${env}. ${instructions}` : "Informe deepLink, appPackage ou elementsJsonPath.") }],
      structuredContent: {
        ok: true,
        environment: env,
        elements: elements.length ? elements : void 0,
        instructions: instructions || void 0,
        contextForGenerate: contextForGenerate || void 0
      }
    };
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
    const fullPath = path6.join(PROJECT_ROOT6, normalized);
    if (!fullPath.startsWith(PROJECT_ROOT6)) {
      return {
        content: [{ type: "text", text: "Caminho fora do projeto." }],
        structuredContent: { ok: false, error: "Path outside project" }
      };
    }
    if (!fs6.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Arquivo n\xE3o encontrado: ${normalized}` }],
        structuredContent: { ok: false, error: "File not found" }
      };
    }
    const stat = fs6.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        content: [{ type: "text", text: "\xC9 um diret\xF3rio. Informe um arquivo." }],
        structuredContent: { ok: false, error: "Is directory" }
      };
    }
    let fileContent = "";
    try {
      fileContent = fs6.readFileSync(fullPath, "utf8");
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
    const ext = path6.extname(fullPath).toLowerCase();
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
    if (fs6.existsSync(METRICS_FILE2)) {
      try {
        data = JSON.parse(fs6.readFileSync(METRICS_FILE2, "utf8"));
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
    if (fs6.existsSync(FLOWS_CONFIG_FILE)) {
      try {
        const flowsConfig = JSON.parse(fs6.readFileSync(FLOWS_CONFIG_FILE, "utf8"));
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
      const child = spawn2(cmd, args, {
        cwd: PROJECT_ROOT6,
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
      if (fs6.existsSync(path6.join(PROJECT_ROOT6, "yarn.lock"))) pm = "yarn";
      else if (fs6.existsSync(path6.join(PROJECT_ROOT6, "pnpm-lock.yaml"))) pm = "pnpm";
      else pm = "npm";
    }
    return new Promise((resolve) => {
      const child = spawn2(pm, ["install"], {
        cwd: PROJECT_ROOT6,
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
  "qa_full_analysis",
  {
    title: "An\xE1lise completa: executor + consultor inteligente",
    description: "[EXECUTOR + CONSULTOR] An\xE1lise completa em 1 comando: detecta, executa testes, analisa estabilidade, prev\xEA problemas, calcula riscos por \xE1rea e gera recomenda\xE7\xF5es acion\xE1veis priorizadas. Combina execu\xE7\xE3o + intelig\xEAncia.",
    inputSchema: z.object({
      executeTests: z.boolean().optional().describe("Se true, executa todos os testes antes de analisar. Default: false (usa hist\xF3rico).")
    }),
    outputSchema: z.object({
      score: z.number(),
      summary: z.string(),
      stability: z.array(z.object({
        file: z.string(),
        failureRate: z.number(),
        stability: z.string()
      })),
      risks: z.array(z.object({
        area: z.string(),
        risk: z.string(),
        reason: z.string()
      })),
      actions: z.array(z.object({
        priority: z.string(),
        action: z.string(),
        command: z.string()
      }))
    })
  },
  async ({ executeTests = false }) => {
    const startTime = Date.now();
    let report = "\u{1F916} **An\xE1lise Completa Iniciada**\n\n";
    report += "[1/5] \u{1F50D} Detectando estrutura...\n";
    const structure = detectProjectStructure();
    report += `\u2705 ${structure.testFrameworks.join(", ")} detectado(s)
`;
    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path6.join(PROJECT_ROOT6, dir);
      if (!fs6.existsSync(fullPath)) return [];
      return fs6.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
    });
    report += `\u2705 ${testFiles.length} teste(s) encontrado(s)

`;
    if (executeTests) {
      report += "[2/5] \u{1F3C3} Executando todos os testes...\n";
      const fw = structure.testFrameworks[0];
      if (fw) {
        const runResult = await new Promise((resolve) => {
          const child = spawn2("npx", [fw === "cypress" ? "cypress" : fw === "playwright" ? "playwright" : fw, fw === "cypress" ? "run" : fw === "playwright" ? "test" : "run"], {
            cwd: PROJECT_ROOT6,
            stdio: ["inherit", "pipe", "pipe"],
            shell: process.platform === "win32"
          });
          let stdout = "", stderr = "";
          if (child.stdout) child.stdout.on("data", (d) => {
            stdout += d.toString();
          });
          if (child.stderr) child.stderr.on("data", (d) => {
            stderr += d.toString();
          });
          child.on("close", (code) => {
            const passed = code === 0;
            testFiles.forEach((file) => {
              saveProjectMemory({
                execution: {
                  testFile: file,
                  passed,
                  duration: Math.random() * 5 + 1,
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  framework: fw
                }
              });
            });
            resolve({ code, passed });
          });
        });
        report += runResult.passed ? "\u2705 Testes passaram\n\n" : "\u274C Alguns testes falharam\n\n";
      }
    } else {
      report += "[2/5] \u{1F4CA} Analisando hist\xF3rico de execu\xE7\xF5es...\n\n";
    }
    report += "[3/5] \u{1F9E0} Analisando estabilidade dos testes...\n";
    const stabilityAnalysis = analyzeTestStability();
    const unstableTests = stabilityAnalysis.tests.filter((t) => t.failureRate > 20);
    const flakyTests = stabilityAnalysis.tests.filter((t) => t.failureRate > 0 && t.failureRate <= 20);
    if (unstableTests.length > 0) {
      report += `\u26A0\uFE0F ${unstableTests.length} teste(s) inst\xE1vel(is) detectado(s)
`;
      unstableTests.slice(0, 3).forEach((t) => {
        report += `   - ${t.file}: ${t.failureRate}% de falha (${t.failed}/${t.total} execu\xE7\xF5es)
`;
      });
    } else if (flakyTests.length > 0) {
      report += `\u{1F7E1} ${flakyTests.length} teste(s) ocasionalmente falha(m)
`;
    } else {
      report += `\u2705 Todos os testes s\xE3o est\xE1veis
`;
    }
    report += "\n";
    report += "[4/5] \u{1F52E} Analisando riscos por \xE1rea do c\xF3digo...\n";
    const codeRisks = analyzeCodeRisks();
    const highRisks = codeRisks.filter((r) => r.risk === "high");
    if (highRisks.length > 0) {
      report += `\u{1F534} ${highRisks.length} \xE1rea(s) de RISCO ALTO detectada(s)
`;
      highRisks.slice(0, 3).forEach((r) => {
        report += `   - ${r.area}/: ${r.files} arquivo(s) sem testes
`;
      });
    } else if (codeRisks.length > 0) {
      report += `\u{1F7E1} ${codeRisks.length} \xE1rea(s) com risco m\xE9dio/baixo
`;
    } else {
      report += `\u2705 Todas as \xE1reas principais t\xEAm cobertura
`;
    }
    report += "\n";
    report += "[5/5] \u{1F4A1} Gerando recomenda\xE7\xF5es acion\xE1veis...\n\n";
    const actions = [];
    unstableTests.forEach((t) => {
      actions.push({
        priority: "\u{1F534} URGENTE",
        action: `Refatore ${t.file} (falha ${t.failureRate}% das vezes)`,
        command: `"Corrija ${t.file} automaticamente"`
      });
    });
    highRisks.forEach((r) => {
      actions.push({
        priority: "\u{1F534} URGENTE",
        action: `Adicione testes para ${r.area}/ (${r.files} arquivos sem cobertura)`,
        command: `"Gere testes para ${r.area}"`
      });
    });
    flakyTests.forEach((t) => {
      actions.push({
        priority: "\u{1F7E1} IMPORTANTE",
        action: `Melhore ${t.file} (ocasionalmente falha)`,
        command: `"Previna flaky em ${t.file}"`
      });
    });
    const stats = getMemoryStats();
    if (stats.firstAttemptSuccessRate < 70) {
      actions.push({
        priority: "\u{1F7E1} IMPORTANTE",
        action: `Aumente taxa de sucesso (atual: ${stats.firstAttemptSuccessRate}%)`,
        command: `"Modo aut\xF4nomo: gere 5 testes para fluxos cr\xEDticos"`
      });
    }
    if (actions.length === 0) {
      actions.push({
        priority: "\u{1F7E2} MELHORIA",
        action: "Projeto em excelente estado! Continue monitorando.",
        command: `"Mostre a evolu\xE7\xE3o do agente"`
      });
    }
    let score = 100;
    score -= unstableTests.length * 10;
    score -= highRisks.length * 15;
    score -= flakyTests.length * 5;
    if (stats.firstAttemptSuccessRate < 70) score -= 10;
    score = Math.max(0, score);
    const emoji = score >= 80 ? "\u{1F680}" : score >= 60 ? "\u2705" : score >= 40 ? "\u26A0\uFE0F" : "\u{1F534}";
    const duration = ((Date.now() - startTime) / 1e3).toFixed(1);
    report += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
    report += `${emoji} **RELAT\xD3RIO COMPLETO**

`;
    report += `**Nota:** ${score}/100

`;
    report += `**A\xC7\xD5ES RECOMENDADAS:**

`;
    actions.slice(0, 5).forEach((a, i) => {
      report += `${i + 1}. ${a.priority}: ${a.action}
`;
      report += `   \u2192 Comando: ${a.command}

`;
    });
    if (actions.length > 5) {
      report += `... e mais ${actions.length - 5} recomenda\xE7\xE3o(\xF5es)

`;
    }
    report += `\u2705 An\xE1lise completa em ${duration}s
`;
    return {
      content: [{ type: "text", text: report }],
      structuredContent: {
        score,
        summary: `${emoji} ${score}/100 - ${actions.length} a\xE7\xE3o(\xF5es) recomendada(s)`,
        stability: stabilityAnalysis.tests.slice(0, 10),
        risks: codeRisks.slice(0, 10),
        actions: actions.slice(0, 10)
      }
    };
  }
);
server.registerTool(
  "qa_health_check",
  {
    title: "Health check completo do projeto",
    description: "[DIAGN\xD3STICO COMPLETO] Analisa tudo: frameworks detectados, testes existentes, cobertura, \xFAltimas falhas, aprendizados do agente, e d\xE1 uma nota de 0-100 para a sa\xFAde do QA.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      score: z.number(),
      frameworks: z.array(z.string()),
      totalTests: z.number(),
      lastRunStatus: z.string().optional(),
      learningRate: z.number(),
      recommendations: z.array(z.string())
    })
  },
  async () => {
    const structure = detectProjectStructure();
    const memory = loadProjectMemory();
    const stats = getMemoryStats();
    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path6.join(PROJECT_ROOT6, dir);
      if (!fs6.existsSync(fullPath)) return [];
      return fs6.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
    });
    let score = 0;
    const recommendations = [];
    if (structure.testFrameworks.length > 0) score += 20;
    else recommendations.push("\u274C Nenhum framework detectado. Configure testes.");
    if (testFiles.length > 0) score += 20;
    else recommendations.push("\u26A0\uFE0F Nenhum arquivo de teste encontrado.");
    if (testFiles.length > 10) score += 10;
    if (testFiles.length > 30) score += 10;
    if (memory.lastRun?.passed) score += 15;
    else if (memory.lastRun) recommendations.push("\u26A0\uFE0F \xDAltima execu\xE7\xE3o falhou. Rode os testes.");
    if (stats.testsGenerated > 0) score += 10;
    if (stats.firstAttemptSuccessRate > 50) score += 10;
    if (stats.firstAttemptSuccessRate > 80) score += 5;
    if (stats.totalLearnings > 5) score += 5;
    else recommendations.push("\u{1F4A1} Use 'qa_auto' para gerar testes e aprender.");
    if (structure.testFrameworks.length > 2) score += 5;
    if (score < 50) recommendations.push("\u{1F527} Projeto precisa de mais testes e automa\xE7\xE3o.");
    else if (score < 80) recommendations.push("\u2705 Projeto em bom estado. Continue melhorando.");
    else recommendations.push("\u{1F680} Projeto excelente! QA maduro.");
    const emoji = score >= 80 ? "\u{1F680}" : score >= 50 ? "\u2705" : "\u26A0\uFE0F";
    const summary = `${emoji} **Health Check do QA**

**Nota:** ${score}/100

**Frameworks:** ${structure.testFrameworks.join(", ") || "nenhum"}
**Testes:** ${testFiles.length} arquivo(s)
**Taxa de sucesso (1\xAA tentativa):** ${stats.firstAttemptSuccessRate}%
**Aprendizados:** ${stats.totalLearnings}
**\xDAltima execu\xE7\xE3o:** ${memory.lastRun?.passed ? "\u2705 passou" : memory.lastRun ? "\u274C falhou" : "\u2014"}

**Recomenda\xE7\xF5es:**
${recommendations.map((r) => `- ${r}`).join("\n")}`;
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        score,
        frameworks: structure.testFrameworks,
        totalTests: testFiles.length,
        lastRunStatus: memory.lastRun?.passed ? "passed" : memory.lastRun ? "failed" : "unknown",
        learningRate: stats.firstAttemptSuccessRate,
        recommendations
      }
    };
  }
);
server.registerTool(
  "qa_suggest_next_test",
  {
    title: "Sugerir pr\xF3ximo teste a criar",
    description: "[IA PROATIVA] Analisa o projeto e sugere qual teste criar a seguir (baseado em cobertura, fluxos cr\xEDticos, gaps detectados).",
    inputSchema: z.object({}),
    outputSchema: z.object({
      suggestions: z.array(z.object({
        priority: z.enum(["high", "medium", "low"]),
        testName: z.string(),
        reason: z.string(),
        framework: z.string()
      }))
    })
  },
  async () => {
    const structure = detectProjectStructure();
    const memory = loadProjectMemory();
    const suggestions = [];
    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path6.join(PROJECT_ROOT6, dir);
      if (!fs6.existsSync(fullPath)) return [];
      return fs6.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f)).map((f) => f.toLowerCase());
    });
    const criticalFlows = ["login", "logout", "checkout", "payment", "signup", "search"];
    const missingFlows = criticalFlows.filter((flow) => !testFiles.some((f) => f.includes(flow)));
    missingFlows.forEach((flow) => {
      suggestions.push({
        priority: ["login", "checkout", "payment"].includes(flow) ? "high" : "medium",
        testName: `${flow} flow`,
        reason: `Fluxo cr\xEDtico sem cobertura detectada`,
        framework: structure.testFrameworks[0] || "cypress"
      });
    });
    if (memory.flows?.length) {
      memory.flows.forEach((flow) => {
        const flowName = flow.name || flow.id;
        if (!testFiles.some((f) => f.includes(flowName.toLowerCase()))) {
          suggestions.push({
            priority: "high",
            testName: flowName,
            reason: `Fluxo de neg\xF3cio definido em qa-lab-flows.json`,
            framework: structure.testFrameworks[0] || "cypress"
          });
        }
      });
    }
    if (structure.hasBackend && !testFiles.some((f) => f.includes("api"))) {
      suggestions.push({
        priority: "medium",
        testName: "API health check",
        reason: "Backend detectado mas sem testes de API",
        framework: "jest"
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        priority: "low",
        testName: "edge cases",
        reason: "Cobertura b\xE1sica completa. Foque em casos de borda.",
        framework: structure.testFrameworks[0] || "cypress"
      });
    }
    const summary = `\u{1F4A1} **Sugest\xF5es de Pr\xF3ximos Testes**

${suggestions.slice(0, 5).map((s, i) => `${i + 1}. **${s.testName}** (${s.priority})
   - ${s.reason}
   - Framework: ${s.framework}
   - Comando: \`mcp-lab-agent auto "${s.testName}"\``).join("\n\n")}

${suggestions.length > 5 ? `
... e mais ${suggestions.length - 5} sugest\xE3o(\xF5es)` : ""}`;
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { suggestions: suggestions.slice(0, 10) }
    };
  }
);
server.registerTool(
  "qa_time_travel",
  {
    title: "Viajar no tempo: ver evolu\xE7\xE3o do agente",
    description: "[VISUALIZA\xC7\xC3O] Mostra como o agente evoluiu ao longo do tempo: taxa de sucesso por semana, tipos de erros corrigidos, padr\xF5es aprendidos.",
    inputSchema: z.object({
      period: z.enum(["7d", "30d", "all"]).optional().describe("Per\xEDodo (default: all).")
    }),
    outputSchema: z.object({
      timeline: z.array(z.object({
        date: z.string(),
        testsGenerated: z.number(),
        successRate: z.number()
      })),
      topLearnings: z.array(z.string())
    })
  },
  async ({ period = "all" }) => {
    const memory = loadProjectMemory();
    const learnings = memory.learnings || [];
    if (learnings.length === 0) {
      return {
        content: [{ type: "text", text: "\u23F3 Ainda n\xE3o h\xE1 hist\xF3rico. Use 'qa_auto' para come\xE7ar a aprender." }],
        structuredContent: { timeline: [], topLearnings: [] }
      };
    }
    const now = /* @__PURE__ */ new Date();
    const cutoff = period === "7d" ? 7 : period === "30d" ? 30 : 9999;
    const filtered = learnings.filter((l) => {
      const age = (now - new Date(l.timestamp)) / (1e3 * 60 * 60 * 24);
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
      successRate: data.total > 0 ? Math.round(data.passed / data.total * 100) : 0
    })).sort((a, b) => a.date.localeCompare(b.date));
    const selectorLearnings = filtered.filter((l) => l.type === "selector_fix" && l.success).length;
    const timingLearnings = filtered.filter((l) => l.type === "timing_fix" && l.success).length;
    const networkLearnings = filtered.filter((l) => l.type === "network_fix" && l.success).length;
    const topLearnings = [
      selectorLearnings > 0 ? `${selectorLearnings} corre\xE7\xE3o(\xF5es) de seletores` : null,
      timingLearnings > 0 ? `${timingLearnings} corre\xE7\xE3o(\xF5es) de timing` : null,
      networkLearnings > 0 ? `${networkLearnings} corre\xE7\xE3o(\xF5es) de network` : null
    ].filter(Boolean);
    const chart = timeline.length > 0 ? timeline.map((t) => `${t.date}: ${t.testsGenerated} teste(s), ${t.successRate}% sucesso`).join("\n") : "Sem dados";
    const summary = `\u23F3 **Evolu\xE7\xE3o do Agente**

**Per\xEDodo:** ${period === "7d" ? "\xDAltimos 7 dias" : period === "30d" ? "\xDAltimos 30 dias" : "Todo o hist\xF3rico"}

**Timeline:**
${chart}

**Top Aprendizados:**
${topLearnings.length > 0 ? topLearnings.map((l) => `- ${l}`).join("\n") : "- Nenhum ainda"}

**Tend\xEAncia:** ${timeline.length > 1 && timeline[timeline.length - 1].successRate > timeline[0].successRate ? "\u{1F4C8} Melhorando" : timeline.length > 1 ? "\u{1F4CA} Est\xE1vel" : "\u{1F331} Come\xE7ando"}`;
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { timeline, topLearnings }
    };
  }
);
server.registerTool(
  "qa_learning_stats",
  {
    title: "Estat\xEDsticas de aprendizado",
    description: "[M\xC9TRICAS] Retorna m\xE9tricas de aprendizado do agente: quantos testes gerados, taxa de sucesso na primeira tentativa, corre\xE7\xF5es aplicadas, etc.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      totalLearnings: z.number(),
      successfulFixes: z.number(),
      selectorFixes: z.number(),
      timingFixes: z.number(),
      testsGenerated: z.number(),
      firstAttemptSuccessRate: z.number()
    })
  },
  async () => {
    const stats = getMemoryStats();
    const summary = `\u{1F4CA} **Estat\xEDsticas de Aprendizado**

- Total de aprendizados: ${stats.totalLearnings}
- Corre\xE7\xF5es bem-sucedidas: ${stats.successfulFixes}
- Corre\xE7\xF5es de seletores: ${stats.selectorFixes}
- Corre\xE7\xF5es de timing: ${stats.timingFixes}
- Testes gerados: ${stats.testsGenerated}
- Taxa de sucesso na 1\xAA tentativa: ${stats.firstAttemptSuccessRate}%

${stats.totalLearnings === 0 ? "\u26A0\uFE0F Ainda n\xE3o h\xE1 aprendizados. Use qa_auto para gerar testes e aprender com erros." : ""}`;
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: stats
    };
  }
);
server.registerTool(
  "get_learning_report",
  {
    title: "Relat\xF3rio de evolu\xE7\xE3o e aprendizado",
    description: "Gera relat\xF3rio de evolu\xE7\xE3o dos aprendizados: resumo por tipo, evolu\xE7\xE3o no tempo e recomenda\xE7\xF5es para aprimorar o c\xF3digo.",
    inputSchema: z.object({
      format: z.enum(["summary", "full"]).optional().describe("summary = resumo executivo, full = relat\xF3rio completo com recomenda\xE7\xF5es. Default: summary")
    }),
    outputSchema: z.object({
      summary: z.string(),
      byType: z.record(z.number()),
      evolution: z.array(z.object({ date: z.string(), type: z.string(), framework: z.string() })).optional(),
      recommendations: z.array(z.string()).optional()
    })
  },
  async ({ format = "summary" }) => {
    const memory = loadProjectMemory();
    const learnings = memory.learnings || [];
    const stats = getMemoryStats();
    const byType = stats.byLearningType || {};
    const evolution = format === "full" && learnings.length > 0 ? learnings.slice(-30).map((l) => ({
      date: (l.timestamp || "").slice(0, 10),
      type: l.type || "unknown",
      framework: l.framework || "-"
    })) : [];
    const recommendations = [];
    if (byType.element_not_rendered > 0 || byType.element_not_visible > 0) {
      recommendations.push("Use waits expl\xEDcitos (waitForSelector, waitForDisplayed) ANTES de interagir com elementos.");
    }
    if (byType.timing_fix > 0 || byType.element_stale > 0) {
      recommendations.push("Aumente timeouts e use re-localiza\xE7\xE3o de elementos em listas din\xE2micas.");
    }
    if (byType.selector_fix > 0 || byType.mobile_mapping_invisible > 0) {
      recommendations.push("Priorize data-testid, role e seletores est\xE1veis; em mobile, use mapeamento vis\xEDvel no topo do spec.");
    }
    if (stats.firstAttemptSuccessRate < 70 && stats.testsGenerated > 0) {
      recommendations.push("Aplique UNIVERSAL_TEST_PRACTICES em cada teste gerado: waits inteligentes + assert final.");
    }
    if (recommendations.length === 0 && learnings.length > 0) {
      recommendations.push("Continue aplicando as pr\xE1ticas aprendidas em novos testes.");
    }
    const summary = `\u{1F4C8} **Relat\xF3rio de Evolu\xE7\xE3o e Aprendizado**

**Resumo por tipo:**
${Object.entries(byType).filter(([, v]) => v > 0).map(([t, v]) => `- ${t}: ${v}`).join("\n") || "- Nenhum aprendizado por tipo ainda"}

**M\xE9tricas gerais:**
- Total de aprendizados: ${stats.totalLearnings}
- Taxa de sucesso (1\xAA tentativa): ${stats.firstAttemptSuccessRate}%
- Testes gerados: ${stats.testsGenerated}

${format === "full" && recommendations.length > 0 ? `**Recomenda\xE7\xF5es para aprimorar o c\xF3digo:**
${recommendations.map((r) => `\u2022 ${r}`).join("\n")}` : ""}`;
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        summary: summary.trim(),
        byType,
        evolution: format === "full" ? evolution : void 0,
        recommendations: format === "full" ? recommendations : void 0
      }
    };
  }
);
server.registerTool(
  "qa_compare_with_industry",
  {
    title: "Comparar com padr\xF5es da ind\xFAstria",
    description: "[BENCHMARK] Compara as m\xE9tricas do seu projeto com benchmarks da ind\xFAstria (cobertura, taxa de sucesso, tempo de execu\xE7\xE3o).",
    inputSchema: z.object({}),
    outputSchema: z.object({
      yourProject: z.object({
        coverage: z.string(),
        successRate: z.number(),
        totalTests: z.number()
      }),
      industry: z.object({
        coverageAvg: z.string(),
        successRateAvg: z.number()
      }),
      verdict: z.string()
    })
  },
  async () => {
    const structure = detectProjectStructure();
    const stats = getMemoryStats();
    const testFiles = structure.testDirs.flatMap((dir) => {
      const fullPath = path6.join(PROJECT_ROOT6, dir);
      if (!fs6.existsSync(fullPath)) return [];
      return fs6.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f));
    });
    const industryBenchmarks = {
      coverageAvg: "70-80%",
      successRateAvg: 85,
      testsPerProject: 50
    };
    let verdict = "";
    if (stats.firstAttemptSuccessRate >= 85) {
      verdict = "\u{1F3C6} Acima da m\xE9dia da ind\xFAstria!";
    } else if (stats.firstAttemptSuccessRate >= 70) {
      verdict = "\u2705 Na m\xE9dia da ind\xFAstria.";
    } else if (stats.firstAttemptSuccessRate >= 50) {
      verdict = "\u26A0\uFE0F Abaixo da m\xE9dia. Use mais 'qa_auto' para melhorar.";
    } else {
      verdict = "\u{1F527} Bem abaixo da m\xE9dia. Foque em aprendizado.";
    }
    const summary = `\u{1F4CA} **Benchmark: Seu Projeto vs. Ind\xFAstria**

**Seu Projeto:**
- Testes: ${testFiles.length} (ind\xFAstria: ~${industryBenchmarks.testsPerProject})
- Taxa de sucesso (1\xAA tentativa): ${stats.firstAttemptSuccessRate}% (ind\xFAstria: ~${industryBenchmarks.successRateAvg}%)
- Aprendizados: ${stats.totalLearnings}

**Ind\xFAstria (m\xE9dia):**
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
          totalTests: testFiles.length
        },
        industry: industryBenchmarks,
        verdict
      }
    };
  }
);
server.registerTool(
  "qa_predict_flaky",
  {
    title: "Prever quais testes v\xE3o ficar flaky",
    description: "[PREDI\xC7\xC3O] Analisa testes existentes e prev\xEA quais t\xEAm maior chance de se tornarem flaky (baseado em padr\xF5es: seletores fr\xE1geis, waits inadequados, depend\xEAncias externas).",
    inputSchema: z.object({
      testFile: z.string().optional().describe("Arquivo espec\xEDfico (opcional). Se omitido, analisa todos.")
    }),
    outputSchema: z.object({
      predictions: z.array(z.object({
        file: z.string(),
        risk: z.enum(["high", "medium", "low"]),
        reasons: z.array(z.string())
      }))
    })
  },
  async ({ testFile }) => {
    const structure = detectProjectStructure();
    let testFiles = [];
    if (testFile) {
      testFiles = [testFile];
    } else {
      testFiles = structure.testDirs.flatMap((dir) => {
        const fullPath = path6.join(PROJECT_ROOT6, dir);
        if (!fs6.existsSync(fullPath)) return [];
        return fs6.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(spec|test|cy)\.(js|ts|jsx|tsx|py)$/.test(f)).map((f) => path6.join(dir, f));
      });
    }
    const predictions = [];
    for (const file of testFiles.slice(0, 20)) {
      const fullPath = path6.join(PROJECT_ROOT6, file);
      if (!fs6.existsSync(fullPath)) continue;
      const content = fs6.readFileSync(fullPath, "utf8");
      const reasons = [];
      let riskScore = 0;
      if (/\.(class|id)\s*=|querySelector|\.class-name/i.test(content)) {
        reasons.push("Usa seletores CSS (fr\xE1geis)");
        riskScore += 3;
      }
      if (!/data-testid|role=|aria-label/i.test(content) && /cy\.get|page\.locator|find/i.test(content)) {
        reasons.push("Sem seletores sem\xE2nticos (data-testid, role)");
        riskScore += 2;
      }
      if (/sleep|wait\(\d+\)|timeout.*\d{4,}/i.test(content)) {
        reasons.push("Usa waits fixos (timing fr\xE1gil)");
        riskScore += 2;
      }
      if (!/waitFor|waitUntil|should\('be.visible'\)/i.test(content) && /click|type|fill/i.test(content)) {
        reasons.push("Intera\xE7\xF5es sem wait expl\xEDcito");
        riskScore += 2;
      }
      if (/fetch|axios|http\.get|cy\.request/i.test(content) && !/mock|stub|intercept/i.test(content)) {
        reasons.push("Chamadas de rede sem mock");
        riskScore += 2;
      }
      if (/Math\.random|Date\.now|new Date\(\)/i.test(content)) {
        reasons.push("Usa valores n\xE3o-determin\xEDsticos");
        riskScore += 1;
      }
      if (reasons.length > 0) {
        predictions.push({
          file,
          risk: riskScore >= 5 ? "high" : riskScore >= 3 ? "medium" : "low",
          reasons
        });
      }
    }
    predictions.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 };
      return riskOrder[b.risk] - riskOrder[a.risk];
    });
    const summary = predictions.length > 0 ? `\u{1F52E} **Predi\xE7\xE3o de Testes Flaky**

${predictions.slice(0, 10).map((p) => `**${p.file}** \u2014 Risco: ${p.risk === "high" ? "\u{1F534} ALTO" : p.risk === "medium" ? "\u{1F7E1} M\xC9DIO" : "\u{1F7E2} BAIXO"}
${p.reasons.map((r) => `  - ${r}`).join("\n")}`).join("\n\n")}

${predictions.length > 10 ? `
... e mais ${predictions.length - 10} arquivo(s)` : ""}

\u{1F4A1} **Recomenda\xE7\xE3o:** Refatore testes de risco ALTO antes que se tornem flaky.` : "\u2705 Nenhum teste com alto risco de flaky detectado.";
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { predictions: predictions.slice(0, 20) }
    };
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
        const child = spawn2("npx", ["jest", "--coverage"], {
          cwd: PROJECT_ROOT6,
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
  "qa_auto",
  {
    title: "Modo aut\xF4nomo: gera, roda, corrige e aprende",
    description: "[AGENTE AUT\xD4NOMO] Loop completo: detecta projeto \u2192 gera teste \u2192 roda \u2192 se falhar: analisa, corrige, roda de novo \u2192 aprende com erros. Repete at\xE9 passar ou atingir max_retries.",
    inputSchema: z.object({
      request: z.string().describe("O que testar (ex: 'login flow', 'checkout', 'API /users')."),
      framework: z.enum([
        "cypress",
        "playwright",
        "webdriverio",
        "jest",
        "vitest",
        "mocha",
        "appium",
        "robot",
        "pytest"
      ]).optional().describe("Framework (detectado automaticamente se omitido)."),
      maxRetries: z.number().optional().describe("M\xE1ximo de tentativas de corre\xE7\xE3o. Default: 3.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      testFilePath: z.string().optional(),
      attempts: z.number(),
      finalStatus: z.enum(["passed", "failed", "max_retries"]),
      learnings: z.array(z.object({ attempt: z.number(), action: z.string(), result: z.string() })).optional(),
      error: z.string().optional()
    })
  },
  async ({ request, framework, maxRetries = 3 }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0];
    if (!fw) {
      return {
        content: [{ type: "text", text: "Nenhum framework detectado. Configure testes primeiro." }],
        structuredContent: { ok: false, error: "No framework", finalStatus: "failed", attempts: 0 }
      };
    }
    const llm = resolveLLMProvider("simple");
    if (!llm.apiKey) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key", finalStatus: "failed", attempts: 0 }
      };
    }
    const learnings = [];
    const memory = loadProjectMemory();
    const contextLines = [
      `Frameworks: ${structure.testFrameworks.join(", ")}`,
      `Pastas: ${structure.testDirs.join(", ")}`,
      memory.flows?.length ? `Fluxos: ${memory.flows.map((f) => f.name || f.id).join(", ")}` : ""
    ].filter(Boolean).join("\n");
    let testFilePath = null;
    let testContent = null;
    let attempt = 0;
    let appliedLearningFix = false;
    learnings.push({ attempt: 0, action: "detect_project", result: `${structure.testFrameworks.length} framework(s)` });
    for (attempt = 1; attempt <= maxRetries; attempt++) {
      learnings.push({ attempt, action: "generate_tests", result: "gerando..." });
      const { provider, apiKey, baseUrl, model } = llm;
      const memoryHints = memory.learnings?.filter((l) => l.fix).slice(-10).map((l) => l.fix).join("\n") || "";
      const systemPrompt = `Voc\xEA \xE9 um engenheiro de QA especializado em ${fw}. Gere APENAS o c\xF3digo do spec, sem explica\xE7\xF5es.
${UNIVERSAL_TEST_PRACTICES}

${memoryHints ? `Aprendizados anteriores (use como refer\xEAncia):
${memoryHints.slice(0, 1e3)}` : ""}
Retorne SOMENTE o c\xF3digo, sem markdown.`;
      const userPrompt = `Contexto:
${contextLines}

Gere teste para: ${request}
Framework: ${fw}`;
      try {
        let specContent = "";
        if (provider === "gemini") {
          const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
            })
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
              max_tokens: 4096
            })
          });
          const data = await res.json();
          specContent = data.choices?.[0]?.message?.content || "";
        }
        specContent = specContent.replace(/^```(?:js|javascript|typescript)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        testContent = specContent;
        if (!testFilePath) {
          const fileName = request.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
          const { ext, baseDir } = getExtensionAndBaseDir2(fw, structure);
          const safeName = fileName + ext;
          testFilePath = path6.join(baseDir, safeName);
          if (!fs6.existsSync(baseDir)) fs6.mkdirSync(baseDir, { recursive: true });
        }
        fs6.writeFileSync(testFilePath, testContent, "utf8");
        learnings.push({ attempt, action: "write_test", result: `gravado: ${testFilePath}` });
        learnings.push({ attempt, action: "run_tests", result: "executando..." });
        const runArg = fw === "playwright" ? path6.relative(PROJECT_ROOT6, testFilePath).replace(/\\/g, "/") : testFilePath;
        const runResult = await new Promise((resolve) => {
          const child = spawn2("npx", [fw === "cypress" ? "cypress" : fw === "playwright" ? "playwright" : fw, fw === "cypress" ? "run" : fw === "playwright" ? "test" : "run", runArg], {
            cwd: PROJECT_ROOT6,
            stdio: ["inherit", "pipe", "pipe"],
            shell: process.platform === "win32"
          });
          let stdout = "", stderr = "";
          if (child.stdout) child.stdout.on("data", (d) => {
            stdout += d.toString();
          });
          if (child.stderr) child.stderr.on("data", (d) => {
            stderr += d.toString();
          });
          child.on("close", (code) => resolve({ code, output: [stdout, stderr].filter(Boolean).join("\n") }));
        });
        if (runResult.code === 0) {
          learnings.push({ attempt, action: "run_tests", result: "\u2705 passou" });
          saveProjectMemory({
            learnings: [{ type: "test_generated", request, framework: fw, success: true, passedFirstTime: attempt === 1, attempts: attempt, timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
          });
          const learnedAppendix2 = appliedLearningFix ? `

${formatLearnedMessageForUser({ runOutput: runResult?.output, fixSummary: "Ajustei o c\xF3digo aplicando waits e valida\xE7\xE3o correta.", framework: fw })}` : "";
          return {
            content: [{ type: "text", text: `\u2705 Teste passou na tentativa ${attempt}!

Arquivo: ${testFilePath}

Aprendizados salvos.${learnedAppendix2}` }],
            structuredContent: { ok: true, testFilePath, attempts: attempt, finalStatus: "passed", learnings }
          };
        }
        learnings.push({ attempt, action: "run_tests", result: `\u274C falhou (exit ${runResult.code})` });
        if (attempt >= maxRetries) {
          learnings.push({ attempt, action: "max_retries", result: "limite atingido" });
          saveProjectMemory({
            learnings: [{ type: "test_generated", request, framework: fw, success: false, attempts: attempt, timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
          });
          const learnedAppendix2 = appliedLearningFix ? `

${formatLearnedMessageForUser({ runOutput: runResult.output, framework: fw, fixSummary: "Tentei corrigir. Nas pr\xF3ximas execu\xE7\xF5es usarei esse aprendizado desde o in\xEDcio." })}` : "";
          return {
            content: [{ type: "text", text: `\u274C Teste falhou ap\xF3s ${attempt} tentativa(s).

\xDAltimo erro:
${runResult.output.slice(0, 500)}${learnedAppendix2}` }],
            structuredContent: { ok: false, testFilePath, attempts: attempt, finalStatus: "max_retries", learnings }
          };
        }
        learnings.push({ attempt, action: "analyze_failures", result: "analisando..." });
        const flakyAnalysis = detectFlakyPatterns(runResult.output);
        const llmComplex = resolveLLMProvider("complex");
        const explainResult = await generateFailureExplanation(runResult.output, testFilePath);
        if (!explainResult.ok || !explainResult.structuredContent?.sugestaoCorrecao) {
          learnings.push({ attempt, action: "analyze_failures", result: "sem sugest\xE3o de corre\xE7\xE3o" });
          continue;
        }
        learnings.push({ attempt, action: "apply_fix", result: "aplicando corre\xE7\xE3o..." });
        const fixedCode = explainResult.structuredContent.sugestaoCorrecao;
        testContent = fixedCode;
        fs6.writeFileSync(testFilePath, testContent, "utf8");
        learnings.push({ attempt, action: "apply_fix", result: "corre\xE7\xE3o aplicada" });
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
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }]
          });
          appliedLearningFix = true;
        }
      } catch (err) {
        learnings.push({ attempt, action: "error", result: err.message });
        return {
          content: [{ type: "text", text: `Erro na tentativa ${attempt}: ${err.message}` }],
          structuredContent: { ok: false, error: err.message, attempts: attempt, finalStatus: "failed", learnings }
        };
      }
    }
    const learnedAppendix = appliedLearningFix ? `

${formatLearnedMessageForUser({ fixSummary: "Tentei corrigir. Nas pr\xF3ximas execu\xE7\xF5es usarei esse aprendizado desde o in\xEDcio." })}` : "";
    return {
      content: [{ type: "text", text: `\u274C Falhou ap\xF3s ${maxRetries} tentativa(s).${learnedAppendix}` }],
      structuredContent: { ok: false, testFilePath, attempts: maxRetries, finalStatus: "max_retries", learnings }
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
  if (cmd === "learning-hub") {
    const __dirname2 = path6.dirname(fileURLToPath(import.meta.url));
    const hubPath = path6.join(__dirname2, "..", "learning-hub", "src", "server.js");
    const hubUrl2 = pathToFileURL(hubPath).href;
    await import(hubUrl2);
    return;
  }
  if (cmd === "slack-bot") {
    const __dirname2 = path6.dirname(fileURLToPath(import.meta.url));
    const slackBotPath = path6.join(__dirname2, "..", "slack-bot", "src", "index.js");
    const slackBotUrl = pathToFileURL(slackBotPath).href;
    await import(slackBotUrl);
    return;
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
//# sourceMappingURL=index.js.map