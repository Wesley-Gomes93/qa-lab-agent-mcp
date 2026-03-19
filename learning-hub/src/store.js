/**
 * Store para Learning Hub - persistência em JSON (como memory.js do agente).
 * Escalável: troque por SQLite/Postgres se precisar.
 */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.LEARNING_HUB_DATA || path.join(process.cwd(), "data");
const LEARNINGS_FILE = path.join(DATA_DIR, "learnings.json");
const MAX_LEARNINGS = 5000;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLearnings() {
  ensureDir();
  if (!fs.existsSync(LEARNINGS_FILE)) return [];
  try {
    const raw = fs.readFileSync(LEARNINGS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLearnings(learnings) {
  ensureDir();
  const trimmed = learnings.length > MAX_LEARNINGS ? learnings.slice(-MAX_LEARNINGS) : learnings;
  fs.writeFileSync(LEARNINGS_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

export function addLearnings(entries) {
  const learnings = loadLearnings();
  const normalized = Array.isArray(entries) ? entries : [entries];
  const withMeta = normalized.map((e) => ({
    ...e,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    receivedAt: new Date().toISOString(),
  }));
  learnings.push(...withMeta);
  saveLearnings(learnings);
  return withMeta.length;
}

export function getAggregatedPatterns(filters = {}) {
  const learnings = loadLearnings();
  const { framework, projectId, limit = 100 } = filters;

  let filtered = learnings;
  if (framework) {
    filtered = filtered.filter((l) => (l.framework || "").toLowerCase().includes(framework.toLowerCase()));
  }
  if (projectId) {
    filtered = filtered.filter((l) => l.projectId === projectId);
  }
  filtered = filtered.slice(-(limit || 500));

  const byType = {};
  const byFramework = {};
  const byFrameworkAndType = {};
  let testGenerated = 0;
  let firstAttemptSuccess = 0;

  filtered.forEach((l) => {
    const t = l.type || "unknown";
    byType[t] = (byType[t] || 0) + 1;

    const f = l.framework || "unknown";
    byFramework[f] = (byFramework[f] || 0) + 1;

    const key = `${f}::${t}`;
    byFrameworkAndType[key] = (byFrameworkAndType[key] || 0) + 1;

    if (t === "test_generated") {
      testGenerated++;
      if (l.passedFirstTime) firstAttemptSuccess++;
    }
  });

  const successRate = testGenerated > 0 ? Math.round((firstAttemptSuccess / testGenerated) * 100) : 0;

  return {
    total: filtered.length,
    byType,
    byFramework,
    byFrameworkAndType,
    testGenerated,
    firstAttemptSuccessRate: successRate,
    recommendations: buildRecommendations(byType, successRate),
  };
}

function buildRecommendations(byType, successRate) {
  const recs = [];
  if (byType.element_not_rendered > 0 || byType.element_not_visible > 0) {
    recs.push("Use waits explícitos (waitForSelector, waitForDisplayed) antes de interagir com elementos.");
  }
  if (byType.timing_fix > 0 || byType.element_stale > 0) {
    recs.push("Aumente timeouts e use re-localização de elementos em listas dinâmicas.");
  }
  if (byType.selector_fix > 0 || byType.mobile_mapping_invisible > 0) {
    recs.push("Priorize data-testid, role e seletores estáveis; em mobile, use mapeamento visível.");
  }
  if (successRate < 70) {
    recs.push("Taxa de sucesso baixa: aplique waits inteligentes + assert final em cada teste.");
  }
  if (recs.length === 0) {
    recs.push("Continue gerando testes. O agente está evoluindo bem.");
  }
  return recs;
}
