# mcp-lab-agent

[![npm version](https://img.shields.io/npm/v/mcp-lab-agent.svg)](https://www.npmjs.com/package/mcp-lab-agent)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Assistente de QA com IA que roda direto no seu IDE.** Detecta frameworks automaticamente, gera testes, analisa falhas e avalia apps em browser — sem configuração complexa.

---

## Por que mcp-lab-agent?

| web-eval-agent | agentic-qe | **mcp-lab-agent** |
|----------------|------------|-------------------|
| Browser + network ✅ | 60 agentes, routing | **Tudo isso + zero config** |
| Python, uv, API key | CLI complexo, muitas deps | **npm install, 2 minutos** |
| Projeto descontinuado | Foco em Claude Code | **Cursor, Cline, Windsurf, qualquer MCP** |
| — | — | **Detecção automática de 15+ frameworks** |
| — | — | **Flaky detection + model routing** |
| — | — | **Memória de projeto + agentes especializados** |

**Em 2 minutos** você tem detecção, execução, geração com IA, análise de falhas, modo browser e métricas.

---

## Quick Start

```bash
# Teste o CLI antes de configurar (opcional)
npx mcp-lab-agent detect
```

**1. Configure o MCP no Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**2. Reinicie o Cursor e use no chat:**

```
"Detecte a estrutura do meu projeto"
"Rode os testes"
"Gere um teste E2E para login"
"Por que o teste falhou?"
"Avalie http://localhost:3000 no browser"
```

---

## Architecture

O diagrama abaixo mostra como o mcp-lab-agent conecta IDE, ferramentas especializadas e LLMs em um fluxo único:

```mermaid
flowchart TB
    subgraph IDE["🖥️ IDE (Cursor, Cline, Windsurf)"]
        Chat[Chat do usuário]
    end

    subgraph MCP["MCP Protocol (stdio)"]
        Transport[Stdio Transport]
    end

    subgraph Agent["mcp-lab-agent"]
        Router[qa_route_task]
        
        subgraph Agents["Agentes Especializados"]
            D[detection<br/>detect_project, read_project, list_test_files]
            E[execution<br/>run_tests, watch_tests, get_test_coverage]
            G[generation<br/>generate_tests, write_test]
            A[analysis<br/>analyze_failures, por_que_falhou, suggest_selector_fix]
            B[browser<br/>web_eval_browser]
            R[reporting<br/>create_bug_report, get_business_metrics]
        end

        subgraph Brain["🧠 Núcleo"]
            MR[Model Router<br/>simples → Groq/Flash | complexo → 70B/Pro]
            PM[Project Memory<br/>.qa-lab-memory.json]
            FD[Flaky Detection<br/>timing, selector, network]
        end
    end

    subgraph External["Externo"]
        LLM[LLM: Groq / Gemini / OpenAI]
        PW[Playwright optional]
        Proj[Seu projeto]
    end

    Chat --> Transport
    Transport --> Router
    Router --> D & E & G & A & B & R

    D & E & G & A & R --> Proj
    B --> PW
    B --> Proj

    G & A --> MR
    MR --> LLM
    G & A --> PM
    A --> FD
```

**Fluxo resumido:**
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
| **Detecção** | Cypress, Playwright, WebdriverIO, Jest, Vitest, Mocha, Robot, pytest, Behave, Appium, Detox |
| **Execução** | run_tests, watch, coverage (Jest/Vitest) |
| **Geração** | Testes via LLM (Groq, Gemini, OpenAI), templates |
| **Análise** | analyze_failures, por_que_falhou, suggest_fix, suggest_selector_fix |
| **Browser** | web_eval_browser — screenshots, network, console (Playwright opcional) |
| **Relatórios** | Bug reports em Markdown, métricas de negócio |
| **Flaky-aware** | Detecta timing, selector, network; sugere retries |
| **Model routing** | Tarefas simples → modelo barato; complexas → modelo forte |
| **Memória** | Cache em .qa-lab-memory.json, qa-lab-flows.json |

---

## CLI

```bash
mcp-lab-agent [comando]
```

| Comando | Descrição |
|---------|-----------|
| *(sem args)* | Inicia o servidor MCP (modo padrão para o IDE) |
| `detect` | Detecta frameworks e estrutura do projeto (JSON) |
| `route <tarefa>` | Sugere qual ferramenta usar |
| `list` | Lista agentes e ferramentas disponíveis |
| `--help` | Mostra ajuda |

**Exemplos:**
```bash
mcp-lab-agent detect
mcp-lab-agent route "rodar os testes"
mcp-lab-agent route "gerar teste de login"
mcp-lab-agent list
```

Referência completa do CLI: `mcp-lab-agent --help`

---

## Configuração

### Variáveis de ambiente (opcional)

| Variável | Uso |
|----------|-----|
| `GROQ_API_KEY` | Groq (gratuito, rápido) |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENAI_API_KEY` | OpenAI |
| `QA_LAB_LLM_SIMPLE` | Modelo para tarefas simples (ex: gemini-1.5-flash) |
| `QA_LAB_LLM_COMPLEX` | Modelo para tarefas complexas (ex: gpt-4o) |

### Modo browser (opcional)

Para `web_eval_browser`:

```bash
npm install playwright
```

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
