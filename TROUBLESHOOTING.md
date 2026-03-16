# 🔧 Troubleshooting - mcp-lab-agent

## ❌ Problema: "No MCP Tools" no Cursor

### Causa 1: JSON duplicado ou malformado

**Sintoma:** O arquivo `~/.cursor/mcp.json` tem `"mcpServers"` duplicado

**Solução:**

```bash
# Verifique o arquivo
cat ~/.cursor/mcp.json

# Se estiver duplicado, corrija com:
cat > ~/.cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "qa-lab": {
      "command": "node",
      "args": ["/Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
EOF
```

### Causa 2: Cursor não foi reiniciado

**Solução:**
1. Feche **TODAS** as janelas do Cursor (Cmd+Q)
2. Abra o Cursor novamente
3. Aguarde 10-15 segundos para o MCP carregar

### Causa 3: Caminho incorreto

**Solução:**

```bash
# Verifique se o arquivo existe
ls -l /Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js

# Se não existir, faça o build
cd /Users/wesleyluiz/Desktop/mcp-lab-agent
npm run build
```

### Causa 4: Permissões do arquivo

**Solução:**

```bash
chmod +x /Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js
```

---

## ❌ Problema: MCP carrega mas não funciona

### Verificar logs do Cursor

1. Abra o Cursor
2. Menu: **Help → Toggle Developer Tools**
3. Vá na aba **Console**
4. Procure por erros relacionados a "mcp" ou "qa-lab"

### Testar o servidor manualmente

```bash
cd /Users/wesleyluiz/Desktop/mcp-lab-agent
./test-server.sh
```

Se algum teste falhar, corrija o problema indicado.

---

## ❌ Problema: Erro "command not found: node"

**Solução:**

```bash
# Encontre o caminho do Node
which node

# Use o caminho completo no mcp.json
# Exemplo: /usr/local/bin/node ou /opt/homebrew/bin/node
```

Atualize `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

---

## ❌ Problema: MCP não detecta testes

**Causa:** O projeto não tem frameworks de teste instalados

**Solução:**

```bash
# Verifique se o projeto tem Cypress, Playwright ou Jest
cd seu-projeto
cat package.json | grep -E "cypress|playwright|jest"

# Se não tiver, instale um:
npm install -D cypress
# ou
npm install -D @playwright/test
# ou
npm install -D jest
```

---

## ✅ Checklist de Verificação Rápida

Execute este checklist:

```bash
# 1. Verificar Node.js
node --version
# Deve mostrar v18 ou superior

# 2. Verificar build
ls -l /Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js
# Deve existir e ter permissão de execução (rwxr-xr-x)

# 3. Verificar mcp.json
cat ~/.cursor/mcp.json
# Deve ter JSON válido sem duplicações

# 4. Testar servidor
cd /Users/wesleyluiz/Desktop/mcp-lab-agent
./test-server.sh
# Todos os testes devem passar

# 5. Verificar sintaxe
node --check /Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js
# Não deve mostrar erros
```

---

## 🔍 Debug Avançado

### Testar o MCP manualmente

```bash
cd /Users/wesleyluiz/Desktop/mcp-lab-agent

# Iniciar o servidor (vai ficar aguardando input)
node dist/index.js

# Em outro terminal, envie uma mensagem de teste
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js
```

Se funcionar, o problema está na configuração do Cursor.

### Verificar se o Cursor está lendo o mcp.json

```bash
# Verificar se o arquivo existe
ls -la ~/.cursor/mcp.json

# Verificar permissões
ls -l ~/.cursor/mcp.json
# Deve ser legível (rw-r--r--)

# Verificar conteúdo
cat ~/.cursor/mcp.json | python3 -m json.tool
# Deve mostrar JSON válido formatado
```

---

## 📞 Ainda não funciona?

1. **Execute o teste completo:**
   ```bash
   cd /Users/wesleyluiz/Desktop/mcp-lab-agent
   ./test-server.sh
   ```

2. **Verifique os logs do Cursor:**
   - Help → Toggle Developer Tools → Console
   - Procure por erros em vermelho

3. **Tente a instalação global:**
   ```bash
   cd /Users/wesleyluiz/Desktop/mcp-lab-agent
   ./link-global.sh
   ```

4. **Crie uma issue no GitHub:**
   - https://github.com/Wesley-Gomes93/mcp-lab-agent/issues
   - Inclua:
     - Output de `./test-server.sh`
     - Conteúdo de `~/.cursor/mcp.json`
     - Logs do Cursor (Developer Tools)
     - Versão do Node: `node --version`
     - Sistema operacional

---

## ✅ Configuração Correta Final

Arquivo `~/.cursor/mcp.json` deve estar assim:

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

**Importante:**
- ✅ Apenas UM `"mcpServers"` no arquivo
- ✅ Caminho completo e correto para `dist/index.js`
- ✅ JSON válido (sem vírgulas extras, aspas corretas)
- ✅ Cursor reiniciado completamente após mudanças
