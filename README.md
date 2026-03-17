# mcp-lab-agent

[![npm version](https://img.shields.io/npm/v/mcp-lab-agent.svg)](https://www.npmjs.com/package/mcp-lab-agent)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**MCP server** para QA automation em qualquer projeto. Detecta automaticamente frameworks de teste (Cypress, Playwright, Jest, Vitest e mais) e integra com o Cursor IDE via Model Context Protocol.

---

## ✨ Features

| Categoria | Funcionalidades |
|-----------|-----------------|
| **Detecção** | Cypress, Playwright, WebdriverIO, Jest, Vitest, Mocha, Robot Framework, pytest, Behave, Appium, Detox |
| **Execução** | Run tests, watch mode, coverage (Jest) |
| **Geração** | Testes via LLM (Groq, Gemini, OpenAI), templates API/UI/Unit |
| **Análise** | Análise de falhas, suggest_fix, suggest_selector_fix (self-healing) |
| **Relatórios** | Bug reports em Markdown, métricas de negócio |
| **Manutenção** | Linter, install dependencies, list_test_files |

---

## 🚀 Instalação Rápida

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

**2. Reinicie o Cursor**

**3. Use no chat:**

```
"Detecte a estrutura do meu projeto"
"Rode os testes"
"Gere um teste E2E para login"
```

---

## 📚 Documentação

| Guia | Descrição |
|------|-----------|
| [Quick Start](QUICKSTART.md) | Instalação em 2 minutos |
| [Como Usar](COMO_USAR.md) | Exemplos e fluxos completos |
| [Instalação](INSTALL.md) | Opções detalhadas |
| [Setup Cursor](CURSOR_SETUP.md) | Configuração passo a passo |
| [Frameworks](FRAMEWORKS.md) | Frameworks suportados |
| [Troubleshooting](TROUBLESHOOTING.md) | Solução de problemas |

---

## 🧪 Testes e Qualidade

O projeto possui **testes E2E** e **unitários** para garantir estabilidade.

```bash
# Rodar todos os testes
npm test

# Com cobertura
npm run test:coverage

# Relatório JSON
npm run test:report
```

| Métrica | Descrição |
|---------|-----------|
| **E2E** | Comunicação MCP via stdio, ferramentas principais (detect_project, read_file, run_tests, etc.) |
| **Unit** | Detecção em projetos vazios e com Vitest |
| **Relatórios** | `test-results/results.json`, `test-results/QA_REPORT.md`, `coverage/` |

Ver [test-results/QA_REPORT.md](test-results/QA_REPORT.md) para relatório detalhado.

---

## 🔧 Variáveis de Ambiente (opcional)

Para `generate_tests`, `por_que_falhou` e `suggest_selector_fix` (LLM):

| Variável | Provedor |
|----------|----------|
| `GROQ_API_KEY` | Groq (gratuito) |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENAI_API_KEY` | OpenAI |

---

## 📦 Estrutura do Projeto

```
qa-lab-agent-mcp/
├── src/
│   └── index.js          # MCP server (tools, detecção, métricas)
├── dist/                 # Build (tsup)
├── test/
│   ├── e2e/              # Testes end-to-end MCP
│   ├── unit/             # Testes de detecção
│   ├── fixtures/         # Projetos mock para testes
│   └── utils/            # Cliente MCP para testes
├── test-results/         # Relatórios de teste
└── coverage/             # Cobertura
```

---

## 🛠 Desenvolvimento

```bash
git clone https://github.com/Wesley-Gomes93/mcp-lab-agent
cd mcp-lab-agent
npm install
npm run build
npm test
```

---

## 📄 Licença

MIT © Wesley Gomes
