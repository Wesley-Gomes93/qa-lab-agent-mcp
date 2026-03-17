export const FLAKY_PATTERNS = [
  { name: "timing", regex: /timeout|timed out|exceeded|wait|delay|slow|race condition/i, suggestion: "Adicione wait explícito (ex: page.waitForSelector) ou aumente o timeout." },
  { name: "ordering", regex: /order|sequenc|flaky|intermittent|sometimes|random/i, suggestion: "Issole o teste ou use beforeAll/afterAll para estado limpo. Evite dependência de ordem entre testes." },
  { name: "selector", regex: /element not found|selector|locator|cy\.get|page\.locator|Unable to find/i, suggestion: "Use seletores estáveis: data-testid, role, texto acessível. Evite classes CSS dinâmicas." },
  { name: "network", regex: /ECONNREFUSED|network|fetch|axios|request failed|404|500/i, suggestion: "Mocke APIs ou garanta que o backend esteja rodando. Use retry ou intercept." },
  { name: "shared_state", regex: /state|cleanup|beforeEach|afterEach|isolation/i, suggestion: "Garanta beforeEach/afterEach para resetar estado. Evite variáveis globais compartilhadas." },
];

export function detectFlakyPatterns(runOutput) {
  const detected = [];
  for (const p of FLAKY_PATTERNS) {
    if (p.regex.test(runOutput)) {
      detected.push({ pattern: p.name, suggestion: p.suggestion });
    }
  }
  const confidence = detected.length > 0 ? Math.min(0.5 + detected.length * 0.2, 0.95) : 0;
  return { isLikelyFlaky: confidence > 0.5, confidence, patterns: detected };
}
