# 📋 Checklist para QA Jr — O que pedir ao agente

Use **"com o qa-lab-agent"** ou **"@qa-lab-agent"** antes do pedido para ativar as ferramentas de QA.

---

## ✅ Lista de comandos que o agente entende e executa

| # | O que o QA pede | O que o agente faz |
|---|-----------------|-------------------|
| 1 | "**Com o qa-lab-agent**, detecte a estrutura do meu projeto" | `detect_project` — identifica frameworks, pastas de teste, backend/frontend |
| 2 | "**Com o qa-lab-agent**, liste todos os arquivos de teste" | `list_test_files` — lista specs/testes (Cypress, Playwright, Jest, etc.) |
| 3 | "**Com o qa-lab-agent**, rode os testes" | `run_tests` — executa testes (detecta framework automaticamente) |
| 4 | "**Com o qa-lab-agent**, rode os testes e me dê um relatório" | `run_tests` + `analyze_failures` + `create_bug_report` (se houver falhas) |
| 5 | "**Com o qa-lab-agent**, analise as falhas e sugira correções" | `analyze_failures` + `suggest_fix` |
| 6 | "**Com o qa-lab-agent**, crie um bug report das falhas" | `create_bug_report` |
| 7 | "**Com o qa-lab-agent**, me dê as métricas de QA" | `get_business_metrics` |
| 8 | "**Com o qa-lab-agent**, me dê a cobertura de testes" | `get_test_coverage` |
| 9 | "**Com o qa-lab-agent**, gere um teste E2E para [fluxo]" | `generate_tests` + `write_test` (requer API key no .env) |
| 10 | "**Com o qa-lab-agent**, por que esse teste falhou?" | `por_que_falhou` (requer API key) |
| 11 | "**Com o qa-lab-agent**, sugira correção para esse seletor quebrado" | `suggest_selector_fix` (requer API key) |
| 12 | "**Com o qa-lab-agent**, analise os métodos desse arquivo" | `analyze_file_methods` — varre cada método e verifica: correto?, melhor forma de escrever?, falso positivo?, coerente?, itens faltando?, parâmetros/imports faltando? (requer API key) |

---

## 🔄 Fluxo completo (E2E + relatório + métricas)

**Um único pedido que faz tudo:**

> "**Com o qa-lab-agent**, execute o fluxo completo de QA: rode os testes, analise as falhas se houver, crie um bug report e me dê as métricas."

**O agente vai:**
1. `detect_project` — identificar estrutura
2. `run_tests` — executar testes
3. Se falhou → `analyze_failures` + `create_bug_report`
4. `get_business_metrics` — métricas de negócio
5. `get_test_coverage` — cobertura (Jest/Vitest)

---

## ⚠️ O que precisa estar configurado

| Ferramenta | Requer |
|-----------|--------|
| `run_tests`, `list_test_files`, `detect_project`, `create_bug_report` | Nada (funciona direto) |
| `generate_tests`, `por_que_falhou`, `suggest_selector_fix` | `GROQ_API_KEY` ou `GEMINI_API_KEY` ou `OPENAI_API_KEY` no `.env` |
| `get_test_coverage` | Projeto com Jest ou Vitest |

---

## 📌 Reprodução dos comandos

**Sim.** O agente entende linguagem natural e traduz para as ferramentas corretas. Os comandos acima são **exemplos** — variações como "rode os testes com o qa-lab-agent" ou "use o qa-lab-agent para listar testes" também funcionam.

---

## 🛠 Comandos de terminal (fora do agente)

O agente **não** executa comandos de terminal diretamente (ex: `npm test`). Ele usa as ferramentas MCP, que por sua vez rodam `npx vitest`, `npx cypress run`, etc. **O resultado é o mesmo** que rodar no terminal.
