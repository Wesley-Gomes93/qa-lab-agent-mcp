# mcp-lab-agent

MCP server + AI agents para QA automation em **qualquer projeto**. Detecta automaticamente frameworks de teste e estrutura do projeto.

## 📚 Documentação Rápida

| Guia | Descrição |
|------|-----------|
| 🚀 **[Quick Start](QUICKSTART.md)** | Instale em 2 minutos e comece a usar |
| 📖 **[Como Usar](COMO_USAR.md)** | Guia completo de uso com exemplos |
| 🧪 **[Teste Comigo](TESTE_COMIGO.md)** | Roteiro para testar e dar feedback |
| 🔧 **[Instalação](INSTALL.md)** | Opções detalhadas de instalação |
| ⚙️ **[Setup Cursor](CURSOR_SETUP.md)** | Configuração passo a passo |
| 🚨 **[Troubleshooting](TROUBLESHOOTING.md)** | Solução de problemas |
| 🎯 **[Frameworks](FRAMEWORKS.md)** | Frameworks suportados |

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

### 🚀 Instalação Rápida (Recomendado)

**1. Configure o MCP no Cursor:**

Edite ou crie o arquivo `~/.cursor/mcp.json`:

```bash
mkdir -p ~/.cursor
nano ~/.cursor/mcp.json
```

**2. Adicione a configuração:**

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

**3. Reinicie o Cursor**

**4. Pronto!** Abra qualquer projeto e use normalmente no chat.

---

### 📦 Outras Opções de Instalação

<details>
<summary>Opção 1: Build Local (para desenvolvimento)</summary>

```bash
# Clone e instale
git clone https://github.com/Wesley-Gomes93/mcp-lab-agent
cd mcp-lab-agent
npm install
npm run build
```

Configure no `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "node",
      "args": ["/caminho/completo/para/mcp-lab-agent/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Nota:** Substitua `/caminho/completo/para/mcp-lab-agent` pelo caminho real no seu sistema.

</details>

<details>
<summary>Opção 2: Instalação Global com npm link</summary>

```bash
cd mcp-lab-agent
sudo npm link
```

Configure no `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "mcp-lab-agent",
      "cwd": "${workspaceFolder}"
    }
  }
}
```

</details>

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

## Como Usar

### 💬 Conversação Natural

**Você não precisa saber comandos especiais!** Apenas converse naturalmente com o Cursor:

```
"Detecte a estrutura do meu projeto"
"Gere um teste para o fluxo de login"
"Rode os testes"
"Analise as falhas e sugira correções"
"Crie um bug report das falhas"
```

O Cursor **automaticamente** identifica quando usar as ferramentas do MCP. Você não precisa mencionar nomes de ferramentas ou fazer configurações especiais.

### 🎯 Exemplos Práticos

**Começando em um projeto novo:**
```
Você: "Quais frameworks de teste estão instalados aqui?"
Cursor: [usa detect_project automaticamente]

Você: "Gere um teste E2E para o cadastro de usuários"
Cursor: [usa generate_tests + write_test]

Você: "Rode os testes"
Cursor: [usa run_tests]
```

**Analisando falhas:**
```
Você: "Os testes falharam, me ajude a entender o que aconteceu"
Cursor: [usa analyze_failures + suggest_fix]

Você: "Crie um relatório dessas falhas"
Cursor: [usa create_bug_report]
```

**Manutenção do projeto:**
```
Você: "Liste todos os testes de Cypress"
Cursor: [usa list_test_files]

Você: "Rode o linter e corrija os problemas"
Cursor: [usa run_linter com auto-fix]

Você: "Gere um relatório de cobertura"
Cursor: [usa get_test_coverage]
```

### 🔧 Ferramentas Disponíveis (para referência)

Você não precisa chamar essas ferramentas diretamente, mas é útil saber o que está disponível:

| Categoria | Ferramentas |
|-----------|-------------|
| **Detecção** | `detect_project`, `read_project`, `list_test_files` |
| **Execução** | `run_tests`, `watch_tests`, `get_test_coverage` |
| **Geração** | `generate_tests`, `write_test`, `create_test_template` |
| **Análise** | `analyze_failures`, `suggest_fix`, `create_bug_report` |
| **Manutenção** | `run_linter`, `install_dependencies` |

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
