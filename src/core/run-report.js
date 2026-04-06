/**
 * Structured JSON run reports + baseline comparison for CI gates.
 * @module core/run-report
 */
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { parseTestRunResult, extractFailuresFromOutput } from "./tool-helpers.js";

export const RUN_REPORT_SCHEMA_VERSION = "1.0";
export const DEFAULT_REPORT_DIR = ".qa-lab-reports";

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function defaultLatestReportPath(projectRoot) {
  return path.join(projectRoot, DEFAULT_REPORT_DIR, "latest.json");
}

/**
 * @param {string} runOutput
 * @param {number} exitCode
 * @returns {{ passedCount: number, failedCount: number, skippedCount: number, tests: Array<{ name: string, status: string, errorSnippet?: string }> }}
 */
export function buildTestSummary(runOutput, exitCode) {
  const { passed, failed } = parseTestRunResult(runOutput, exitCode);
  const skippedMatch = runOutput.match(/(\d+)\s+skipped/i);
  const skippedCount = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;

  const rawFailures = extractFailuresFromOutput(runOutput);
  const tests = [];

  rawFailures.forEach((f) => {
    tests.push({
      name: (f.test || "unknown").slice(0, 200),
      status: "failed",
      errorSnippet: f.message?.slice(0, 800),
    });
  });

  if (tests.length === 0) {
    tests.push({
      name: "(suite)",
      status: exitCode === 0 ? "passed" : "failed",
      errorSnippet: exitCode !== 0 ? runOutput.slice(-1200) : undefined,
    });
  }

  return {
    passedCount: passed,
    failedCount: failed,
    skippedCount,
    tests,
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
export function buildRunReport({
  projectRoot,
  framework,
  spec,
  cmd,
  args,
  cwd,
  exitCode,
  runOutput,
  durationMs,
  runId,
}) {
  const summary = buildTestSummary(runOutput || "", exitCode);
  const outcome =
    exitCode === 0 && summary.failedCount === 0 ? "passed" : "failed";

  return {
    schemaVersion: RUN_REPORT_SCHEMA_VERSION,
    runId: runId || randomUUID(),
    timestamp: new Date().toISOString(),
    framework: framework || "unknown",
    spec: spec || null,
    command: { cmd, args: args || [], cwd: cwd || projectRoot },
    exitCode: exitCode ?? 1,
    summary: {
      outcome,
      passedCount: summary.passedCount,
      failedCount: summary.failedCount,
      skippedCount: summary.skippedCount,
      durationMs: durationMs ?? null,
    },
    tests: summary.tests.slice(0, 100),
    artifacts: {
      outputTail: (runOutput || "").slice(-4000),
    },
  };
}

/**
 * @param {object} report
 * @param {string} filePath
 */
export function writeRunReportFile(report, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");
}

/**
 * Compare current run report to a baseline (for deploy gates).
 * @param {object} current - Report from buildRunReport
 * @param {object} baseline - Previous report JSON
 * @returns {{ verdict: "pass"|"fail"|"inconclusive", reasons: string[] }}
 */
export function compareToBaseline(current, baseline) {
  const reasons = [];
  if (!baseline || typeof baseline !== "object") {
    return { verdict: "inconclusive", reasons: ["Missing or invalid baseline file."] };
  }
  if (baseline.schemaVersion && baseline.schemaVersion !== RUN_REPORT_SCHEMA_VERSION) {
    reasons.push(`Baseline schema ${baseline.schemaVersion} vs current ${RUN_REPORT_SCHEMA_VERSION}.`);
  }

  const bExit = baseline.exitCode ?? (baseline.summary?.outcome === "passed" ? 0 : 1);
  const cExit = current.exitCode ?? (current.summary?.outcome === "passed" ? 0 : 1);

  const bFailed = baseline.summary?.failedCount ?? (bExit !== 0 ? 1 : 0);
  const cFailed = current.summary?.failedCount ?? (cExit !== 0 ? 1 : 0);

  if (cExit !== 0) {
    reasons.push(`Current run failed (exit ${cExit}).`);
  }
  if (cFailed > bFailed) {
    reasons.push(`Regressão: falhas ${cFailed} > baseline ${bFailed}.`);
  }
  if (cFailed < bFailed) {
    reasons.push(`Melhoria vs baseline: falhas ${cFailed} < ${bFailed}.`);
  }

  if (cExit !== 0 || cFailed > bFailed) {
    return { verdict: "fail", reasons };
  }
  if (reasons.some((r) => r.includes("schema"))) {
    return { verdict: "inconclusive", reasons };
  }
  return { verdict: "pass", reasons: reasons.length ? reasons : ["OK vs baseline."] };
}
