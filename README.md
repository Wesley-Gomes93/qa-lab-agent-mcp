# mcp-lab-agent

MCP server + AI agents para QA automation em **qualquer projeto**. Detecta automaticamente frameworks de teste e estrutura do projeto.

## Features

- **Detecção automática** de frameworks:
  - **E2E/UI**: Cypress, Playwright, WebdriverIO
  - **Unit/Integration**: Jest, Vitest, Mocha, Jasmine
  - **Mobile**: Appium, Detox
  - **API**: Supertest, Pactum
  - **Python**: Robot Framework, pytest, Behave
- **Execução de testes** com output estruturado (backend, frontend, mobile, API)
- **Geração de testes** via LLM (Groq, Gemini, OpenAI)
- **Análise de falhas** e sugestões de correção inteligentes
- **Bug reports** automáticos em Markdown
- **Linter** e **coverage** integrados
- **Templates de teste** para API, UI e Unit
- **Zero configuração**: funciona em projetos Node.js e Python

## Instalação e Uso no Cursor

### Opção 1: Build Local (Recomendado para desenvolvimento)

```bash
# Clone e instale
git clone https://github.com/Wesley-Gomes93/mcp-lab-agent
cd mcp-lab-agent
npm install
npm run build

# Configure no ~/.cursor/mcp.json
mkdir -p ~/.cursor
```

Adicione em `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "node",
      "args": ["/caminho/completo/para/mcp-lab-agent/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Opção 2: Instalação Global (Requer sudo)

```bash
cd mcp-lab-agent
sudo npm link
```

Configure no `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "mcp-lab-agent",
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Opção 3: Via npm (Após publicar)

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Reinicie o Cursor** e abra qualquer projeto. O MCP detecta automaticamente a estrutura.

## Ferramentas disponíveis

### Core Tools

| Tool | Descrição |
|------|-----------|
| `detect_project` | Detecta frameworks, pastas de teste, backend, frontend |
| `run_tests` | Executa testes (Cypress, Playwright, Jest, npm test) |
| `read_project` | Lê package.json, specs existentes |
| `generate_tests` | Gera spec com LLM (requer API key) |
| `write_test` | Grava spec no disco |
| `analyze_failures` | Analisa output de falhas e extrai stack traces |

### Novas Ferramentas (v2.0)

| Tool | Descrição |
|------|-----------|
| `suggest_fix` | Sugere correções para falhas detectadas (seletores, asserções, rede) |
| `create_bug_report` | Gera bug report estruturado em Markdown a partir de falhas |
| `list_test_files` | Lista todos os arquivos de teste (filtro por framework/pattern) |
| `run_linter` | Executa ESLint/Prettier com auto-fix opcional |
| `install_dependencies` | Instala dependências (npm/yarn/pnpm - detecta automaticamente) |
| `get_test_coverage` | Gera relatório de cobertura de testes (Jest) |
| `watch_tests` | Inicia testes em watch mode (Jest/Vitest) |
| `create_test_template` | Gera boilerplate de teste (API/UI/Unit) para qualquer framework |

## Variáveis de ambiente (opcional)

Para usar `generate_tests`, configure no `.env` do projeto:

- **GROQ_API_KEY** — Groq (gratuito): https://console.groq.com/keys
- **GEMINI_API_KEY** — Google Gemini (gratuito): https://aistudio.google.com/apikey
- **OPENAI_API_KEY** — OpenAI (pago): https://platform.openai.com/api-keys

## Exemplo de uso no Cursor

### Workflow básico

1. Abra seu projeto no Cursor
2. Configure o MCP conforme acima
3. Reinicie o Cursor
4. No chat: "Detecte a estrutura do meu projeto" → usa `detect_project`
5. "Gere um teste para o login" → usa `generate_tests` + `write_test`
6. "Rode os testes" → usa `run_tests`

### Workflows avançados (v2.0)

**Análise e correção de falhas:**
```
1. "Rode os testes" → run_tests
2. "Analise as falhas" → analyze_failures
3. "Sugira correções" → suggest_fix
4. "Crie um bug report" → create_bug_report
```

**Setup e manutenção:**
```
- "Liste todos os testes de Cypress" → list_test_files
- "Rode o linter com auto-fix" → run_linter
- "Instale as dependências" → install_dependencies
- "Gere coverage dos testes" → get_test_coverage
```

**Criação rápida de testes:**
```
- "Crie um template de teste de API para Playwright" → create_test_template
- "Gere um teste de UI para Cypress" → create_test_template
```

## Publicar no npm

```bash
npm run build
npm login
npm publish
```

Se o nome `mcp-lab-agent` já estiver em uso, use escopo: `@seu-usuario/mcp-lab-agent`.

## Desenvolvimento local

```bash
npm install
npm run build
node dist/index.js  # testa o servidor
```

## Licença

MIT
