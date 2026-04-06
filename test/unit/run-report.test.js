import { describe, it, expect } from "vitest";
import { compareToBaseline, buildRunReport } from "../../src/core/run-report.js";

describe("run-report", () => {
  it("compareToBaseline passes when current matches green baseline", () => {
    const baseline = {
      schemaVersion: "1.0",
      exitCode: 0,
      summary: { failedCount: 0, outcome: "passed" },
    };
    const current = buildRunReport({
      projectRoot: "/tmp",
      framework: "vitest",
      spec: null,
      cmd: "npx",
      args: ["vitest", "run"],
      cwd: "/tmp",
      exitCode: 0,
      runOutput: "Tests: 1 passed",
      durationMs: 100,
      runId: "test-id",
    });
    const cmp = compareToBaseline(current, baseline);
    expect(cmp.verdict).toBe("pass");
  });

  it("compareToBaseline fails when failures increase", () => {
    const baseline = {
      schemaVersion: "1.0",
      exitCode: 0,
      summary: { failedCount: 0, outcome: "passed" },
    };
    const current = buildRunReport({
      projectRoot: "/tmp",
      framework: "vitest",
      spec: null,
      cmd: "npx",
      args: ["vitest", "run"],
      cwd: "/tmp",
      exitCode: 1,
      runOutput: "Tests: 1 failed",
      durationMs: 100,
      runId: "test-id-2",
    });
    const cmp = compareToBaseline(current, baseline);
    expect(cmp.verdict).toBe("fail");
  });
});
