# 💬 Comandos do Chat Cursor - mcp-lab-agent

**Total: 29 ferramentas MCP** que você pode usar no chat do Cursor falando em **linguagem natural**.

---

## 🚀 Comandos "Wow" (Inteligência)

### 1. qa_full_analysis ⭐ **[MAIS IMPORTANTE]**
**Análise completa: executor + consultor inteligente**

```
"Analise e melhore meu QA"
"Análise completa do projeto"
"qa_full_analysis"
```

**Retorna:**
- Estabilidade por teste (flaky, unstable, stable)
- Riscos por área de código (high, medium, low)
- Recomendações priorizadas (🔴 URGENTE, 🟡 IMPORTANTE, 🟢 MELHORIA)
- Comandos prontos para executar
- Nota de saúde do QA (0-100)

---

### 2. qa_health_check
**Nota de saúde do QA (0-100) + recomendações**

```
"Qual a saúde do meu QA?"
"qa_health_check"
"Me dá uma nota do projeto"
```

---

### 3. qa_suggest_next_test
**Sugere próximo teste a criar (IA analisa gaps)**

```
"Qual teste devo criar agora?"
"Sugira o próximo teste"
"qa_suggest_next_test"
```

---

### 4. qa_predict_flaky
**Prevê se um teste vai ser flaky antes de rodar**

```
"Esse teste vai ser flaky?"
"Analise specs/login.spec.js para flakiness"
"qa_predict_flaky em tests/checkout.test.js"
```

---

### 5. qa_time_travel
**Visualiza evolução do agente (taxa de sucesso ao longo do tempo)**

```
"Mostre a evolução do agente"
"qa_time_travel"
"Como o agente melhorou?"
```

---

### 6. qa_compare_with_industry
**Compara métricas com benchmarks da indústria**

```
"Como estou vs indústria?"
"qa_compare_with_industry"
"Benchmark do projeto"
```

---

## 🤖 Modo Autônomo

### 7. qa_auto
**Loop completo: gera → roda → corrige → aprende**

```
"Modo autônomo: gere teste para login"
"qa_auto para checkout flow com 5 tentativas"
"Gere e corrija automaticamente teste de cadastro"
```

---

### 8. qa_learning_stats
**Estatísticas de aprendizado**

```
"Mostre as estatísticas de aprendizado"
"Qual a taxa de sucesso na primeira tentativa?"
"qa_learning_stats"
```

---

## 🔍 Detecção

### 9. detect_project
**Detecta frameworks, pastas, backend, frontend**

```
"Detecte a estrutura do meu projeto"
"Quais frameworks de teste o projeto tem?"
"detect_project"
```

---

### 10. read_project
**Lê estrutura + package.json + testes (com conteúdo opcional)**

```
"Lê a estrutura do projeto com exemplos de teste"
"read_project com includeContent"
```

---

### 11. list_test_files
**Lista todos os arquivos de teste**

```
"Liste todos os arquivos de teste"
"Liste testes de Cypress"
"Arquivos de teste que contêm 'login'"
```

---

### 12. read_file
**Lê qualquer arquivo do projeto**

```
"Leia o arquivo cypress/e2e/login.cy.js"
"Mostre o conteúdo de src/pages/Login.tsx"
```

---

## ▶️ Execução

### 13. run_tests
**Executa os testes do projeto**

```
"Rode os testes"
"Execute os testes do Vitest"
"Roda o spec cypress/e2e/login.cy.js"
```

---

### 14. watch_tests
**Indica como rodar testes em modo watch**

```
"Como rodar testes em watch?"
"Modo watch para Vitest"
```

---

### 15. get_test_coverage
**Gera cobertura de testes (Jest/Vitest)**

```
"Me dá a cobertura de testes"
"Roda cobertura"
```

---

## ✍️ Geração

### 16. generate_tests
**Gera testes com LLM (ou traduz de outro framework)**

```
"Gere um teste E2E para login"
"Crie teste de API para /users"
"Traduz esse teste Cypress para Playwright"
```

---

### 17. write_test
**Grava um arquivo de teste no disco**

```
"Grava o teste login-test no arquivo"
"Escreve o spec em specs/login.spec.js"
```

---

### 18. create_test_template
**Gera template básico (boilerplate) de teste**

```
"Crie um template de teste Playwright para API"
"Template de teste Jest unit"
```

---

## 🔬 Análise

### 19. analyze_failures
**Extrai falhas estruturadas do output + detecta flaky**

```
"Analise as falhas desse output"
"Extrai as falhas do resultado dos testes"
```

---

### 20. por_que_falhou ⭐
**Explica em português: o que aconteceu, por que falhou, o que fazer**

```
"Por que falhou?"
"Explica a falha do teste"
"Analisa a falha do specs/login.spec.js"
```

---

### 21. suggest_fix
**Sugere correções para falhas**

```
"Sugira correção para essas falhas"
"O que fazer para corrigir?"
```

---

### 22. suggest_selector_fix
**Self-healing: sugere seletor alternativo quando UI mudou**

```
"O seletor quebrou, sugira um novo para specs/login.spec.js"
"Corrija o seletor que não encontra o elemento"
```

---

### 23. analyze_file_methods
**Analisa cada método de um arquivo**

```
"Analise os métodos de src/utils.js"
"Revê o arquivo tests/login.cy.js método por método"
```

---

## 🌐 Browser

### 24. web_eval_browser
**Avalia app no browser (screenshot, console, network)**

```
"Avalie http://localhost:3000 no browser"
"Abre a URL e captura screenshot e console"
```

---

## 📊 Relatórios

### 25. create_bug_report
**Gera relatório de bug a partir de falhas**

```
"Crie um bug report das falhas"
"Gera relatório de bug"
```

---

### 26. get_business_metrics
**Métricas: tempo até bug, custo por defeito, cobertura por fluxo**

```
"Quais as métricas de negócio?"
"Métricas dos últimos 7 dias"
```

---

## 🛠️ Manutenção

### 27. run_linter
**Executa ESLint ou linter do projeto**

```
"Rode o linter"
"Execute ESLint"
```

---

### 28. install_dependencies
**Instala dependências (npm/yarn/pnpm)**

```
"Instale as dependências"
"npm install"
```

---

### 29. qa_route_task
**Sugere qual agente/ferramenta usar para uma tarefa**

```
"Qual ferramenta usar para rodar os testes?"
"Roteie a tarefa: gerar teste de checkout"
```

---

## 🎯 Top 5 Comandos Mais Úteis

| # | Comando | O que faz |
|---|---------|-----------|
| 1 | `qa_full_analysis` | Análise completa + recomendações acionáveis |
| 2 | `qa_auto` | Gera, testa, corrige e aprende automaticamente |
| 3 | `por_que_falhou` | Explica falhas em português simples |
| 4 | `generate_tests` | Gera testes com IA |
| 5 | `run_tests` | Executa testes |

---

## 💡 Dicas

1. **Fale naturalmente**: O Cursor entende linguagem natural e chama as ferramentas automaticamente
2. **Combine comandos**: "Rode os testes e analise as falhas"
3. **Use contexto**: "Por que falhou?" (usa última falha automaticamente)
4. **Seja específico**: "Gere teste E2E para login com Playwright"

---

## 📖 Documentação Completa

Ver `docs/REFERENCIA_COMPLETA.md` para detalhes de cada ferramenta.
