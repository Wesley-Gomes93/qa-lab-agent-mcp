#!/usr/bin/env node
/**
 * Learning Hub - API centralizada para aprendizados do mcp-lab-agent
 *
 * Endpoints:
 *   POST /learning     — recebe learnings (body: { learnings: [...] } ou learnings: {...})
 *   GET  /patterns    — retorna padrões agregados (?framework=playwright&projectId=xyz&limit=100)
 *   GET  /health      — health check
 *
 * Uso:
 *   LEARNING_HUB_DATA=./data node src/server.js
 *   Porta padrão: 3847 (QA)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addLearnings, getAggregatedPatterns } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.LEARNING_HUB_PORT || "3847", 10);

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (path === "/health") {
      send(res, 200, { ok: true, service: "learning-hub", version: "1.0.0" });
      return;
    }

    if (path === "/learning" && req.method === "POST") {
      const body = await parseBody(req);
      const learnings = body.learnings ?? (body.type ? body : null);
      if (!learnings) {
        send(res, 400, { error: "Missing learnings. Send { learnings: [...] } or a single learning object." });
        return;
      }
      const entries = Array.isArray(learnings) ? learnings : [learnings];
      const added = addLearnings(entries);
      send(res, 201, { ok: true, added });
      return;
    }

    if (path === "/patterns" && req.method === "GET") {
      const framework = url.searchParams.get("framework");
      const projectId = url.searchParams.get("projectId");
      const limit = parseInt(url.searchParams.get("limit") || "500", 10);
      const data = getAggregatedPatterns({ framework, projectId, limit });
      send(res, 200, data);
      return;
    }

    if (path === "/" || path === "") {
      const dashboardPath = path.join(__dirname, "dashboard.html");
      if (fs.existsSync(dashboardPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fs.readFileSync(dashboardPath, "utf8"));
      } else {
        send(res, 200, {
          name: "qa-lab-learning-hub",
          endpoints: {
            "GET /": "Dashboard",
            "POST /learning": "Recebe learnings do agente",
            "GET /patterns": "Padrões agregados (?framework=&projectId=&limit=)",
            "GET /health": "Health check",
          },
        });
      }
      return;
    }

    if (path === "/api") {
      send(res, 200, {
        name: "qa-lab-learning-hub",
        endpoints: {
          "POST /learning": "Recebe learnings do agente",
          "GET /patterns": "Padrões agregados (?framework=&projectId=&limit=)",
          "GET /health": "Health check",
        },
      });
      return;
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    send(res, 500, { error: err.message || "Internal error" });
  }
}

const server = http.createServer(handler);
server.listen(PORT, () => {
  console.log(`Learning Hub rodando em http://localhost:${PORT}`);
  console.log("  GET  /         — Dashboard");
  console.log("  POST /learning — envia learnings");
  console.log("  GET  /patterns — padrões agregados");
  console.log("  GET  /health   — health check");
});
