# Top 3 Problemas de QA — e como o mcp-lab-agent se torna excelente

**Posicionamento:** *Assistente de teste que aprende com falhas*

---

## Os Top 3 Problemas (validados no mercado)

### 1. Testes flaky — "passa às vezes, falha às vezes"

**Impacto:** Microsoft: ~25% das falhas em CI são flaky; Slack: 56,76% antes de remediar. Times gastam 5–10h/semana lidando com flakiness. Perda de confiança ("re-run and hope"), regressões reais passam despercebidas.

**Causas raiz:** timing/race condition, estado compartilhado, rede, seletor frágil, ordem entre testes.

**O que o agente já faz:** `detectFlakyPatterns`, `inferFailurePattern`, learning para timing_fix/selector_fix.

---

### 2. "Por que falhou?" — Debugging de falhas

**Impacto:** QA e devs perdem horas lendo stack traces, logs e tentando entender a causa. Saída genérica "teste falhou" não ajuda.

**O que o agente já faz:** `por_que_falhou`, `analyze_failures`, tradução em "O que aconteceu / Por que / O que fazer / Sugestão de correção".

---

### 3. Manutenção de testes — Seletores quebram quando o código muda

**Impacto:** Refactors quebram testes. Seletores frágeis (classes CSS, XPath longo) quebram com mudanças de UI. Manutenção manual consome tempo.

**Mobile:** Muitos QAs são mobile-first. Em Appium/Detox, seletores frágeis (XPath, índice, className) quebram com atualizações de UI. O MCP Appium ajuda no mapeamento, mas falta algo mais **inteligente, assertivo e perfeito** — hierarquia clara de prioridade, detecção de fragilidade e sugestão com justificativa.

**O que o agente já faz:** `suggest_selector_fix`, `map_mobile_elements`, learning para selector_fix, recomenda data-testid/role. Em mobile: MOBILE_MAPPING_LESSON, padrão mobile_mapping_invisible.

---

## Roadmap: tornar o agente excelente em cada um

### Problema 1 — Flaky tests

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| **Detecção automática de flaky** | Alta | Ao rodar testes, identificar quais falham intermitentemente (ex.: rodar 3x, se 2 passam e 1 falha → marcar como flaky) |
| **Relatório "testes flaky"** | Alta | Comando/ferramenta que lista testes flaky com % de falha e causa provável (timing, selector, etc.) |
| **Correção automática no qa_auto** | Média | Quando detectar flaky, aplicar fix (wait, re-localizar) e validar |
| **Métricas de flakiness** | Média | Incluir no metrics-report: testes flaky, taxa de flakiness por projeto |

### Problema 2 — "Por que falhou?"

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| **Explicação em 1 frase** | Alta | Resumo executivo: "Falhou porque o botão de login demora a aparecer (timing). Solução: adicione waitForDisplayed antes do click." |
| **Integração com run_tests** | Alta | `explainOnFailure: true` já existe — garantir que sempre mostre "por que" quando falhar |
| **Explicação para juniores** | Média | Já existe em por_que_falhou — reforçar conceito, exemplos de código |
| **Histórico de falhas** | Média | "Este teste já falhou 3x por timing" — usar executions + learnings |

### Problema 3 — Manutenção / Seletores

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| **Sugestão proativa de data-testid** | Alta | Ao gerar teste, priorizar data-testid; ao analisar falha de seletor, sugerir onde adicionar data-testid no código fonte |
| **Detecção de seletores frágeis** | Média | Analisar specs e marcar seletores de risco (classes dinâmicas, XPath longo) |
| **"Corrigir seletor" em 1 clique** | Média | suggest_selector_fix retornar patch aplicável (diff) |

#### 3.1 Mobile — Hierarquia única e inovadora

**Diferencial:** Hierarquia que nenhum outro agente aplica de forma sistemática.

| Ordem | Estratégia | Descrição |
|-------|------------|-----------|
| **1. id** | `~accessibility-id`, `testID`, `resource-id` | Semântico, estável, acessível. Prioridade máxima. |
| **2. XPath relacional** | Âncora + eixos + **tipo específico** | **Inovador:** âncora estável + eixos + **tipo de elemento** (Button, TextView). **EVITAR `*`** — quebra por timing, múltiplos matches. Ex: `//android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']`. |
| **3. resource-id** | `id=com.app:id/btn` | Fallback quando id semântico não existe. |

**XPath relacional (âncora + eixos + tipo):** Âncora estável + eixos (`following-sibling`, `parent`, `descendant`) + **tipo específico** (android.widget.Button, XCUIElementTypeButton). **Nunca use `*`** — é frágil (timing, múltiplos elementos).

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| **Hierarquia id → XPath relacional → resource-id** | Alta | Implementar e documentar como diferencial. |
| **XPath relacional (âncora + eixos + tipo)** | Alta | Âncora + eixos + **tipo específico** (Button, TextView). Nunca `*`. Nunca índice puro. |
| **Integração MCP Appium** | Alta | Page source real para identificar âncoras estáveis e sugerir XPath relacional correto. |
| **Detox: testID > accessibilityLabel > text** | Média | Mesma lógica para React Native. |

---

## Mensagem simplificada (recomendação do mercado)

**Antes:** "Sistema de inteligência em qualidade de software"

**Depois:** "Assistente de teste que aprende com falhas — reduz tempo de debug, elimina flaky e mantém seletores estáveis"

**Headline:** "Teste falhou? Em 30 segundos: o que aconteceu, por que e como corrigir."

---

## Próximos passos imediatos

1. **Flaky:** Implementar detecção automática (rodar N vezes, marcar flaky) e comando `mcp-lab-agent flaky-report`
2. **Por que falhou:** Garantir que `run_tests` com `explainOnFailure` seja o padrão recomendado; melhorar output em 1 frase
3. **Seletores:** Reforçar data-testid no generate_tests e no suggest_selector_fix
4. **Mobile:** Implementar hierarquia assertiva em `suggest_selector_fix` quando framework=Appium; integrar MCP Appium (page source) quando disponível

---

## Mobile: hierarquia única — id → XPath relacional → resource-id

**Diferencial inovador:** XPath relacional (âncora + eixos). Não é XPath de qualquer forma — é XPath **forte**.

1. **id** — `~accessibility-id`, `testID`. Sempre primeiro.
2. **XPath relacional** — Âncora estável + eixos + **tipo específico** (android.widget.Button, XCUIElementTypeButton). **Nunca `*`** — quebra por timing e múltiplos matches.
   - Eixos: `following-sibling`, `parent`, `preceding-sibling`, `ancestor`, `descendant`
   - Ex (Android): `//android.widget.LinearLayout[@resource-id='login_form']/descendant::android.widget.Button[@text='Entrar']`
   - Ex (iOS): `//XCUIElementTypeOther[@name='login_form']/descendant::XCUIElementTypeButton[@name='Entrar']`
3. **resource-id** — Fallback.

**Evitar:** `*` em XPath (frágil). XPath por índice (`//Button[3]`). Usar sempre tipo de elemento específico.


## Métricas de sucesso

| Métrica | Como medir |
|---------|------------|
| Tempo de debug | Antes vs depois de usar "por que falhou" |
| Taxa de flakiness | % de testes flaky no projeto |
| Taxa de sucesso 1ª tentativa | `mcp-lab-agent stats` — firstAttemptSuccessRate |
| Manutenção de seletores | Nº de correções selector_fix aplicadas com sucesso |
