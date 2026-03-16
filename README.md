# mcp-lab-agent

MCP server + AI agents para QA automation em **qualquer projeto**. Detecta automaticamente Cypress, Playwright, Jest e a estrutura do seu projeto.

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

| Tool | Descrição |
|------|-----------|
| `detect_project` | Detecta frameworks, pastas de teste, backend, frontend |
| `run_tests` | Executa testes (Cypress, Playwright, Jest, npm test) |
| `read_project` | Lê package.json, specs existentes |
| `generate_tests` | Gera spec com LLM (requer API key) |
| `write_test` | Grava spec no disco |
| `analyze_failures` | Analisa output de falhas |

## Variáveis de ambiente (opcional)

Para usar `generate_tests`, configure no `.env` do projeto:

- **GROQ_API_KEY** — Groq (gratuito): https://console.groq.com/keys
- **GEMINI_API_KEY** — Google Gemini (gratuito): https://aistudio.google.com/apikey
- **OPENAI_API_KEY** — OpenAI (pago): https://platform.openai.com/api-keys

## Exemplo de uso no Cursor

1. Abra seu projeto no Cursor
2. Configure o MCP conforme acima
3. Reinicie o Cursor
4. No chat: "Detecte a estrutura do meu projeto" → usa `detect_project`
5. "Gere um teste para o login" → usa `generate_tests` + `write_test`
6. "Rode os testes" → usa `run_tests`

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
