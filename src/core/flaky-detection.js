export const FLAKY_PATTERNS = [
  { name: "timing", regex: /timeout|timed out|exceeded|wait|delay|slow|race condition/i, suggestion: "Adicione wait explícito (ex: page.waitForSelector) ou aumente o timeout." },
  { name: "ordering", regex: /order|sequenc|flaky|intermittent|sometimes|random/i, suggestion: "Issole o teste ou use beforeAll/afterAll para estado limpo. Evite dependência de ordem entre testes." },
  { name: "selector", regex: /element not found|selector|locator|cy\.get|page\.locator|Unable to find/i, suggestion: "Use seletores estáveis: data-testid, role, texto acessível. Evite classes CSS dinâmicas." },
  { name: "network", regex: /ECONNREFUSED|network|fetch|axios|request failed|404|500/i, suggestion: "Mocke APIs ou garanta que o backend esteja rodando. Use retry ou intercept." },
  { name: "shared_state", regex: /state|cleanup|beforeEach|afterEach|isolation/i, suggestion: "Garanta beforeEach/afterEach para resetar estado. Evite variáveis globais compartilhadas." },
];

/**
 * Padrões de falha com mensagem adaptada e lição específica.
 * Ordem importa: o primeiro que bater é usado.
 */
export const FAILURE_ANALYSIS_PATTERNS = [
  {
    name: "element_not_rendered",
    regex: /timeout|not found|element not found|no such element|element.*not.*in.*dom|waiting for/i,
    oQueAconteceu: "O elemento ainda não foi renderizado no DOM quando o teste tentou interagir. Pode ser carregamento assíncrono, lazy load ou animação.",
    lesson: `Espere o elemento estar disponível ANTES de interagir:
- Playwright: await element.waitFor({ state: 'attached' }) ou waitForSelector
- Cypress: cy.get(sel).should('exist') antes de clicar
- WDIO/Appium: $(sel).waitForDisplayed() ou waitForExist({ timeout: 10000 })
- Use waits inteligentes: waitForDisplayed, waitForClickable, waitForExist`,
    learningType: "element_not_rendered",
  },
  {
    name: "element_not_visible",
    regex: /element.*not.*visible|not visible|is not visible|element is not displayed|hidden|display.*none|off.?screen/i,
    oQueAconteceu: "O elemento existe no DOM mas não está visível (display:none, off-screen, opacity:0 ou ainda carregando).",
    lesson: `Verifique visibilidade antes de interagir:
- Playwright: waitFor({ state: 'visible' })
- Cypress: .should('be.visible') antes de click
- Appium/WDIO: waitForDisplayed() ou isDisplayed()
- Adicione wait explícito: elemento pode estar em animação ou carregando`,
    learningType: "element_not_visible",
  },
  {
    name: "element_stale",
    regex: /stale element|stale element reference|element.*no longer attached/i,
    oQueAconteceu: "O elemento foi encontrado mas a página/DOM mudou antes da interação (elemento ficou obsoleto).",
    lesson: `Re-localize o elemento antes de cada ação:
- Evite guardar referência: busque novamente antes de clicar
- Use waits que revalidam: cy.get().first().click() com retry
- Em listas dinâmicas: espere estabilização antes de interagir`,
    learningType: "element_stale",
  },
  {
    name: "mobile_mapping_invisible",
    regex: /element not found|selector|Unable to find|no such element/i,
    oQueAconteceu: "Em mobile: o mapeamento ficou invisível ou os seletores não estão estruturados. Pode ser estrutura do código ou seletor incorreto.",
    lesson: `Em testes mobile (Appium/Detox), SEMPRE:
- Mapeamento VISÍVEL: const ELEMENTS = { btn: '~id' }; $(ELEMENTS.btn).click()
- Antes de clicar: $(sel).waitForDisplayed({ timeout: 10000 })
- Ao final: expect(await $(sel).isDisplayed()).toBe(true) — validação explícita para o usuário entender que houve validação`,
    learningType: "mobile_mapping_invisible",
    mobileOnly: true,
  },
  {
    name: "selector",
    regex: /selector|locator|element not found|Unable to find/i,
    oQueAconteceu: "O seletor não encontrou o elemento. Pode ser seletor incorreto, mudança de UI ou elemento em outro contexto (iframe, shadow DOM).",
    lesson: "Use seletores estáveis: data-testid, role+name, accessibility-id. Evite classes CSS dinâmicas. Priorize: data-testid > role > texto visível.",
    learningType: "selector_fix",
  },
  {
    name: "timing",
    regex: /timeout|timed out|exceeded|slow/i,
    oQueAconteceu: "O teste excedeu o tempo de espera. O elemento pode demorar para aparecer ou há race condition.",
    lesson: "Adicione wait explícito antes de interagir. Aumente timeout se necessário. Use waitForDisplayed/waitForSelector.",
    learningType: "timing_fix",
  },
];

/** Detecta qual padrão de falha melhor se aplica. Retorna o primeiro que bater. */
export function inferFailurePattern(runOutput, framework = "") {
  const output = (runOutput || "").toLowerCase();
  for (const p of FAILURE_ANALYSIS_PATTERNS) {
    if (p.mobileOnly && !/appium|detox/i.test(framework)) continue;
    if (p.regex.test(output)) return p;
  }
  return null;
}

/** Detecta se falha é por mapeamento invisível em mobile (retrocompatível). */
export function detectMobileMappingInvisible(runOutput, framework = "") {
  const p = inferFailurePattern(runOutput, framework);
  return p?.name === "mobile_mapping_invisible" || (p?.name === "selector" && /appium|detox/i.test(framework));
}

export const MOBILE_MAPPING_LESSON = `Em testes mobile (Appium/Detox), SEMPRE inclua o mapeamento de elementos de forma VISÍVEL e estruturada no código:
- Use constantes ou Page Object no TOPO do spec: const ELEMENTS = { loginBtn: '~btn_login', ... };
- No teste: $(ELEMENTS.loginBtn).click();
- Nunca deixe seletores "invisíveis" (hardcoded inline repetidos). Isso dificulta manutenção e causa falhas.`;

/** Regras universais para TODOS os testes gerados. */
export const UNIVERSAL_TEST_PRACTICES = `PRÁTICAS OBRIGATÓRIAS em todo teste gerado:
1. Esperas inteligentes: ANTES de interagir, verifique que o elemento está disponível (waitForDisplayed, waitForExist, waitForSelector)
2. Validação no final: SEMPRE adicione um expect/assert ao final para o usuário entender que houve validação (ex: expect(element).toBeVisible() ou cy.get(sel).should('be.visible'))
3. Não assuma que o elemento está pronto: elemento pode não estar renderizado, visível ou disponível — use waits explícitos`;

/** Mensagem adaptada ao tipo de erro detectado. */
export function formatLearnedMessageForUser({ pattern, fixSummary, runOutput, framework }) {
  const p = pattern || (runOutput ? inferFailurePattern(runOutput, framework) : null);
  const oQueAconteceu = p?.oQueAconteceu || "O teste falhou por um problema de elemento ou timing.";
  const oQueFiz = fixSummary || (p ? `Apliquei a correção para esse tipo de falha: ${p.name}.` : "Ajustei o código.");
  return `**Entendi o erro e apliquei a correção**

**O que aconteceu:** ${oQueAconteceu}

**O que fiz:** ${oQueFiz}

**O que aprendi:** Salvei esse cenário no meu histórico. Nas próximas gerações, vou aplicar as práticas corretas (waits inteligentes, validação final) desde o início.

Use \`mcp-lab-agent stats\` ou \`get_learning_report\` para ver a evolução dos aprendizados.`;
}

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
