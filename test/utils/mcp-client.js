/**
 * Utilitário para comunicação JSON-RPC com o MCP server via stdio.
 * Usado nos testes E2E.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Cria um cliente MCP que spawna o servidor e comunica via stdin/stdout.
 * @param {object} options
 * @param {string} options.cwd - Diretório de trabalho (project root para o MCP)
 * @param {number} options.timeout - Timeout em ms
 */
export function createMcpClient({ cwd, timeout = 8000 } = {}) {
  const projectRoot = path.resolve(__dirname, "..", cwd || "fixtures/project-with-vitest");
  const distPath = path.resolve(__dirname, "..", "..", "dist", "index.js");

  return new Promise((resolve, reject) => {
    const proc = spawn("node", [distPath], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const buffer = [];
    let initResolve = null;
    const initPromise = new Promise((r) => { initResolve = r; });

    proc.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          buffer.push(msg);
          if (initResolve && msg.result && !msg.method) {
            initResolve(msg);
            initResolve = null;
          }
        } catch {}
      }
    });

    proc.stderr.on("data", (data) => {
      // Logs do servidor - ignorar ou logar em debug
      if (process.env.DEBUG_MCP) process.stderr.write(data);
    });

    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
    });

    const send = (msg) => {
      proc.stdin.write(JSON.stringify(msg) + "\n");
    };

    const waitForResponse = (id) => {
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("Timeout waiting for response")), timeout);
        const check = () => {
          const found = buffer.find((m) => m.id === id);
          if (found) {
            clearTimeout(t);
            res(found);
          } else {
            setImmediate(check);
          }
        };
        setImmediate(check);
      });
    };

    const initialize = async () => {
      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0" },
        },
      });
      const res = await initPromise;
      if (res.error) throw new Error(res.error.message || "Initialize failed");
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      return res.result;
    };

    const listTools = async () => {
      const id = 2;
      send({ jsonrpc: "2.0", id, method: "tools/list", params: {} });
      const res = await waitForResponse(id);
      if (res.error) throw new Error(res.error.message || "tools/list failed");
      return res.result;
    };

    const callTool = async (name, args = {}) => {
      const id = Math.floor(Math.random() * 1e6) + 10;
      send({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      });
      const res = await waitForResponse(id);
      if (res.error) throw new Error(res.error.message || `tools/call ${name} failed`);
      return res.result;
    };

    const close = () => {
      proc.stdin.end();
      proc.kill("SIGTERM");
    };

    // Inicializar
    initialize()
      .then(() => resolve({ callTool, listTools, close }))
      .catch(reject);
  });
}
