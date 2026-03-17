# Especificação: Self-Healing e Métricas de Negócio

Design para implementar as duas funcionalidades prioritárias identificadas na pesquisa de mercado.

---

## 1. Self-Healing — Detecção e Correção de Seletores

### Conceito

Quando o UI muda (refactor, redesign, mudança de componente), seletores quebram e testes falham. **Self-healing** = detectar que a falha foi por seletor obsoleto e sugerir/aplicar a correção automaticamente.

### O que já existe no mcp-lab-agent

| Componente | Comportamento atual |
|------------|---------------------|
| `suggest_fix` | Detecta "element not found / selector / timeout" e sugere genérico: "Use data-testid para seletores mais estáveis" |
| `por_que_falhou` / `generateFailureExplanation` | LLM retorna `sugestaoCorrecao` (código) quando identifica falha de seletor |
| `analyze_failures` | Extrai stack trace, mensagem, arquivo — mas não inspeciona o DOM |

### Gap atual

- Sugestões são genéricas — não propõem seletor **concreto** baseado no DOM atual
- Não há integração com página real (não acessa URL, não inspeciona elementos)
- `sugestaoCorrecao` vem do LLM sem garantia de validade — poderia validar contra o DOM
- Não há "auto-aplicação" — só sugestão textual

### Proposta de implementação

#### Opção A: Self-healing assistido (mais viável no MCP)

**Ferramenta nova: `heal_selector`**

```
Input:
  - testFilePath: arquivo do teste que falhou
  - selectorQuebrado: string (ex: "cy.get('[data-cy=submit-btn]')" ou "page.locator('#login')")
  - pageUrl: URL da página onde o elemento deveria existir (opcional)
  - selectorType: 'cypress' | 'playwright' | 'webdriverio'

Output:
  - selectorAtual: seletor sugerido que existe no DOM
  - confianca: 0-1 (baseado em unicidade do elemento)
  - alternativas: array de seletores candidatos
  - patch: diff/código corrigido para aplicar no arquivo
```

**Fluxo:**

1. Usuário roda `run_tests` → falha com "element not found"
2. Usuário chama `heal_selector` com arquivo + seletor quebrado
3. O agente precisa de **acesso ao DOM**:
   - **Sem browser real:** pedir ao usuário que forneça HTML da página OU usar API de screenshots/HTML (ex: serviço externo)
   - **Com Playwright/Puppeteer no projeto:** rodar script que abre a URL, extrai HTML/estrutura, e busca elementos similares (por texto, papel ARIA, hierarquia)
4. Algoritmo de matching:
   - Extrair do seletor quebrado: texto do botão, data-attributes, classe, id
   - Buscar no DOM por: `[data-testid]`, `role=button` + texto, `button:has-text("Login")` etc.
   - Rankear candidatos por similaridade semântica
5. LLM pode ajudar a escolher o melhor se houver ambiguidade
6. Retornar sugestão + opção de `write` ( aplicar patch no arquivo )

**Complexidade:** Requer execução de browser ou HTML snapshot. No contexto MCP puro (sem browser), limitado a:
- Análise semântica do erro + código → sugestão melhorada via LLM (já parcialmente feito)
- Se o projeto tiver Playwright instalado, `run_tests` pode gravar HTML em falha e passar para `heal_selector`

#### Opção B: Self-healing via LLM enriquecido (mais simples)

Melhorar o prompt de `por_que_falhou` / `suggest_fix` para:

- Incluir no contexto: **trecho do código** onde está o seletor + **mensagem de erro** (ex: "Timed out retrying after 4000ms: Expected to find element: .btn-submit")
- Pedir ao LLM: "Sugira um seletor alternativo mais resiliente. Priorize: data-testid > role + accessible name > texto visível > classe. Se o texto mudou (ex: 'Enviar' → 'Submit'), sugira o novo."
- Adicionar ao output: `selectorSugerido` e `codigoCorrigido` (bloco pronto para aplicar)

**Implementação mínima (rápida):**
- Expandir `suggest_fix` para quando detectar "selector/element not found": chamar LLM com o código do teste + output da falha e pedir `sugestaoCorrecao` focada em seletor
- Incluir no prompt: boas práticas (data-testid, getByRole, texto acessível)

#### Opção C: Integração com ferramentas externas

- **Playwright Codegen** — gerar novo seletor via `codegen`
- **ChroMAT** / **Resemble** — detectam mudanças visuais e sugerem ajustes
- MCP poderia invocar essas ferramentas se estiverem instaladas

---

## 2. Métricas de Negócio — Tempo até Bug, Custo por Defeito, Cobertura por Fluxo

### Conceito

Relatórios do mercado mostram que times querem métricas que conectem QA a impacto de negócio:
- **Time to bug** — tempo entre deploy e detecção do bug (ou entre commit e falha no CI)
- **Cost per defect** — custo de encontrar/corrigir um defeito
- **Coverage por fluxo** — não só % de linhas, mas % de fluxos críticos cobertos

### O que já existe no mcp-lab-agent

| Componente | Comportamento atual |
|------------|---------------------|
| `get_test_coverage` | Cobertura Jest (linhas/funções) |
| `analyze_failures` | Extrai falhas individuais |
| `create_bug_report` | Gera markdown de bugs |
| `run_tests` | Output de pass/fail |

Não há hoje:
- Persistência de histórico de falhas (para calcular tendências)
- Cálculo de tempo entre eventos (deploy → bug, commit → falha)
- Mapeamento teste ↔ fluxo de negócio
- Métricas agregadas em dashboard/relatório

### Proposta de implementação

#### Fonte de dados

Para métricas de negócio, precisamos de **eventos** registrados ao longo do tempo:

| Evento | Quando | Dados |
|--------|--------|-------|
| `test_run` | `run_tests` executa | timestamp, pass/fail, duração, arquivos |
| `failure` | teste falha | timestamp, arquivo, mensagem, stack |
| `bug_reported` | `create_bug_report` | timestamp, severidade, testes afetados |
| `fix_applied` | (manual ou futuro) | timestamp, qual bug/teste |

Persistência sugerida: arquivo JSON local (ex: `.qa-lab-metrics.json`) ou SQLite leve, no diretório do projeto.

#### Métricas a implementar

**2.1 Time to bug (tempo até bug)**

- **Definição:** Tempo entre o último deploy/commit e a primeira falha que indica bug em produção (ou em staging).
- **Implementação simplificada:**  
  - Registrar em cada `run_tests`: `timestamp`, `git commit` (se disponível), `failures[]`  
  - Métrica: "Tempo médio entre execução e detecção de falha" = avg(delta entre execuções com falha)
  - Ou: "Tempo desde último deploy até primeira falha" — requer integração com CI (ex: variável `DEPLOY_TIMESTAMP`) ou `git log`

**2.2 Cost per defect (custo por defeito)**

- **Fórmula típica:** (horas de QA para encontrar + horas de dev para corrigir) × custo/hora  
- **Implementação simplificada:**  
  - Não temos custo/hora — usamos **proxy**: "tempo gasto" = soma de duração de `run_tests` que encontraram falhas + estimativa de tempo de análise (ex: 5 min por `analyze_failures` por falha)  
  - Métrica: **"Tempo estimado por defeito"** = total_tempo_falhas / num_falhas  
  - Opcional: campo manual para "custo/hora" e calcular valor em R$

**2.3 Cobertura por fluxo**

- **Definição:** % de fluxos de negócio (ex: "login", "checkout", "cadastro") que têm pelo menos um teste.
- **Implementação:**  
  - **Mapeamento manual:** arquivo `qa-lab-flows.json` listando fluxos e arquivos de teste associados:
    ```json
    {
      "flows": [
        { "id": "login", "name": "Login", "testFiles": ["specs/login.spec.js"] },
        { "id": "checkout", "name": "Checkout", "testFiles": ["e2e/checkout.cy.js", "e2e/payment.cy.js"] }
      ]
    }
    ```
  - Ferramenta `get_flow_coverage`: lê esse mapa + `list_test_files` → calcula quantos fluxos têm testes / total de fluxos  
  - **Mapeamento automático (futuro):** inferir fluxos por comentários no código (`// flow: login`) ou por estrutura de pastas (`specs/login/`)

#### Nova ferramenta: `get_business_metrics`

```
Input:
  - period: '7d' | '30d' | 'all'  (opcional, default 30d)
  - flowsConfigPath: string (opcional, default 'qa-lab-flows.json')

Output:
  - timeToBug: { avgHours, lastFailureAt, runsWithFailures }
  - costPerDefect: { avgMinutesPerDefect, totalFailures, estimatedHoursSpent }
  - flowCoverage: { totalFlows, coveredFlows, percent, details: [{ flow, covered }] }
  - trend: passRateLast7Days (array ou resumo)
```

#### Estrutura de armazenamento sugerida

```json
// .qa-lab-metrics.json (append-only ou sobrescrito por período)
{
  "events": [
    {
      "type": "test_run",
      "timestamp": "2025-03-16T10:00:00Z",
      "gitCommit": "abc123",
      "passed": 10,
      "failed": 2,
      "durationSeconds": 45,
      "failures": [
        { "file": "specs/login.spec.js", "test": "should login", "message": "..." }
      ]
    }
  ],
  "lastUpdated": "2025-03-16T10:05:00Z"
}
```

---

## Ordem sugerida de implementação

| Prioridade | Feature | Esforço | Impacto |
|------------|---------|---------|---------|
| 1 | **Self-healing B** — melhorar prompt LLM em `suggest_fix`/`por_que_falhou` para sugerir seletores concretos | Baixo | Alto |
| 2 | **Métricas** — persistir eventos em `run_tests` + criar `get_business_metrics` básico | Médio | Alto |
| 3 | **Métricas** — `qa-lab-flows.json` + `get_flow_coverage` | Baixo | Médio |
| 4 | **Self-healing A** — `heal_selector` com HTML/Playwright (se viável no contexto) | Alto | Alto |

---

## Referências

- Autonoma State of QA 2025 — self-healing, intent-based tests
- TestRail Report — métricas desejadas: traceability, time to resolution, cost per defect
- Research doc: `RESEARCH_QA_SOLUCOES_LINKEDIN_2025.md`
