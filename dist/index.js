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
function detectProjectStructure() {
  const structure = {
    hasTests: false,
    testFrameworks: [],
    testDirs: [],
    hasBackend: false,
    backendDir: null,
    hasFrontend: false,
    frontendDir: null,
    packageJson: null
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
    if (deps.jest || deps.vitest) {
      structure.testFrameworks.push(deps.jest ? "jest" : "vitest");
      structure.hasTests = true;
    }
    if (deps.express || deps.fastify || deps["@nestjs/core"]) {
      structure.hasBackend = true;
    }
    if (deps.next || deps.react || deps.vue || deps.svelte) {
      structure.hasFrontend = true;
    }
  }
  const commonTestDirs = ["tests", "test", "e2e", "cypress", "playwright", "__tests__"];
  for (const dir of commonTestDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath)) {
      structure.testDirs.push(dir);
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
  "run_tests",
  {
    title: "Executar testes",
    description: "Roda testes do projeto (Cypress, Playwright, Jest, npm test). Detecta automaticamente o framework.",
    inputSchema: z.object({
      framework: z.enum(["cypress", "playwright", "jest", "npm"]).optional().describe("Framework espec\xEDfico ou 'npm' para npm test."),
      spec: z.string().optional().describe("Caminho do spec (ex: cypress/e2e/test.cy.js)."),
      suite: z.string().optional().describe("Suite ou pattern (ex: e2e, api).")
    }),
    outputSchema: z.object({
      status: z.enum(["passed", "failed", "not_found"]),
      message: z.string(),
      exitCode: z.number(),
      runOutput: z.string().optional()
    })
  },
  async ({ framework, spec, suite }) => {
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
    } else if (selectedFramework === "jest") {
      cmd = "npx";
      args = ["jest"];
      if (spec) args.push(spec);
      cwd = PROJECT_ROOT;
    } else {
      cmd = "npm";
      args = ["test"];
      cwd = PROJECT_ROOT;
    }
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
    description: "L\xEA package.json, detecta rotas (se backend), specs existentes e retorna contexto.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      ok: z.boolean(),
      summary: z.string(),
      packageJson: z.object({}).passthrough().optional(),
      testFiles: z.array(z.string()).optional()
    })
  },
  async () => {
    const structure = detectProjectStructure();
    const testFiles = [];
    for (const dir of structure.testDirs) {
      const fullPath = path.join(PROJECT_ROOT, dir);
      const walk = (p, base = "") => {
        if (!fs.existsSync(p)) return;
        const entries = fs.readdirSync(p, { withFileTypes: true });
        for (const e of entries) {
          const rel = base ? `${base}/${e.name}` : e.name;
          if (e.isDirectory()) {
            walk(path.join(p, e.name), rel);
          } else if (e.isFile() && /\.(cy|spec|test)\.(js|ts)$/.test(e.name)) {
            testFiles.push(`${dir}/${rel}`);
          }
        }
      };
      walk(fullPath);
    }
    const summary = [
      `Frameworks: ${structure.testFrameworks.join(", ") || "nenhum"}`,
      `Arquivos de teste: ${testFiles.length}`,
      `Backend: ${structure.backendDir || "n\xE3o detectado"}`,
      `Frontend: ${structure.frontendDir || "n\xE3o detectado"}`
    ].join("\n");
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        ok: true,
        summary,
        packageJson: structure.packageJson,
        testFiles: testFiles.slice(0, 50),
        structure
      }
    };
  }
);
server.registerTool(
  "generate_tests",
  {
    title: "Gerar testes com LLM",
    description: "Gera spec de teste usando LLM (requer GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY).",
    inputSchema: z.object({
      context: z.string().describe("Contexto do projeto (resultado de read_project ou descri\xE7\xE3o)."),
      request: z.string().describe("O que testar (ex: 'login flow', 'API healthcheck')."),
      framework: z.enum(["cypress", "playwright", "jest"]).optional().describe("Framework alvo.")
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      specContent: z.string().optional(),
      suggestedFileName: z.string().optional(),
      error: z.string().optional()
    })
  },
  async ({ context, request, framework }) => {
    const structure = detectProjectStructure();
    const fw = framework || structure.testFrameworks[0] || "cypress";
    const GROQ_KEY = process.env.GROQ_API_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.QA_LAB_LLM_API_KEY;
    if (!GROQ_KEY && !GEMINI_KEY && !OPENAI_KEY) {
      return {
        content: [{ type: "text", text: "Configure GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY no .env" }],
        structuredContent: { ok: false, error: "No API key configured" }
      };
    }
    const provider = GROQ_KEY ? "groq" : GEMINI_KEY ? "gemini" : "openai";
    const apiKey = GROQ_KEY || GEMINI_KEY || OPENAI_KEY;
    const baseUrl = provider === "groq" ? "https://api.groq.com/openai/v1" : provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1";
    const model = provider === "groq" ? "llama-3.3-70b-versatile" : provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";
    const systemPrompt = `Voc\xEA \xE9 um engenheiro de QA especializado em ${fw}. Gere APENAS o c\xF3digo do spec, sem explica\xE7\xF5es.
Framework: ${fw}
Regras:
- Para Cypress: use cy.request() para API, cy.visit() para UI
- Para Playwright: use test.describe() e test(), fixture { request } para API
- Para Jest: use describe() e test(), fetch() ou axios para API
- C\xF3digo limpo, sem coment\xE1rios excessivos
- Retorne SOMENTE o c\xF3digo JavaScript, sem markdown`;
    const userPrompt = `Contexto do projeto:
${context.slice(0, 5e3)}

Gere um teste para: ${request}
Framework: ${fw}`;
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
server.registerTool(
  "write_test",
  {
    title: "Escrever arquivo de teste",
    description: "Grava spec no disco. Detecta automaticamente a pasta correta.",
    inputSchema: z.object({
      name: z.string().describe("Nome do arquivo (ex: login-test)."),
      content: z.string().describe("Conte\xFAdo do spec."),
      framework: z.enum(["cypress", "playwright", "jest"]).optional().describe("Framework (detectado automaticamente se omitido)."),
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
    const ext = fw === "cypress" ? ".cy.js" : fw === "playwright" ? ".spec.js" : ".test.js";
    const safeName = name.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/\.(cy|spec|test)\.js$/i, "");
    const fileName = `${safeName}${ext}`;
    let baseDir;
    if (fw === "cypress") {
      baseDir = structure.testDirs.includes("cypress") ? path.join(PROJECT_ROOT, "cypress") : structure.testDirs.includes("tests") ? path.join(PROJECT_ROOT, "tests", "cypress") : path.join(PROJECT_ROOT, structure.testDirs[0] || "tests");
    } else if (fw === "playwright") {
      baseDir = structure.testDirs.includes("playwright") ? path.join(PROJECT_ROOT, "playwright") : structure.testDirs.includes("tests") ? path.join(PROJECT_ROOT, "tests", "playwright") : path.join(PROJECT_ROOT, structure.testDirs[0] || "tests");
    } else {
      baseDir = path.join(PROJECT_ROOT, structure.testDirs[0] || "tests");
    }
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
    const summary = failures.length ? `${failures.length} falha(s) detectada(s).` : "Nenhuma falha detectada.";
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { ok: true, summary, failures: failures.length ? failures : void 0 }
    };
  }
);
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((err) => {
  console.error("Erro no MCP server:", err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map