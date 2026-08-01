import { describe, it, expect } from "vitest";
import { classifyFlakyFromRuns, oneLineFailureSummary } from "../../src/core/flaky-detection.js";

describe("classifyFlakyFromRuns", () => {
  it("marca flaky quando passa e falha", () => {
    const r = classifyFlakyFromRuns(
      [{ passed: true }, { passed: false }, { passed: true }],
      { minRuns: 3 }
    );
    expect(r.verdict).toBe("flaky");
    expect(r.isFlaky).toBe(true);
    expect(r.failureRate).toBe(33);
  });

  it("marca stable quando tudo passa", () => {
    const r = classifyFlakyFromRuns(
      [{ passed: true }, { passed: true }, { passed: true }],
      { minRuns: 3 }
    );
    expect(r.verdict).toBe("stable");
  });

  it("marca always_failing quando tudo falha", () => {
    const r = classifyFlakyFromRuns(
      [{ passed: false }, { passed: false }, { passed: false }],
      { minRuns: 3 }
    );
    expect(r.verdict).toBe("always_failing");
  });
});

describe("oneLineFailureSummary", () => {
  it("gera frase com tipo e solução", () => {
    const s = oneLineFailureSummary("Timeout waiting for selector #login");
    expect(s.toLowerCase()).toMatch(/falhou/);
    expect(s.length).toBeGreaterThan(20);
  });
});
