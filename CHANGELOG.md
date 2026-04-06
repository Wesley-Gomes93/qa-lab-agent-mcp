# Changelog

## [2.3.2] - 2026-04-05

### Added

- JSON run reports (`schemaVersion` 1.0) for CI: `mcp-lab-agent run --json-report [--output FILE]`, optional `--save-baseline` / `--compare-baseline`.
- CLI `mcp-lab-agent audit` to compare two report files (deploy gate).
- CLI `mcp-lab-agent scan` as alias for `detect`.
- MCP tool `run_tests`: optional `writeJsonReport` writes `.qa-lab-reports/latest.json`.
- GitHub Actions CI (lint, build, test), Dependabot, `CONTRIBUTING.md`, `SECURITY.md`, MIT `LICENSE`, `docs/CI_AND_REPORTS.md`.
- ESLint (flat config) for `src/`.

### Fixed

- `flaky-report` exit code: fail when any run fails (not only when flaky).
- `package.json` `repository` / `bugs` / `homepage` now point to `qa-lab-agent-mcp`.

## [2.3.1] - 2026-03-28

### 🐛 Fix: Learning Hub path.join Error

**Problema:**
- Learning Hub falhava com erro `path.join is not a function`
- Variável `path` estava sendo sobrescrita por `url.pathname`

**Correção:**
- Renomeado `path` para `pathname` na linha 55
- Mantém módulo `path` do Node.js funcionando corretamente

## [2.3.0] - 2026-03-28

### 🚀 Múltiplos Testes em Paralelo

**Nova Funcionalidade:**
- Suporte para executar múltiplos testes simultaneamente
- Sintaxe: `mcp-lab-agent auto "teste1, teste2, teste3" --max-retries 3`
- Execução em paralelo para maior velocidade
- Resumo consolidado ao final

**Exemplo:**
```bash
mcp-lab-agent auto "login, cadastro, buscar" --max-retries 3

🤖 Modo autônomo iniciado: 3 testes em paralelo

📋 Testes a executar:
   1. login
   2. cadastro
   3. buscar

✅ 1. login - PASSOU
✅ 2. cadastro - PASSOU
❌ 3. buscar - FALHOU

Total: 3 testes
✅ Passou: 2
❌ Falhou: 1
⏱️  Tempo total: 45s
```

**Benefícios:**
- ⚡ Mais rápido que executar sequencialmente
- 📊 Resumo claro de todos os testes
- 🎯 Prefixo `[Teste N/Total]` para identificar cada teste
- ✅ Exit code 0 se todos passarem, 1 se algum falhar

## [2.2.0] - 2026-03-28

### 🚀 Correção Crítica: Modo Auto Funcionando 100%

**Problema Resolvido:**
- Arquivos de teste eram criados vazios (0 bytes)
- LLM retornava conteúdo mas não era gravado
- Faltava validação de resposta da API

**Correções Implementadas:**

1. **Validação de Resposta do LLM:**
   - Valida se API retornou erro antes de processar
   - Verifica se conteúdo está vazio após receber do LLM
   - Verifica se conteúdo está vazio após parsing (remoção de markdown)
   - Lança erros claros para cada caso

2. **Validação de Escrita de Arquivo:**
   - Verifica tamanho do arquivo após `fs.writeFileSync`
   - Lança erro se arquivo gravado está vazio
   - Adiciona log com tamanho do arquivo em bytes

3. **Suporte ESM Automático:**
   - Detecta `"type": "module"` no package.json
   - Adiciona instrução explícita no prompt: "Use sintaxe ESM (import/export), NÃO use require()"
   - Garante que testes gerados usem `import` em vez de `require`

4. **Correção Automática Implementada:**
   - Remove placeholder "Correção automática ainda não implementada"
   - Implementa correção real via LLM analisando erro e código
   - LLM recebe erro + código atual e gera versão corrigida
   - Aplica correção e tenta novamente

5. **Build Fix:**
   - Adiciona `external: ["playwright", "playwright-core", "chromium-bidi"]` no tsup.config
   - Resolve erro de bundling com dependências do Playwright

**Resultado:**
- ✅ Modo `auto` gera testes com conteúdo real
- ✅ Detecta flaky patterns (timing, selector)
- ✅ Corrige automaticamente via LLM
- ✅ Aprende e salva na memória local
- ✅ Funciona com OpenAI, Groq, Gemini e Ollama

## [2.1.11] - 2026-03-19

### Fix: generate_tests + write_test — arquivos vazios / "No tests found"

- **generate_tests** — Inclui `specContent` no texto retornado (`content`) para que o agente IDE tenha acesso ao código mesmo quando `structuredContent` não é exposto pelo cliente MCP
- **generate_tests** — Valida resposta vazia do LLM e retorna erro claro se API key não configurada ou resposta vazia
- **write_test** — Rejeita `content` vazio com mensagem orientando a chamar `generate_tests` primeiro
- **docs/BUG_REPORT_GENERATE_WRITE_TESTS.md** — Bug report detalhado para referência

## [2.1.9] - 2026-03-19

### run_tests: device e auto-fix de seletor

- **Detecção de device** — `detectDeviceConfig()` lê de `qa-lab-agent.config.json`, `wdio.conf.js`, `.detoxrc.js` ou env (DETOX_CONFIGURATION, APPIUM_UDID)
- **run_tests** — Novos parâmetros: `device` (device/configuration para mobile), `autoFixSelector` (default: true para mobile quando spec informado)
- **Fluxo completo** — Ao rodar teste X: detecta device, executa, e se falhar por seletor aplica correção via LLM e tenta novamente
- **Detox** — `--configuration` adicionado aos args quando device/config detectado
- **Appium** — Env APPIUM_UDID/APPIUM_DEVICE_NAME aplicados quando configurado

## [2.1.8] - 2026-03-19

### Comando flaky-report

- **mcp-lab-agent flaky-report** — Detecta testes flaky rodando a suite N vezes (default: 3)
- Opções: `--runs N`, `--spec FILE`, `--output FILE`
- Identifica intermitência (passou às vezes, falhou às vezes) e causa provável via `detectFlakyPatterns`
- Relatório em Markdown com sugestões (timing, selector, network, etc.)

## [2.1.7] - 2026-03-19

### Top 3 Problemas de QA — Foco e melhorias

**Posicionamento:** *Assistente de teste que aprende com falhas*

- **docs/TOP3_QA_PROBLEMAS_E_ROADMAP.md** — Top 3 problemas validados no mercado: (1) Testes flaky, (2) "Por que falhou?", (3) Manutenção de seletores. Roadmap de melhorias prioritárias.
- **Resumo em 1 frase** — `por_que_falhou` e `generateFailureExplanation` agora exibem resumo executivo no topo: "Falhou porque X. Solução: Y."
- **oneLineFailureSummary** — Nova função em flaky-detection.js para gerar resumo sem LLM (fallback quando padrão detectado).
- **run_tests + explainOnFailure** — Quando `explainOnFailure: true` e testes falham, gera automaticamente explicação completa com resumo em 1 frase.
- **generateFailureExplanation** — Corrigido: função local em index.js que chama LLM e retorna `{ ok, structuredContent }` (antes importava de tool-helpers que retornava apenas prompt).
- **README** — Nova mensagem: "Assistente de teste que aprende com falhas. Reduz tempo de debug, elimina flaky e mantém seletores estáveis."

## [2.1.6] - 2026-03-19

### Slack Bot — Credenciais e documentação

- **Documentação alinhada** à [documentação oficial do Slack](https://docs.slack.dev/app-management/quickstart-app-settings)
- **CREDENTIALS.md** — referência rápida: credencial → onde obter em api.slack.com
- **.env.example** — comentários com caminho exato de cada variável (OAuth & Permissions, App-Level Tokens, Signing Secret)
- **check-config.js** — link para CREDENTIALS.md em erros; suporte a `QA_LAB_MCP_CONFIG`
- **TROUBLESHOOTING** — fluxo completo, lembretes de Reinstall to Workspace, paths exatos
- **@slack/bolt** em `dependencies` (antes optionalDependencies) — garante instalação ao rodar `slack-bot`
- Script `slack-bot:check` no package.json raiz

## [2.1.5] - 2026-03-18

### Learning Hub (cérebro central)
- **API centralizada:** `POST /learning`, `GET /patterns` — acumula aprendizados entre projetos
- **Dashboard web:** Taxa de sucesso, padrões por tipo, recomendações (http://localhost:3847)
- **Sync automático:** Com `LEARNING_HUB_URL` no `.env`, o agente envia learnings ao Hub
- **Comando:** `npx mcp-lab-agent learning-hub`

## [2.1.2] - 2026-03-18

### Slack Bot
- Integração Slack: @qa-bot para análise e testes via chat
- Config simplificada: repo no config ou .env
- Setup script: `npm run setup` no slack-bot

## [2.1.1] - 2026-03-17

### 🔧 Modularização

**Refatoração completa do código**:
- Redução de `index.js` de **3795 para 2792 linhas (-26%)**
- **Estrutura modular**:
  - `src/core/`: llm-router, memory, flaky-detection, project-structure, tool-helpers
  - `src/cli/`: commands (detect, list, route, auto, stats, analyze)
- **Benefícios**: Manutenibilidade, testabilidade, reutilização, clareza, escalabilidade

**Documentação**:
- Adicionado `MODULARIZACAO.md` com detalhes da refatoração

## [2.1.0] - 2026-03-17

### 🎯 Executor + Consultor Inteligente

**Transformação:** Não é mais "executor OU consultor". É **"executor E consultor"** ao mesmo tempo.

#### `qa_full_analysis` — Análise Completa em 1 Comando
- **Executa:** Roda todos os testes (opcional)
- **Analisa:** Estabilidade por teste ("login falha 30% das vezes")
- **Prevê:** Riscos por área do código ("src/payment/ sem testes")
- **Recomenda:** Ações priorizadas (URGENTE, IMPORTANTE, MELHORIA)
- **Nota:** Score 0-100 de saúde do QA
- **Chat:** "Analise e melhore meu QA"

#### Histórico de Execuções
- **Salva cada run:** timestamp, duração, resultado, framework
- **Calcula estabilidade:** "teste X falha Y% das vezes"
- **Detecta regressões:** "antes passava, agora falha"
- **Limite:** 300 execuções (otimizado)

#### Análise de Risco por Área
- **Escaneia código-fonte:** src/, app/, lib/, components/, etc.
- **Detecta gaps:** "área X sem testes"
- **Classifica risco:** ALTO (>10 arquivos), MÉDIO (5-10), BAIXO (<5)
- **Prioriza:** Riscos altos primeiro

#### Recomendações Acionáveis
- **Priorização:** URGENTE (já está falhando), IMPORTANTE (vai falhar), MELHORIA
- **Comandos prontos:** "Corrija X automaticamente"
- **Contexto:** Por que fazer, qual o impacto

### 🔧 Melhorias

- **`run_tests`:** Agora salva histórico de execuções automaticamente
- **Agentes:** `intelligence` expandido (5 ferramentas)

---

## [2.0.1] - 2026-03-17

### 🏢 Suporte Corporativo

#### Ollama (LLMs Locais)
- **100% offline:** Funciona sem APIs externas
- **Detecção automática:** Se nenhuma API key configurada, usa `http://localhost:11434`
- **Configurável:** `OLLAMA_BASE_URL` para servidor interno
- **Compliance:** Dados não saem do ambiente corporativo

#### LLM Customizado
- **Endpoint interno:** `QA_LAB_LLM_BASE_URL` para LLM da empresa
- **API key customizada:** `QA_LAB_LLM_API_KEY`

### 🎯 Ferramentas "Wow" (IA Proativa)

#### `qa_health_check`
- **Diagnóstico completo:** Analisa frameworks, testes, cobertura, aprendizados
- **Nota 0-100:** Score de saúde do QA
- **Recomendações:** Lista ações específicas
- **Chat:** "Faça um health check do QA"

#### `qa_suggest_next_test`
- **IA proativa:** Sugere qual teste criar a seguir
- **Priorização:** HIGH, MEDIUM, LOW
- **Baseado em:** Gaps de cobertura, fluxos críticos, qa-lab-flows.json
- **Chat:** "Sugira qual teste criar"

#### `qa_predict_flaky`
- **Predição:** Analisa testes e prevê quais vão ficar flaky
- **Classificação de risco:** ALTO, MÉDIO, BAIXO
- **Detecta:** Seletores frágeis, waits inadequados, network sem mock
- **Chat:** "Preveja quais testes vão dar problema"

#### `qa_compare_with_industry`
- **Benchmark:** Compara com padrões da indústria
- **Métricas:** Cobertura, taxa de sucesso, total de testes
- **Veredito:** Acima, na média ou abaixo
- **Chat:** "Compare meu projeto com a indústria"

#### `qa_time_travel`
- **Evolução temporal:** Timeline de aprendizados
- **Tendência:** Melhorando, estável ou começando
- **Períodos:** 7d, 30d, all
- **Chat:** "Mostre a evolução do agente nos últimos 30 dias"

### 📚 Documentação

- **CONFIGURACAO_CORPORATIVA.md:** Guia completo para ambientes com APIs bloqueadas
- **COMANDOS_WOW.md:** Comandos que impressionam no chat
- **README:** Seção atualizada com setup do Ollama

---

## [2.0.0] - 2026-03-17

### 🚀 Transformação: Agente Autônomo

**Novo pitch:** Agente autônomo de QA que aprende com os próprios erros.

### ✨ Novas Features

#### 🤖 Modo Autônomo (`qa_auto`)
- **Loop completo:** gera teste → executa → se falhar: analisa, corrige e tenta de novo → aprende
- **Auto-correção:** Usa LLM para analisar falhas e aplicar correções automaticamente
- **Retry inteligente:** Configurável via `--max-retries` (default: 3)
- **Disponível via:**
  - CLI: `mcp-lab-agent auto "login flow" --max-retries 5`
  - MCP chat: "Modo autônomo: gere teste para checkout"

#### 📊 Sistema de Learning
- **Memória de aprendizados:** Salva correções bem-sucedidas em `.qa-lab-memory.json`
- **Melhoria contínua:** Usa aprendizados anteriores para gerar testes mais assertivos
- **Métricas detalhadas:**
  - Total de aprendizados
  - Correções bem-sucedidas
  - Correções de seletores
  - Correções de timing
  - Testes gerados
  - Taxa de sucesso na 1ª tentativa

#### 📈 Comando `stats`
- CLI: `mcp-lab-agent stats`
- MCP tool: `qa_learning_stats`
- Mostra evolução do agente ao longo do tempo

### 🔧 Melhorias

- **CLI expandido:** Novos comandos `auto` e `stats`
- **Help atualizado:** Documentação inline completa
- **Escalabilidade:** Seção no README sobre uso em CI/CD, multi-projeto e métricas exportáveis
- **Diagrama arquitetural:** Atualizado para incluir o loop autônomo e sistema de learning
- **Suporte a Ollama:** LLMs locais (100% offline) para ambientes corporativos
- **LLM customizado:** Suporte a endpoints internos via `QA_LAB_LLM_BASE_URL`

### 📚 Documentação

- **README:** Reescrito com novo pitch e foco em autonomia
- **Seção Escalabilidade:** Como usar em empresas (CI/CD, multi-projeto, métricas)
- **Quick Start:** Prioriza modo autônomo CLI

### 🎯 Diferencial

Antes: Assistente de QA que gera testes
Agora: **Agente autônomo que gera, executa, corrige e aprende**

---

## [1.1.2] - 2026-03-16

### Features anteriores
- Detecção automática de 15+ frameworks
- Geração de testes via LLM (Groq, Gemini, OpenAI)
- Análise de falhas com IA
- Browser mode (Playwright)
- Flaky detection
- Model routing
- Project memory
- Agentes especializados
- CLI básico (detect, route, list)
