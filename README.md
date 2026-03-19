# mcp-lab-agent

[![npm version](https://img.shields.io/npm/v/mcp-lab-agent.svg)](https://www.npmjs.com/package/mcp-lab-agent)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Executor + Consultor Inteligente de QA.**

Não é só um executor de testes. É um agente que:
- **Executa:** Roda testes, gera, corrige
- **Analisa:** "login falha 30% das vezes"
- **Prevê:** "checkout vai ficar flaky"
- **Recomenda:** "faça isso agora: 1, 2, 3"
- **Aprende:** Taxa de sucesso aumenta com o tempo

**1 comando. Análise completa.**

---

## O diferencial

| Outras ferramentas | **mcp-lab-agent** |
|-------------------|-------------------|
| Só executam | **Executa + Analisa + Recomenda** |
| "teste falhou" | **"login falha 30% das vezes (timing)"** |
| Sem contexto | **"src/payment/ sem testes (RISCO ALTO)"** |
| Você decide o que fazer | **"Faça isso agora: 1, 2, 3"** |
| Sem aprendizado | **Taxa de sucesso aumenta com o tempo** |

**Modo autônomo:**

```bash
npx mcp-lab-agent auto "login flow" --max-retries 5
```

O agente:
1. Detecta seu projeto (Cypress, Playwright, Jest, etc.)
2. Gera o teste com base em aprendizados anteriores
3. Executa o teste
4. Se falhar: analisa, corrige e tenta de novo
5. Aprende com cada correção para melhorar nas próximas

**Resultado:** Testes que passam na primeira tentativa aumentam com o tempo.

---

## Quick Start

### Análise Completa (CLI)

```bash
# Análise completa: executa, analisa, prevê e recomenda
npx mcp-lab-agent analyze

# Modo autônomo: gera, roda, corrige e aprende
npx mcp-lab-agent auto "login flow" --max-retries 5

# Ver métricas de aprendizado
npx mcp-lab-agent stats

# Relatório de evolução (recomendações para aprimorar o código)
npx mcp-lab-agent report --full
```

### Slack Bot (sem clonar o projeto)

```bash
npx mcp-lab-agent slack-bot
```

Configure `~/.cursor/mcp.json`. **Socket Mode** (recomendado para PC corporativo, sem firewall):

```json
{
  "qa-lab-agent": {
    "slack": {
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "useLocal": true
    }
  }
}
```

Para HTTP (ngrok): use `signingSecret` em vez de `appToken`. Ver [slack-bot/README.md](slack-bot/README.md) e [TROUBLESHOOTING.md](slack-bot/TROUBLESHOOTING.md).

### Integração com IDE (Cursor/Cline/Windsurf)

**1. Configure o MCP** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent@latest"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**2. Use no chat:**

```
"Detecte a estrutura do meu projeto"
"Modo autônomo: gere teste para login"
"Rode os testes"
"Por que o teste falhou?"
"Avalie http://localhost:3000 no browser"
"Mostre as estatísticas de aprendizado"
"Relatório de evolução e aprendizado"
```

---

## Architecture

O diagrama abaixo mostra como o agente autônomo funciona:

```mermaid
flowchart TB
    subgraph IDE["🖥️ IDE (Cursor, Cline, Windsurf)"]
        Chat[Chat do usuário]
    end

    subgraph CLI["💻 CLI (Terminal)"]
        Auto["mcp-lab-agent auto"]
        Stats["mcp-lab-agent stats"]
        Report["mcp-lab-agent report"]
    end

    subgraph MCP["MCP Protocol (stdio)"]
        Transport[Stdio Transport]
    end

    subgraph Agent["mcp-lab-agent"]
        Router[qa_route_task]
        AutoTool["qa_auto<br/>(Loop autônomo)"]
        
        subgraph Agents["Agentes Especializados"]
            D[detection<br/>detect_project, read_project, list_test_files]
            E[execution<br/>run_tests, watch_tests, get_test_coverage]
            G[generation<br/>generate_tests, write_test, map_mobile_elements]
            A[analysis<br/>analyze_failures, por_que_falhou, suggest_selector_fix, analyze_file_methods]
            B[browser<br/>web_eval_browser]
            R[reporting<br/>create_bug_report, get_business_metrics]
            L[learning<br/>qa_learning_stats, get_learning_report, qa_time_travel]
        end

        subgraph Brain["🧠 Núcleo Inteligente"]
            MR[Model Router<br/>simples → Groq/Flash | complexo → 70B/Pro]
            PM[Project Memory<br/>.qa-lab-memory.json]
            FD[Flaky Detection<br/>element_not_rendered, visible, stale, selector, timing]
            LS[Learning System<br/>correções por tipo + relatório de evolução]
        end
    end

    subgraph External["Externo"]
        LLM[LLM: Groq / Gemini / OpenAI]
        PW[Playwright optional]
        Proj[Seu projeto]
    end

    Chat --> Transport
    Transport --> Router
    Router --> AutoTool
    Router --> D & E & G & A & B & R & L

    Auto --> AutoTool
    Stats --> L
    Report --> L

    AutoTool --> G
    AutoTool --> E
    AutoTool --> A
    AutoTool --> LS

    D & E & G & A & R --> Proj
    B --> PW
    B --> Proj

    G & A --> MR
    MR --> LLM
    G & A & AutoTool --> PM
    A & AutoTool --> FD
    AutoTool --> LS
    LS --> PM
```

**Fluxo autônomo (qa_auto):**
1. **Detecta** projeto (frameworks, pastas, fluxos)
2. **Gera** teste usando LLM + memória de aprendizados
3. **Executa** o teste
4. **Se falhar:** analisa (flaky detection), corrige e tenta de novo
5. **Aprende:** salva correções bem-sucedidas na memória
6. **Repete** até passar ou atingir max_retries

**Fluxo resumido (IDE):**
1. **Usuário** fala no chat do IDE
2. **MCP** entrega a mensagem ao `mcp-lab-agent`
3. **qa_route_task** sugere o agente certo (detection, execution, generation, etc.)
4. **Ferramentas** executam no projeto (detectar, rodar, gerar, analisar)
5. **Model Router** escolhe o modelo: tarefas simples → barato; complexas → mais capaz
6. **Project Memory** guarda padrões e fluxos para próximas gerações
7. **Flaky Detection** identifica testes intermitentes e sugere correções

---

## Features

| Categoria | O que faz |
|-----------|-----------|
| **🤖 Autônomo** | `qa_auto` — loop completo: gera, roda, corrige, aprende (até passar ou max_retries) |
| **📊 Learning** | Taxa de sucesso, relatório de evolução (`get_learning_report`), padrões por tipo (element_not_rendered, timing, etc.) |
| **Detecção** | Cypress, Playwright, WebdriverIO, Jest, Vitest, Mocha, Robot, pytest, Behave, Appium, Detox |
| **Execução** | run_tests, watch, coverage (Jest/Vitest) |
| **Geração** | Testes via LLM, map_mobile_elements, templates (waits inteligentes + assert final obrigatório) |
| **Análise** | analyze_failures, por_que_falhou, suggest_fix, suggest_selector_fix, analyze_file_methods |
| **Browser** | web_eval_browser — screenshots, network, console (Playwright opcional) |
| **Relatórios** | Bug reports em Markdown, métricas de negócio |
| **Flaky-aware** | Detecta timing, selector, network, element_not_rendered, element_not_visible, element_stale; mensagens adaptadas ao erro |
| **Inteligência** | qa_full_analysis, qa_health_check, qa_suggest_next_test, qa_predict_flaky, qa_compare_with_industry, qa_time_travel |
| **Model routing** | Tarefas simples → modelo barato; complexas → modelo forte |
| **Memória** | Cache em .qa-lab-memory.json, qa-lab-flows.json |
| **Inteligência** | qa_full_analysis, qa_health_check, qa_suggest_next_test, qa_predict_flaky, qa_compare_with_industry, qa_time_travel |

---

## CLI

```bash
mcp-lab-agent [comando]
```

| Comando | Descrição |
|---------|-----------|
| *(sem args)* | Inicia o servidor MCP (modo padrão para o IDE) |
| `slack-bot` | Slack Bot (QA via @mention). Funciona em PC corporativo (Socket Mode) |
| `analyze` | Análise completa: executa, analisa estabilidade, prevê riscos, recomenda ações |
| `auto <descrição> [--max-retries N]` | Modo autônomo: gera, roda, corrige e aprende (default: 3 tentativas) |
| `stats` | Estatísticas de aprendizado (taxa de sucesso, correções por tipo) |
| `report [--full]` | Relatório de evolução e aprendizado (--full = recomendações para aprimorar código) |
| `detect [--json]` | Detecta frameworks e estrutura do projeto |
| `route <tarefa>` | Sugere qual ferramenta usar |
| `list` | Lista agentes e ferramentas disponíveis |
| `--help` | Mostra ajuda |

**Exemplos:**
```bash
mcp-lab-agent slack-bot
mcp-lab-agent analyze
mcp-lab-agent auto "login flow" --max-retries 5
mcp-lab-agent stats
mcp-lab-agent report --full
mcp-lab-agent detect
mcp-lab-agent route "rodar os testes"
mcp-lab-agent list
```

Referência completa do CLI: `mcp-lab-agent --help`

---

## Escalabilidade

### Como o mcp-lab-agent escala para empresas

**1. Multi-projeto:**
- Cada projeto tem sua própria memória (`.qa-lab-memory.json`)
- Aprendizados são isolados por contexto
- Suporte a monorepos (detecta múltiplos frameworks)

**2. CI/CD:**
```yaml
# .github/workflows/qa.yml
- run: npx mcp-lab-agent auto "smoke tests" --max-retries 2
- run: npx mcp-lab-agent stats
```

**3. Métricas exportáveis:**
- `.qa-lab-memory.json` pode ser lido por dashboards
- `stats` retorna JSON estruturado
- Integração com Grafana/DataDog via script

**4. Aprendizado compartilhado (roadmap):**
- Exportar/importar memórias entre projetos
- Central de aprendizados da empresa
- Padrões globais + overrides locais

**5. Customização:**
- `qa-lab-flows.json` para fluxos de negócio específicos
- Variáveis de ambiente para modelos customizados
- Extensível via MCP tools

---

## Configuração

### Opção 1: APIs Externas (Groq, Gemini, OpenAI)

```bash
# .env
GROQ_API_KEY=sua-key  # Gratuito: https://console.groq.com/keys
```

### Opção 2: Ollama (Local, Sem Internet) ⭐ Recomendado para empresas

```bash
# 1. Instale o Ollama
brew install ollama  # macOS
# ou: curl -fsSL https://ollama.com/install.sh | sh  # Linux

# 2. Baixe o modelo
ollama pull llama3.1:8b

# 3. Inicie
ollama serve

# 4. Pronto! O agente detecta automaticamente
npx mcp-lab-agent auto "login flow"
```

**100% offline. Sem APIs externas. Ideal para ambientes corporativos.**

### Opção 3: LLM Interno da Empresa

```bash
# .env
QA_LAB_LLM_BASE_URL=https://llm-interno.empresa.com/v1
QA_LAB_LLM_API_KEY=sua-key-interna
```

### Variáveis de ambiente (todas opcionais)

| Variável | Uso |
|----------|-----|
| `GROQ_API_KEY` | Groq (gratuito, rápido) |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENAI_API_KEY` | OpenAI |
| `OLLAMA_BASE_URL` | Ollama customizado (default: http://localhost:11434) |
| `QA_LAB_LLM_BASE_URL` | Endpoint LLM customizado (empresa) |
| `QA_LAB_LLM_API_KEY` | API key para LLM customizado |
| `QA_LAB_LLM_SIMPLE` | Modelo para tarefas simples |
| `QA_LAB_LLM_COMPLEX` | Modelo para tarefas complexas |

### Modo browser (opcional)

Para `web_eval_browser`:

```bash
npm install playwright
```

---

## Documentação

- **[CHANGELOG.md](CHANGELOG.md)** — Histórico de versões
- **[slack-bot/README.md](slack-bot/README.md)** — Configuração do Slack Bot (Socket Mode, HTTP, ambientes corporativos)

---

## Desenvolvimento

```bash
git clone https://github.com/Wesley-Gomes93/mcp-lab-agent
cd mcp-lab-agent
npm install
npm run build
npm test
```

| Script | Descrição |
|--------|-----------|
| `npm run build` | Build com tsup |
| `npm test` | Testes (Vitest) |
| `npm run test:coverage` | Cobertura |
| `npm run dev` | Build em watch |

---

## Licença

MIT © Wesley Gomes
