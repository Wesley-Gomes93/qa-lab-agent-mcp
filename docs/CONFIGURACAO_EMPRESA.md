# 🔧 Configuração para Empresa — mcp-lab-agent + Slack

Guia de como configurar o mcp-lab-agent para uso corporativo: **cliente MCP** e **Slack**.

---

## 1. O que precisa ser configurado

| Uso | Onde | Arquivo |
|-----|------|---------|
| **chat da IDE** | Máquina do dev | `~/.config/mcp-lab-agent/mcp.json` |
| **Slack Bot** | Servidor/projeto | `qa-lab-agent.config.json` + `.env` |

---

## 2. Passo 1: cliente MCP — cada dev

Cada desenvolvedor adiciona no **`~/.config/mcp-lab-agent/mcp.json`**:

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

**Ou** referenciando a config do projeto:

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent@latest"],
      "cwd": "${workspaceFolder}",
      "env": {
        "QA_LAB_CONFIG": "${workspaceFolder}/qa-lab-agent.config.json"
      }
    }
  }
}
```

---

## 3. Passo 2: Slack Bot — servidor da empresa

### 3.1 Arquivo de config (versionável)

Edite **`qa-lab-agent.config.json`** na raiz do projeto:

```json
{
  "slack": {
    "repo": "https://github.com/SUA_EMPRESA/projeto.git",
    "branch": "main"
  }
}
```

**Ou** defina no `.env`: `REPO_URL=...` e `REPO_BRANCH=main`

---

### 3.2 Arquivo de secrets (não versionar)

Crie **`.env`** (adicione ao `.gitignore`):

```env
# Slack — pegar em api.slack.com/apps → sua app
SLACK_BOT_TOKEN=xoxb-1234-5678-...
SLACK_SIGNING_SECRET=abc123def456...

# LLM — para mcp-lab-agent usar nos jobs
GROQ_API_KEY=gsk_...
# ou GEMINI_API_KEY=...
# ou para ambiente corporativo: QA_LAB_LLM_BASE_URL + QA_LAB_LLM_API_KEY

# Redis (fila de jobs)
REDIS_URL=redis://localhost:6379
```

---

### 3.3 Exemplo .env.example (versionável)

```env
# Copie para .env e preencha os valores

# Slack (api.slack.com/apps)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# LLM
GROQ_API_KEY=
# GEMINI_API_KEY=
# ou QA_LAB_LLM_BASE_URL= e QA_LAB_LLM_API_KEY=

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 4. Resumo: o que fica onde

```
~/.config/mcp-lab-agent/mcp.json          → cada dev (IDE)
qa-lab-agent.config.json    → projeto/repo (config estrutural)
.env                        → servidor (secrets, não versionar)
.env.example                → template versionado
```

---

## 5. Checklist para a empresa

**Antes de criar o Slack Bot:**

- [ ] mcp-lab-agent publicado no npm (`mcp-lab-agent@latest`)
- [ ] Ou usar path local: `"command": "node", "args": ["/caminho/qa-lab-agent-mcp/dist/index.js"]`

**Config IDE (por dev):**

- [ ] `~/.config/mcp-lab-agent/mcp.json` com entrada `qa-lab-agent`
- [ ] `cwd` apontando para `${workspaceFolder}`

**Config Slack (servidor):**

- [ ] Slack App criada em api.slack.com
- [ ] `qa-lab-agent.config.json` com `channels` e `defaultRepo`
- [ ] `.env` com `SLACK_BOT_TOKEN` e `SLACK_SIGNING_SECRET`
- [ ] Event Subscriptions com URL pública HTTPS
- [ ] Redis (ou fila em memória para testes)

---

## 6. Referência entre configs

O `mcp.json` da IDE e o `qa-lab-agent.config.json` do Slack são independentes:

| Config | Usado por | Conteúdo |
|--------|-----------|----------|
| `~/.config/mcp-lab-agent/mcp.json` | IDE | Como iniciar o MCP (command, args, cwd) |
| `qa-lab-agent.config.json` | Slack Bot | Canais, repos, comando do mcp-lab-agent |

O Slack Bot usa `qa-lab-agent.config.json` para saber qual repo usar em cada canal. A IDE usa `mcp.json` para saber como rodar o agente no workspace atual.
