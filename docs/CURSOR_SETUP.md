# 🎯 Configuração do Cursor - mcp-lab-agent

## Passo a Passo para Configurar o MCP no Cursor

### Opção 1: Usando o Build Local (Recomendado para Teste)

1. **Localize ou crie o arquivo de configuração do Cursor:**

   ```bash
   # Crie o diretório se não existir
   mkdir -p ~/.cursor
   
   # Edite o arquivo de configuração
   nano ~/.cursor/mcp.json
   ```

2. **Adicione a seguinte configuração:**

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

   **Importante:** Use o caminho absoluto completo para `dist/index.js`

3. **Salve o arquivo:**
   - No nano: `Ctrl+O`, `Enter`, `Ctrl+X`
   - No vim: `:wq`

4. **Reinicie o Cursor completamente:**
   - Feche todas as janelas do Cursor
   - Abra novamente

### Opção 2: Usando npx (Após Publicar no npm)

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

### Opção 3: Usando GitHub (Antes de Publicar no npm)

```json
{
  "mcpServers": {
    "qa-lab": {
      "command": "npx",
      "args": ["-y", "github:Wesley-Gomes93/mcp-lab-agent"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

## Verificando se Funcionou

### 1. Verificar se o MCP está carregado

1. Abra o Cursor
2. Abra qualquer projeto
3. Abra o chat do Cursor (Cmd+L ou Ctrl+L)
4. Clique no ícone de ferramentas (🔧) ou procure por "Tools"
5. Você deve ver as ferramentas do `qa-lab`:
   - `detect_project`
   - `run_tests`
   - `read_project`
   - `generate_tests`
   - `write_test`
   - `analyze_failures`

### 2. Testar o MCP

Digite no chat do Cursor:

```
Detecte a estrutura do meu projeto
```

O MCP deve responder com informações sobre:
- Frameworks de teste detectados
- Pastas de teste encontradas
- Backend/Frontend detectado

### 3. Exemplos de Comandos

```
# Detectar estrutura
"Detecte a estrutura do meu projeto"

# Ler informações do projeto
"Leia o package.json e mostre os testes existentes"

# Executar testes
"Rode os testes do projeto"
"Rode os testes do Cypress"
"Execute o teste cypress/e2e/login.cy.js"

# Gerar testes (requer API key no .env)
"Gere um teste para o fluxo de login"
"Crie um teste de API para o endpoint /users"
"Gere testes E2E para o cadastro de produtos"

# Analisar falhas
"Analise as falhas do último teste"
```

## Troubleshooting

### ❌ MCP não aparece no Cursor

**Solução:**
1. Verifique se o arquivo `~/.cursor/mcp.json` está correto
2. Verifique se o caminho para `dist/index.js` está correto
3. Reinicie o Cursor **completamente** (feche todas as janelas)
4. Verifique os logs: Help → Toggle Developer Tools → Console

### ❌ Erro: "command not found: node"

**Solução:**
1. Verifique se Node.js está instalado: `node --version`
2. Use o caminho completo do Node: `which node`
3. Atualize a configuração:
   ```json
   {
     "mcpServers": {
       "qa-lab": {
         "command": "/usr/local/bin/node",
         "args": ["/Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js"],
         "cwd": "${workspaceFolder}"
       }
     }
   }
   ```

### ❌ Erro: "Cannot find module"

**Solução:**
1. Verifique se o build foi feito: `ls -l dist/index.js`
2. Reconstrua o projeto:
   ```bash
   cd /Users/wesleyluiz/Desktop/mcp-lab-agent
   npm install
   npm run build
   ```

### ❌ MCP carrega mas não funciona

**Solução:**
1. Teste o servidor manualmente:
   ```bash
   cd /Users/wesleyluiz/Desktop/mcp-lab-agent
   ./test-server.sh
   ```
2. Verifique se há erros no console do Cursor
3. Tente usar um projeto diferente (com testes)

## Configuração de API Keys (Opcional)

Para usar a funcionalidade `generate_tests`, crie um arquivo `.env` no **projeto onde você vai usar o MCP** (não no mcp-lab-agent):

```bash
# No projeto onde você vai testar
nano .env
```

Adicione uma das seguintes chaves:

```bash
# Groq (gratuito, recomendado)
GROQ_API_KEY=gsk_...

# Ou Google Gemini (gratuito)
GEMINI_API_KEY=AIza...

# Ou OpenAI (pago)
OPENAI_API_KEY=sk-...
```

### Como obter as API Keys:

- **Groq (gratuito):** https://console.groq.com/keys
- **Gemini (gratuito):** https://aistudio.google.com/apikey
- **OpenAI (pago):** https://platform.openai.com/api-keys

## Localizações Importantes

- **Configuração do MCP:** `~/.cursor/mcp.json`
- **Logs do Cursor:** Help → Toggle Developer Tools → Console
- **Build do MCP:** `/Users/wesleyluiz/Desktop/mcp-lab-agent/dist/index.js`
- **Código fonte:** `/Users/wesleyluiz/Desktop/mcp-lab-agent/src/index.js`

## Suporte

Se encontrar problemas:

1. Execute o script de teste: `./test-server.sh`
2. Verifique o `CHECKLIST.md` para ver se tudo está OK
3. Veja os logs do Cursor (Developer Tools)
4. Abra uma issue no GitHub: https://github.com/Wesley-Gomes93/mcp-lab-agent

## Próximos Passos

Após configurar e testar:

1. Teste em projetos reais (Cypress, Playwright, Jest)
2. Experimente gerar testes com LLM
3. Publique no npm: `npm run build && npm publish`
4. Compartilhe com a comunidade!
