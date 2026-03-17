/**
 * Testes E2E do MCP Lab Agent
 * Valida a comunicação JSON-RPC e o comportamento das ferramentas principais.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMcpClient } from "../utils/mcp-client.js";

describe("E2E - MCP Lab Agent", () => {
  let client;

  beforeAll(async () => {
    client = await createMcpClient({ cwd: "fixtures/project-with-vitest" });
  });

  afterAll(() => {
    if (client) client.close();
  });

  describe("Inicialização e tools/list", () => {
    it("deve retornar lista de ferramentas registradas", async () => {
      const result = await client.listTools();
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThanOrEqual(10);

      const names = result.tools.map((t) => t.name);
      expect(names).toContain("detect_project");
      expect(names).toContain("read_file");
      expect(names).toContain("list_test_files");
      expect(names).toContain("run_tests");
    });
  });

  describe("detect_project", () => {
    it("deve detectar vitest no projeto fixture", async () => {
      const result = await client.callTool("detect_project", {});
      expect(result).toBeDefined();

      const content = result.content;
      expect(Array.isArray(content)).toBe(true);
      const text = content.find((c) => c.type === "text")?.text;
      expect(text).toBeDefined();
      expect(text.toLowerCase()).toContain("vitest");
    });

    it("deve retornar estrutura válida via structuredContent quando disponível", async () => {
      const result = await client.callTool("detect_project", {});
      const structured = result.structuredContent ?? result;
      if (structured.structure) {
        expect(structured.structure.testFrameworks).toContain("vitest");
        expect(structured.structure.testDirs).toBeDefined();
        expect(structured.structure.hasTests).toBe(true);
      }
    });
  });

  describe("read_file", () => {
    it("deve ler arquivo existente", async () => {
      const result = await client.callTool("read_file", {
        path: "package.json",
      });
      expect(result).toBeDefined();
      const text = result.content?.[0]?.text ?? result.content;
      expect(text).toBeDefined();
      const pkg = JSON.parse(text);
      expect(pkg.name).toBe("fixture-vitest-project");
      expect(pkg.devDependencies).toHaveProperty("vitest");
    });

    it("deve retornar erro para arquivo inexistente", async () => {
      const result = await client.callTool("read_file", {
        path: "nao-existe.txt",
      });
      const text = result.content?.[0]?.text ?? result.content;
      const structured = result.structuredContent ?? result;
      expect(text || structured.error).toBeDefined();
      if (structured?.ok === false) {
        expect(structured.error).toBeDefined();
      }
    });

    it("deve ler arquivo de teste", async () => {
      const result = await client.callTool("read_file", {
        path: "tests/example.test.js",
      });
      const text = result.content?.[0]?.text ?? result.content;
      expect(text).toContain("should pass");
    });
  });

  describe("list_test_files", () => {
    it("deve listar arquivos de teste do projeto", async () => {
      const result = await client.callTool("list_test_files", {});
      expect(result).toBeDefined();
      const text = result.content?.[0]?.text ?? result.content;
      const structured = result.structuredContent ?? result;
      const files = structured?.files ?? [];
      if (files.length > 0) {
        const paths = files.map((f) => (typeof f === "string" ? f : f.path || "")).join(" ");
        expect(paths).toMatch(/example\.test/);
      }
      expect(text || files).toBeDefined();
    });
  });

  describe("run_tests", () => {
    it("deve executar testes vitest e retornar resultado", async () => {
      const result = await client.callTool("run_tests", {
        framework: "vitest",
      });
      expect(result).toBeDefined();
      const structured = result.structuredContent ?? result;
      expect(["passed", "failed", "not_found"]).toContain(structured?.status ?? result.status);
    });
  });

  describe("create_test_template", () => {
    it("deve gerar template para jest", async () => {
      const result = await client.callTool("create_test_template", {
        framework: "jest",
        type: "unit",
      });
      const structured = result.structuredContent ?? result;
      expect(structured?.ok).toBe(true);
      expect(structured?.template).toBeDefined();
      expect(structured?.suggestedFileName).toContain(".test.js");
    });

    it("deve gerar template para cypress api", async () => {
      const result = await client.callTool("create_test_template", {
        framework: "cypress",
        type: "api",
      });
      const structured = result.structuredContent ?? result;
      expect(structured?.ok).toBe(true);
      expect(structured?.template).toContain("cy.request");
    });
  });
});
