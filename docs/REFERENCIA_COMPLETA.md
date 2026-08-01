# 📋 Referência Completa — mcp-lab-agent

Este documento lista **todos** os comandos do chat Cursor, **todos** os comandos do terminal e um **resumo do projeto** após sua expansão.

---

## 📌 Resumo do Projeto

O **mcp-lab-agent** é um **agente autônomo de QA que aprende com os próprios erros**. Não é só um assistente: ele **gera, executa, corrige e aprende** para cada vez acertar mais na primeira tentativa.

| Dimensão | O que faz |
|----------|-----------|
| **🤖 Autônomo** | Loop completo: gera teste → roda → se falhar: analisa, corrige e tenta de novo → aprende |
| **📊 Learning** | Salva correções bem-sucedidas, taxa de sucesso na 1ª tentativa, métricas de aprendizado |
| **Detecção** | Identifica automaticamente 15+ frameworks (Cypress, Playwright, Jest, Vitest, Robot, pytest, etc.) |
| **Execução** | Roda testes em qualquer framework detectado |
| **Geração** | Gera testes com LLM (Groq, Gemini, OpenAI) e traduz entre frameworks |
| **Análise** | Analisa falhas, explica "por que falhou", sugere correções e detecta testes flaky |
| **Browser** | Avalia apps em browser real (screenshots, network, console) via Playwright |
| **Relatórios** | Bug reports em Markdown, métricas de negócio |
| **Inteligência** | Model routing (tarefas simples → modelo barato; complexas → modelo forte) |
| **Memória** | Cache de padrões em `.qa-lab-memory.json` e `qa-lab-flows.json` |
| **Agentes** | 9 agentes especializados (autonomous, learning, detection, execution, generation, analysis, browser, reporting, maintenance) |

**Total:** 29 ferramentas MCP + 6 comandos CLI.

---

## 💬 Comandos no Chat do Cursor

Você pode falar em linguagem natural. O Cursor usa as ferramentas automaticamente. Abaixo, **todas** as 21 ferramentas e exemplos de frases que as acionam.

### 1. read_file
Lê qualquer arquivo do projeto.

| Exemplo no chat |
|-----------------|
| "Leia o arquivo cypress/e2e/login.cy.js" |
| "Mostre o conteúdo de src/pages/Login.tsx" |
| "Lê specs/login.spec.js" |

---

### 2. detect_project
Detecta frameworks, pastas, backend e frontend.

| Exemplo no chat |
|-----------------|
| "Detecte a estrutura do meu projeto" |
| "Quais frameworks de teste o projeto tem?" |
| "Analise a estrutura do projeto" |

---

### 3. read_project
Lê estrutura + package.json + arquivos de teste (opcionalmente com conteúdo).

| Exemplo no chat |
|-----------------|
| "Lê a estrutura do projeto com exemplos de teste" |
| "Me dá o contexto do projeto com conteúdo dos specs" |
| "read_project com includeContent" |

---

### 4. list_test_files
Lista todos os arquivos de teste (com filtro opcional).

| Exemplo no chat |
|-----------------|
| "Liste todos os arquivos de teste" |
| "Liste testes de Cypress" |
| "Arquivos de teste que contêm 'login'" |

---

### 5. qa_route_task
Sugere qual agente/ferramenta usar para uma tarefa.

| Exemplo no chat |
|-----------------|
| "Qual ferramenta usar para rodar os testes?" |
| "Roteie a tarefa: gerar teste de checkout" |
| "O que usar para analisar falhas?" |

---

### 6. run_tests
Executa os testes do projeto.

| Exemplo no chat |
|-----------------|
| "Rode os testes" |
| "Execute os testes do Vitest" |
| "Roda o spec cypress/e2e/login.cy.js" |
| "Run tests" |

---

### 7. watch_tests
Indica como rodar testes em modo watch.

| Exemplo no chat |
|-----------------|
| "Como rodar testes em watch?" |
| "Modo watch para Vitest" |

---

### 8. get_test_coverage
Gera cobertura de testes (Jest/Vitest).

| Exemplo no chat |
|-----------------|
| "Me dá a cobertura de testes" |
| "Roda cobertura" |
| "get_test_coverage" |

---

### 9. generate_tests
Gera testes com LLM (ou traduz de outro framework).

| Exemplo no chat |
|-----------------|
| "Gere um teste E2E para login" |
| "Crie teste de API para /users" |
| "Traduz esse teste Cypress para Playwright" |
| "Gera teste de checkout" |

---

### 10. write_test
Grava um arquivo de teste no disco.

| Exemplo no chat |
|-----------------|
| "Grava o teste login-test no arquivo" |
| "Escreve o spec em specs/login.spec.js" |
| "Use write_test para salvar o teste gerado" |

---

### 11. create_test_template
Gera template básico (boilerplate) de teste.

| Exemplo no chat |
|-----------------|
| "Crie um template de teste Playwright para API" |
| "Template de teste Jest unit" |
| "Template Cypress UI" |

---

### 12. analyze_failures
Extrai falhas estruturadas do output + detecta flaky.

| Exemplo no chat |
|-----------------|
| "Analise as falhas desse output" |
| "Extrai as falhas do resultado dos testes" |
| "analyze_failures com o output do run_tests" |

---

### 13. por_que_falhou
Explica em português: o que aconteceu, por que falhou, o que fazer, sugestão de correção.

| Exemplo no chat |
|-----------------|
| "Por que falhou?" |
| "Explica a falha do teste" |
| "Por que o teste falhou? (usa .qa-lab-last-failure.log)" |
| "Analisa a falha do specs/login.spec.js" |

---

### 14. suggest_fix
Sugere correções para falhas (elemento não encontrado, asserção, rede, etc.).

| Exemplo no chat |
|-----------------|
| "Sugira correção para essas falhas" |
| "O que fazer para corrigir?" |
| "suggest_fix com o resultado do analyze_failures" |

---

### 15. suggest_selector_fix
Self-healing: sugere seletor alternativo quando UI mudou.

| Exemplo no chat |
|-----------------|
| "O seletor quebrou, sugira um novo para specs/login.spec.js" |
| "Corrija o seletor que não encontra o elemento" |
| "suggest_selector_fix para specs/login.spec.js" |

---

### 16. analyze_file_methods
Analisa cada método de um arquivo (correto, falso positivo, imports faltando, etc.).

| Exemplo no chat |
|-----------------|
| "Analise os métodos de src/utils.js" |
| "Revê o arquivo tests/login.cy.js método por método" |
| "analyze_file_methods em cypress/support/commands.js" |

---

### 17. create_bug_report
Gera relatório de bug a partir de falhas.

| Exemplo no chat |
|-----------------|
| "Crie um bug report das falhas" |
| "Gera relatório de bug" |
| "create_bug_report com as falhas do analyze_failures" |

---

### 18. get_business_metrics
Métricas: tempo até bug, custo por defeito, cobertura por fluxo.

| Exemplo no chat |
|-----------------|
| "Quais as métricas de negócio?" |
| "Métricas dos últimos 7 dias" |
| "get_business_metrics período 30d" |

---

### 19. web_eval_browser
Avalia app no browser (screenshot, console, network). Requer Playwright.

| Exemplo no chat |
|-----------------|
| "Avalie http://localhost:3000 no browser" |
| "Abre a URL e captura screenshot e console" |
| "web_eval_browser em http://localhost:5173" |

---

### 20. run_linter
Executa ESLint ou linter do projeto.

| Exemplo no chat |
|-----------------|
| "Rode o linter" |
| "Execute ESLint" |
| "Lint com --fix" |

---

### 21. install_dependencies
Instala dependências (npm/yarn/pnpm).

| Exemplo no chat |
|-----------------|
| "Instale as dependências" |
| "npm install" |
| "install_dependencies" |

---

### 22. qa_auto
**[NOVO]** Loop autônomo: gera teste, roda, corrige e aprende (até passar ou max_retries).

| Exemplo no chat |
|-----------------|
| "Modo autônomo: gere teste para login" |
| "qa_auto para checkout flow com 5 tentativas" |
| "Gere e corrija automaticamente teste de cadastro" |

---

### 23. qa_learning_stats
**[NOVO]** Mostra estatísticas de aprendizado (taxa de sucesso, correções, etc.).

| Exemplo no chat |
|-----------------|
| "Mostre as estatísticas de aprendizado" |
| "Qual a taxa de sucesso na primeira tentativa?" |
| "qa_learning_stats" |

---

### 24. qa_full_analysis ⭐
**[NOVO v2.1.0]** Análise completa: executor + consultor inteligente.

| Exemplo no chat |
|-----------------|
| "Analise e melhore meu QA" |
| "Análise completa do projeto" |
| "qa_full_analysis" |

**Retorna:**
- Estabilidade por teste (flaky, unstable, stable)
- Riscos por área de código (high, medium, low)
- Recomendações priorizadas (🔴 URGENTE, 🟡 IMPORTANTE, 🟢 MELHORIA)
- Comandos prontos para executar
- Nota de saúde do QA (0-100)

---

### 25. qa_health_check
**[NOVO v2.0.1]** Nota de saúde do QA (0-100) + recomendações.

| Exemplo no chat |
|-----------------|
| "Qual a saúde do meu QA?" |
| "qa_health_check" |

---

### 26. qa_suggest_next_test
**[NOVO v2.0.1]** Sugere próximo teste a criar (IA analisa gaps).

| Exemplo no chat |
|-----------------|
| "Qual teste devo criar agora?" |
| "Sugira o próximo teste" |

---

### 27. qa_predict_flaky
**[NOVO v2.0.1]** Prevê se um teste vai ser flaky antes de rodar.

| Exemplo no chat |
|-----------------|
| "Esse teste vai ser flaky?" |
| "Analise specs/login.spec.js para flakiness" |

---

### 28. qa_time_travel
**[NOVO v2.0.1]** Visualiza evolução do agente (taxa de sucesso ao longo do tempo).

| Exemplo no chat |
|-----------------|
| "Mostre a evolução do agente" |
| "qa_time_travel" |

---

### 29. qa_compare_with_industry
**[NOVO v2.0.1]** Compara métricas com benchmarks da indústria.

| Exemplo no chat |
|-----------------|
| "Como estou vs indústria?" |
| "qa_compare_with_industry" |

---

## 🖥️ Comandos no Terminal

Estes comandos rodam **fora** do Cursor, no terminal. O mcp-lab-agent precisa estar no PATH (global ou via npx).

### 1. Iniciar servidor MCP (padrão)

```bash
mcp-lab-agent
# ou
npx mcp-lab-agent
```

Sem argumentos, inicia o servidor MCP. Usado pelo Cursor quando você configura o MCP.

---

### 2. Ajuda

```bash
mcp-lab-agent --help
mcp-lab-agent -h
```

Mostra uso e comandos disponíveis.

---

### 3. Detectar estrutura

```bash
mcp-lab-agent detect
```

Saída: JSON com `hasTests`, `testFrameworks`, `testDirs`, `hasBackend`, `backendDir`, `hasFrontend`, `frontendDir`.

---

### 4. Sugerir ferramenta

```bash
mcp-lab-agent route "rodar os testes"
mcp-lab-agent route "gerar teste de login"
mcp-lab-agent route "analisar por que falhou"
mcp-lab-agent route "avaliar app no browser"
```

Saída: JSON com `suggestedAgent`, `suggestedTools`, `description`.

---

### 5. Listar agentes e ferramentas

```bash
mcp-lab-agent list
```

Saída: Lista de agentes (detection, execution, generation, etc.) e suas ferramentas.

---

### 6. Modo autônomo (auto)

**[NOVO]** Gera teste, executa, corrige e aprende automaticamente.

```bash
mcp-lab-agent auto "login flow"
mcp-lab-agent auto "checkout" --max-retries 5
mcp-lab-agent auto "API /users endpoint" --max-retries 2
```

**O que acontece:**
1. Detecta projeto
2. Gera teste usando LLM + aprendizados anteriores
3. Executa o teste
4. Se falhar: analisa (flaky detection), corrige e tenta de novo
5. Aprende: salva correções bem-sucedidas na memória
6. Repete até passar ou atingir `--max-retries` (default: 3)

---

### 7. Estatísticas de aprendizado (stats)

**[NOVO v2.0.0]** Mostra métricas de aprendizado do agente.

```bash
mcp-lab-agent stats
```

**Saída:**
- Total de aprendizados
- Correções bem-sucedidas
- Correções de seletores
- Correções de timing
- Testes gerados
- Taxa de sucesso na 1ª tentativa

---

### 8. Análise completa (analyze)

**[NOVO v2.1.0]** Análise completa: estabilidade + riscos + recomendações.

```bash
mcp-lab-agent analyze
```

**O que acontece:**
1. Detecta estrutura do projeto
2. Analisa estabilidade dos testes (flaky, unstable, stable)
3. Analisa riscos por área de código (high, medium, low)
4. Gera recomendações priorizadas com comandos prontos
5. Calcula nota de saúde do QA (0-100)

---

## 📊 Tabela Resumo

| Onde | Quantidade |
|------|------------|
| Ferramentas MCP (chat) | 29 |
| Comandos CLI (terminal) | 6 (detect, list, route, auto, stats, analyze) |
| Agentes especializados | 10 |
| Frameworks suportados | 15+ |

---

## 📁 Arquivos gerados pelo projeto

| Arquivo | Descrição |
|---------|-----------|
| `.qa-lab-last-failure.log` | Última falha de teste (usado por por_que_falhou) |
| `.qa-lab-metrics.json` | Eventos de execução (métricas) |
| `.qa-lab-memory.json` | **[ATUALIZADO]** Cache de padrões, fluxos e **aprendizados** (correções bem-sucedidas) |
| `.qa-lab-screenshot.png` | Screenshot do web_eval_browser |
| `qa-lab-flows.json` | Fluxos de negócio (opcional, para get_business_metrics) |

---

## 🔗 Documentação relacionada

| Arquivo | Conteúdo |
|---------|----------|
| [README.md](README.md) | Visão geral, quick start, architecture |
| [CLI.md](CLI.md) | Detalhes do CLI |
| [COMO_USAR.md](COMO_USAR.md) | Exemplos e fluxos |
| [FRAMEWORKS.md](FRAMEWORKS.md) | Frameworks suportados |
