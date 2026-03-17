# 📖 Como Usar o mcp-lab-agent no Cursor

## 🎯 O que é isso?

Um assistente de IA para testes que funciona **dentro do Cursor**. Ele:
- ✅ Detecta automaticamente seus frameworks de teste
- ✅ Gera testes com IA
- ✅ Executa e analisa testes
- ✅ Sugere correções para falhas
- ✅ Cria bug reports automáticos

**Você só conversa normalmente com o Cursor, e ele faz o resto!**

---

## ⚡ Instalação (2 minutos)

### Passo 1: Edite o arquivo de configuração do Cursor

```bash
mkdir -p ~/.cursor
nano ~/.cursor/mcp.json
```

### Passo 2: Cole esta configuração

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

### Passo 3: Salve e saia

- No nano: pressione `Ctrl+O`, depois `Enter`, depois `Ctrl+X`
- No vim: digite `:wq` e pressione `Enter`

### Passo 4: Reinicie o Cursor

**Feche completamente** o Cursor e abra novamente.

---

## 💬 Como Usar

### Não precisa decorar comandos!

Apenas converse naturalmente com o Cursor. Ele entende o que você quer e usa as ferramentas certas automaticamente.

### Exemplos do que você pode pedir:

#### 🔍 Explorar o projeto

```
"Quais frameworks de teste estão instalados aqui?"
"Detecte a estrutura do meu projeto"
"Liste todos os testes"
"Mostre os testes de Cypress"
```

#### ▶️ Executar testes

```
"Rode os testes"
"Execute os testes E2E"
"Rode apenas os testes do login"
"Execute o teste cypress/e2e/checkout.cy.js"
```

#### ✨ Gerar testes

```
"Gere um teste para o fluxo de login"
"Crie um teste de API para o endpoint /users"
"Gere testes E2E para o cadastro de produtos"
"Crie um teste unitário para o componente Button"
```

#### 🔧 Analisar problemas

```
"Analise as falhas dos testes"
"Por que esse teste falhou?"
"Sugira correções para os erros"
"Crie um bug report das falhas"
```

#### 🛠️ Manutenção

```
"Rode o linter e corrija os problemas"
"Gere um relatório de cobertura"
"Instale as dependências de teste"
"Liste todos os arquivos de teste"
```

---

## 🎨 Exemplo Real de Uso

Imagine que você abriu um projeto no Cursor:

```
👤 Você: "Detecte a estrutura do meu projeto"

🤖 Cursor: Detectei:
- Framework: Cypress 13.x
- Testes em: cypress/e2e/
- 15 arquivos de teste encontrados
- Backend: Node.js + Express
- Frontend: React

👤 Você: "Gere um teste E2E para o fluxo de checkout"

🤖 Cursor: [gera o teste automaticamente]
Criei o arquivo: cypress/e2e/checkout.cy.js

👤 Você: "Rode esse teste"

🤖 Cursor: [executa o teste]
✅ 1 teste passou
⏱️ Tempo: 2.3s

👤 Você: "Agora gere um teste para o carrinho de compras"

🤖 Cursor: [gera outro teste]
...
```

**Você só conversa, o Cursor faz tudo!**

---

## 🔑 Configuração Opcional: IA para Geração de Testes

Para gerar testes com IA, você precisa de uma API key (gratuita).

### Passo 1: Escolha um provedor

| Provedor | Custo | Link |
|----------|-------|------|
| **Groq** (recomendado) | 🆓 Gratuito | https://console.groq.com/keys |
| **Gemini** | 🆓 Gratuito | https://aistudio.google.com/apikey |
| **OpenAI** | 💰 Pago | https://platform.openai.com/api-keys |

### Passo 2: Crie um arquivo `.env` no seu projeto

```bash
# No seu projeto (não no mcp-lab-agent)
nano .env
```

### Passo 3: Adicione a chave

```bash
# Para Groq (recomendado)
GROQ_API_KEY=gsk_sua_chave_aqui

# Ou para Gemini
GEMINI_API_KEY=AIza_sua_chave_aqui

# Ou para OpenAI
OPENAI_API_KEY=sk-sua_chave_aqui
```

**Pronto!** Agora você pode gerar testes com IA.

---

## ✅ Como saber se está funcionando?

### Teste rápido:

1. Abra qualquer projeto no Cursor
2. No chat, digite: **"Detecte a estrutura do meu projeto"**
3. Se responder com informações sobre frameworks e testes, **está funcionando!**

### Verificar ferramentas disponíveis:

1. Abra o chat do Cursor (Cmd+L ou Ctrl+L)
2. Clique no ícone de ferramentas (🔧) ou procure por "Tools"
3. Você deve ver as ferramentas do `qa-lab-agent`:
   - `detect_project`
   - `run_tests`
   - `generate_tests`
   - E outras...

---

## 🚨 Problemas Comuns

### "MCP não aparece no Cursor"

**Solução:**
1. Verifique se o arquivo `~/.cursor/mcp.json` está correto
2. **Reinicie o Cursor completamente** (feche todas as janelas)
3. Verifique se tem Node.js instalado: `node --version` (precisa ser 18+)

### "Cannot find module" ou "command not found"

**Solução:**
1. Certifique-se de que tem Node.js 18 ou superior instalado
2. Tente executar manualmente: `npx -y mcp-lab-agent`
3. Se funcionar, o problema é na configuração do Cursor

### "As ferramentas não aparecem"

**Solução:**
1. Abra o Developer Tools do Cursor: Help → Toggle Developer Tools
2. Vá na aba Console
3. Procure por erros relacionados a "mcp" ou "qa-lab"
4. Se ver erros, copie e abra uma issue no GitHub

### Ainda não funciona?

1. Veja a documentação completa: `TROUBLESHOOTING.md`
2. Abra uma issue: https://github.com/Wesley-Gomes93/mcp-lab-agent/issues
3. Inclua:
   - Sistema operacional
   - Versão do Node.js (`node --version`)
   - Conteúdo do `~/.cursor/mcp.json`
   - Erros do Developer Tools (se houver)

---

## 🎓 Dicas de Uso

### 1. Seja específico

❌ "Gere um teste"
✅ "Gere um teste E2E para o fluxo de login com email e senha"

### 2. Use contexto

❌ "Rode os testes"
✅ "Rode os testes de integração da API de usuários"

### 3. Peça análise

Depois de rodar testes:
```
"Analise as falhas e me diga o que está errado"
"Sugira correções para os testes que falharam"
```

### 4. Gere relatórios

```
"Crie um bug report das falhas"
"Gere um relatório de cobertura"
```

### 5. Mantenha o código limpo

```
"Rode o linter e corrija os problemas automaticamente"
```

---

## 🌟 Frameworks Suportados

### E2E/UI Testing
- ✅ Cypress
- ✅ Playwright
- ✅ WebdriverIO
- ✅ Puppeteer
- ✅ TestCafe

### Unit/Integration Testing
- ✅ Jest
- ✅ Vitest
- ✅ Mocha
- ✅ Jasmine
- ✅ AVA

### Mobile Testing
- ✅ Appium
- ✅ Detox

### API Testing
- ✅ Supertest
- ✅ Pactum

### Python
- ✅ pytest
- ✅ Robot Framework
- ✅ Behave

**Não viu seu framework?** Abra uma issue!

---

## 📚 Mais Informações

- **README.md** - Visão geral completa
- **QUICKSTART.md** - Guia rápido
- **INSTALL.md** - Opções de instalação
- **CURSOR_SETUP.md** - Configuração detalhada
- **TROUBLESHOOTING.md** - Solução de problemas
- **FRAMEWORKS.md** - Frameworks suportados

---

## 🤝 Contribuir

Quer ajudar a melhorar? Contribuições são bem-vindas!

1. Fork o repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça suas alterações
4. Commit: `git commit -m 'Adiciona nova feature'`
5. Push: `git push origin minha-feature`
6. Abra um Pull Request

---

## 📄 Licença

MIT - Wesley Gomes

---

## ❤️ Gostou?

- ⭐ Dê uma estrela no GitHub
- 🐦 Compartilhe com amigos
- 💬 Dê feedback abrindo issues
- 🤝 Contribua com código

**Bons testes!** 🚀
