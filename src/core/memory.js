import path from "node:path";
import fs from "node:fs";
import { syncLearningsToHub } from "./hub-client.js";

const PROJECT_ROOT = process.cwd();
const MEMORY_FILE = path.join(PROJECT_ROOT, ".qa-lab-memory.json");
const FLOWS_CONFIG_FILE = path.join(PROJECT_ROOT, "qa-lab-flows.json");

export function loadProjectMemory() {
  const memory = { patterns: {}, conventions: {}, lastRun: null, selectors: [] };
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const raw = fs.readFileSync(MEMORY_FILE, "utf8");
      Object.assign(memory, JSON.parse(raw));
    } catch {}
  }
  if (fs.existsSync(FLOWS_CONFIG_FILE)) {
    try {
      const flows = JSON.parse(fs.readFileSync(FLOWS_CONFIG_FILE, "utf8"));
      memory.flows = flows.flows || [];
    } catch {}
  }
  return memory;
}

export function saveProjectMemory(updates) {
  try {
    let data = loadProjectMemory();
    if (updates.patterns) data.patterns = { ...data.patterns, ...updates.patterns };
    if (updates.conventions) data.conventions = { ...data.conventions, ...updates.conventions };
    if (updates.selectors) data.selectors = [...new Set([...(data.selectors || []), ...updates.selectors])].slice(-100);
    if (updates.lastRun) data.lastRun = updates.lastRun;
    if (updates.learnings) {
      data.learnings = data.learnings || [];
      data.learnings.push(...updates.learnings);
      if (data.learnings.length > 200) data.learnings = data.learnings.slice(-150);
      syncLearningsToHub(updates.learnings).catch(() => {});
    }
    if (updates.execution) {
      data.executions = data.executions || [];
      data.executions.push(updates.execution);
      if (data.executions.length > 500) data.executions = data.executions.slice(-300);
    }
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {}
}

const LEARNING_TYPES = ["selector_fix", "timing_fix", "element_not_rendered", "element_not_visible", "element_stale", "mobile_mapping_invisible"];

export function getMemoryStats() {
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
    firstAttemptSuccessRate: totalTests > 0 ? Math.round((firstAttemptSuccess / totalTests) * 100) : 0,
  };
}

export function analyzeTestStability() {
  const memory = loadProjectMemory();
  const executions = memory.executions || [];
  
  if (executions.length === 0) return { tests: [], message: "Nenhuma execução registrada ainda." };

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
    const failureRate = Math.round((data.failed / data.total) * 100);
    const avgDuration = data.durations.length > 0 ? (data.durations.reduce((a, b) => a + b, 0) / data.durations.length).toFixed(1) : 0;
    const stability = failureRate === 0 ? "stable" : failureRate < 20 ? "mostly_stable" : failureRate < 50 ? "flaky" : "unstable";
    
    return {
      file,
      total: data.total,
      passed: data.passed,
      failed: data.failed,
      failureRate,
      avgDuration: parseFloat(avgDuration),
      stability,
    };
  }).sort((a, b) => b.failureRate - a.failureRate);

  return { tests, message: `Analisadas ${executions.length} execuções de ${tests.length} teste(s).` };
}
