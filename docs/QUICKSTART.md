# 🚀 Quick Start - mcp-lab-agent

## Para Usuários (Instalar e Usar)

### 1️⃣ Instale no Cursor (2 minutos)

**Passo 1:** Edite ou crie `~/.cursor/mcp.json`

```bash
mkdir -p ~/.cursor
nano ~/.cursor/mcp.json
```

**Passo 2:** Cole esta configuração:

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

**Passo 3:** Salve (Ctrl+O, Enter, Ctrl+X) e **reinicie o Cursor**

### 2️⃣ Use Normalmente

Abra qualquer projeto no Cursor e converse naturalmente:

```
"Detecte a estrutura do meu projeto"
"Gere um teste para o login"
"Rode os testes"
"Analise as falhas"
```

**Pronto!** O Cursor usa as ferramentas automaticamente. Você não precisa fazer nada especial.

---

## Para Desenvolvedores (Contribuir)

### 1️⃣ Clone e Configure

```bash
git clone https://github.com/Wesley-Gomes93/mcp-lab-agent
cd mcp-lab-agent
npm install
npm run build
```

### 2️⃣ Configure no Cursor (desenvolvimento local)

Edite `~/.cursor/mcp.json`:

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

**Importante:** Use o caminho absoluto completo para o arquivo `dist/index.js`

### 3️⃣ Desenvolva

```bash
# Modo watch (recompila automaticamente)
npm run dev

# Teste o servidor
./test-server.sh

# Build para produção
npm run build
```

---

## ❓ FAQ

### Como sei se está funcionando?

1. Abra o Cursor
2. Abra qualquer projeto
3. No chat, digite: "Detecte a estrutura do meu projeto"
4. Se responder com informações sobre frameworks e testes, está funcionando!

### Preciso configurar algo no meu projeto?

**Não!** O MCP detecta automaticamente:
- Frameworks de teste (Cypress, Playwright, Jest, etc.)
- Estrutura de pastas
- Backend/Frontend

### Como usar a geração de testes com IA?

Crie um arquivo `.env` **no seu projeto** (não no mcp-lab-agent):

```bash
# Groq (gratuito, recomendado)
GROQ_API_KEY=gsk_...

# Ou Gemini (gratuito)
GEMINI_API_KEY=AIza...

# Ou OpenAI (pago)
OPENAI_API_KEY=sk-...
```

**Onde conseguir as chaves:**
- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/apikey
- OpenAI: https://platform.openai.com/api-keys

### O que posso pedir ao Cursor?

Converse naturalmente! Exemplos:

**Exploração:**
- "Quais testes existem neste projeto?"
- "Detecte a estrutura do projeto"
- "Liste todos os testes de Cypress"

**Execução:**
- "Rode os testes"
- "Execute os testes E2E"
- "Gere um relatório de cobertura"

**Geração:**
- "Gere um teste para o fluxo de checkout"
- "Crie um teste de API para o endpoint /users"
- "Gere testes unitários para o componente Button"

**Análise:**
- "Analise as falhas dos testes"
- "Sugira correções para os erros"
- "Crie um bug report"

**Manutenção:**
- "Rode o linter e corrija os problemas"
- "Instale as dependências de teste"

### Não está funcionando, o que fazer?

**Checklist rápido:**

1. ✅ Reiniciou o Cursor completamente?
2. ✅ O arquivo `~/.cursor/mcp.json` está correto?
3. ✅ Está usando Node.js 18 ou superior? (`node --version`)

**Verificar logs:**
1. Abra o Cursor
2. Help → Toggle Developer Tools → Console
3. Procure por erros relacionados a "mcp" ou "qa-lab"

**Testar manualmente (se instalou localmente):**
```bash
cd /caminho/para/mcp-lab-agent
./test-server.sh
```

**Ainda com problemas?**
- Veja `TROUBLESHOOTING.md`
- Abra uma issue: https://github.com/Wesley-Gomes93/mcp-lab-agent/issues

---

## 🎯 Próximos Passos

Após instalar:

1. ✅ Teste em um projeto com testes existentes
2. ✅ Experimente gerar novos testes
3. ✅ Configure uma API key para geração com IA
4. ✅ Compartilhe feedback!

---

## 📚 Documentação Completa

- `README.md` - Visão geral e features
- `INSTALL.md` - Opções de instalação detalhadas
- `CURSOR_SETUP.md` - Configuração passo a passo do Cursor
- `TROUBLESHOOTING.md` - Solução de problemas
- `FRAMEWORKS.md` - Frameworks suportados

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja como:

1. Fork o projeto
2. Crie uma branch: `git checkout -b minha-feature`
3. Commit: `git commit -m 'Adiciona nova feature'`
4. Push: `git push origin minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

MIT - Wesley Gomes
