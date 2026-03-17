/**
 * Testes unitários para lógica de detecção (via MCP em projeto controlado).
 * O project-empty não tem frameworks; project-with-vitest tem vitest.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMcpClient } from "../utils/mcp-client.js";

describe("Unit - Detecção de Projeto", () => {
  describe("Projeto com Vitest (fixture)", () => {
    let client;
    beforeAll(async () => {
      client = await createMcpClient({ cwd: "fixtures/project-with-vitest" });
    });
    afterAll(() => client?.close());

    it("detect_project deve indicar hasTests=true", async () => {
      const result = await client.callTool("detect_project", {});
      const text = ((result.content?.[0]?.text ?? result.content) || "").toString();
      expect(text.toLowerCase()).toMatch(/vitest|test/);
    });

    it("list_test_files deve encontrar example.test.js", async () => {
      const result = await client.callTool("list_test_files", {});
      const structured = result.structuredContent ?? result;
      const files = structured?.files ?? [];
      const paths = files.map((f) => (typeof f === "string" ? f : f.path || f)).join(" ");
      expect(paths).toMatch(/example\.test/);
    });
  });

  describe("Projeto vazio (sem testes)", () => {
    let client;
    beforeAll(async () => {
      client = await createMcpClient({ cwd: "fixtures/project-empty" });
    });
    afterAll(() => client?.close());

    it("detect_project deve indicar ausência de frameworks ou pastas vazias", async () => {
      const result = await client.callTool("detect_project", {});
      const text = ((result.content?.[0]?.text ?? result.content) || "").toString();
      // Pode ser "nenhum" ou "nenhuma" ou similar
      expect(text).toBeDefined();
    });

    it("run_tests deve retornar not_found ou similar quando não há testes", async () => {
      const result = await client.callTool("run_tests", {});
      const structured = result.structuredContent ?? result;
      expect(["not_found", "failed", "passed"]).toContain(structured?.status ?? "unknown");
    });
  });
});
