# 🚀 Como Instalar e Usar o mcp-lab-agent

Você tem **3 opções** para usar o MCP no Cursor:

---

## ✅ Opção 1: Usar o Build Local (MAIS SIMPLES - Recomendado)

Esta opção **não precisa de npm link** e já está funcionando!

### Configure no Cursor:

Edite `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "node",
      "args": ["/Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Pronto!** Reinicie o Cursor e comece a usar.

---

## ⚡ Opção 2: Usar npm link (Requer sudo)

Se você quiser usar o comando `mcp-lab-agent` globalmente:

```bash
cd /Users/wesleyluiz/Desktop/mcp-lab-agent
sudo npm link
```

Depois configure no Cursor:

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

---

## 📦 Opção 3: Publicar no npm e usar npx

### 3.1 Publicar no npm:

```bash
cd /Users/wesleyluiz/Desktop/mcp-lab-agent

# Fazer login no npm (se ainda não fez)
npm login

# Publicar
npm run build
npm publish
```

### 3.2 Configurar no Cursor:

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

---

## 🎯 Qual opção escolher?

| Opção | Vantagens | Desvantagens |
|-------|-----------|--------------|
| **1. Build Local** | ✅ Mais simples<br>✅ Não precisa de sudo<br>✅ Já funciona | ❌ Caminho absoluto<br>❌ Só funciona neste computador |
| **2. npm link** | ✅ Comando global<br>✅ Fácil de usar | ❌ Precisa de sudo<br>❌ Só funciona neste computador |
| **3. npm publish** | ✅ Funciona em qualquer lugar<br>✅ Fácil de compartilhar<br>✅ Atualizações automáticas | ❌ Precisa publicar no npm<br>❌ Nome pode estar ocupado |

---

## 🚀 Recomendação

**Para testar agora:** Use a **Opção 1** (Build Local)

**Para usar em produção:** Use a **Opção 3** (npm publish)

---

## 📝 Passos para começar (Opção 1 - Recomendada)

### 1. Crie/edite o arquivo de configuração do Cursor:

```bash
mkdir -p ~/.cursor
nano ~/.cursor/mcp.json
```

### 2. Cole esta configuração:

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "node",
      "args": ["/Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### 3. Salve e saia:
- No nano: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4. Reinicie o Cursor

### 5. Teste em qualquer projeto:

Abra um projeto no Cursor e digite no chat:

```
Detecte a estrutura do meu projeto
```

---

## ✅ Verificar se está funcionando

1. Abra o Cursor
2. Abra o chat (Cmd+L)
3. Clique no ícone de ferramentas (🔧)
4. Procure por "qa-lab"
5. Você deve ver as 6 ferramentas disponíveis

---

## 🆘 Problemas?

Execute o script de teste:

```bash
cd /Users/wesleyluiz/Desktop/mcp-lab-agent
./test-server.sh
```

Veja mais detalhes em `CURSOR_SETUP.md`
