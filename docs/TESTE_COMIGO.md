# 🧪 Teste o mcp-lab-agent Comigo!

Olá! Estou desenvolvendo um assistente de IA para testes que funciona dentro do Cursor. Gostaria da sua ajuda para testar!

## 🎯 O que é?

Um MCP (Model Context Protocol) server que adiciona superpoderes de QA ao Cursor:
- Detecta automaticamente frameworks de teste
- Gera testes com IA
- Executa e analisa testes
- Sugere correções automáticas
- Cria bug reports

**Você só conversa com o Cursor normalmente, ele faz o resto!**

---

## ⚡ Como Instalar (2 minutos)

### 1. Edite o arquivo de configuração do Cursor

**No Mac/Linux:**
```bash
mkdir -p ~/.cursor
nano ~/.cursor/mcp.json
```

**No Windows:**
```powershell
mkdir $env:USERPROFILE\.cursor -Force
notepad $env:USERPROFILE\.cursor\mcp.json
```

### 2. Cole esta configuração

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

### 3. Salve e reinicie o Cursor

**Importante:** Feche completamente o Cursor e abra novamente.

---

## ✅ Teste se Funcionou

1. Abra qualquer projeto no Cursor (pode ser um projeto com testes ou sem)
2. No chat do Cursor, digite:

```
Detecte a estrutura do meu projeto
```

3. Se responder com informações sobre frameworks e estrutura, **funcionou!** 🎉

---

## 🧪 Roteiro de Testes

### Teste 1: Detecção de Projeto

```
"Detecte a estrutura do meu projeto"
```

**O que esperar:** Informações sobre frameworks, pastas de teste, backend/frontend.

---

### Teste 2: Listar Testes (se tiver testes no projeto)

```
"Liste todos os arquivos de teste"
```

**O que esperar:** Lista de arquivos de teste encontrados.

---

### Teste 3: Executar Testes (se tiver testes)

```
"Rode os testes"
```

**O que esperar:** Output da execução dos testes.

---

### Teste 4: Gerar Teste (opcional - requer API key)

```
"Gere um teste E2E para o fluxo de login"
```

**O que esperar:** Código de teste gerado.

**Nota:** Para este teste funcionar, você precisa de uma API key (gratuita):
- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/apikey

Crie um arquivo `.env` no seu projeto:
```bash
GROQ_API_KEY=sua_chave_aqui
```

---

### Teste 5: Análise de Falhas (se tiver testes que falham)

```
"Analise as falhas dos testes"
"Sugira correções"
```

**O que esperar:** Análise das falhas e sugestões de correção.

---

## 📝 Feedback que Preciso

Por favor, me diga:

### ✅ O que funcionou?
- [ ] Instalação foi fácil?
- [ ] Detecção de projeto funcionou?
- [ ] Listagem de testes funcionou?
- [ ] Execução de testes funcionou?
- [ ] Geração de testes funcionou?
- [ ] Análise de falhas funcionou?

### ❌ O que NÃO funcionou?
- Erros que apareceram?
- Comandos que não entendeu?
- Respostas estranhas?

### 💡 Sugestões
- O que você gostaria que tivesse?
- O que poderia ser melhor?
- Que frameworks você usa que não foram detectados?

### 🖥️ Seu Ambiente
- Sistema operacional: (Mac, Windows, Linux)
- Versão do Node.js: (execute `node --version`)
- Frameworks de teste que você usa:
- Tipo de projeto: (frontend, backend, fullstack, mobile)

---

## 🚨 Problemas Comuns

### "MCP não aparece"

1. Certifique-se de que reiniciou o Cursor **completamente**
2. Verifique se o arquivo `~/.cursor/mcp.json` está correto
3. Verifique se tem Node.js 18+ instalado: `node --version`

### "Cannot find module"

1. Tente executar manualmente: `npx -y mcp-lab-agent`
2. Se funcionar, o problema é na configuração do Cursor
3. Verifique os logs: Help → Toggle Developer Tools → Console

### "Não entende meus comandos"

Tente ser mais específico:
- ❌ "Teste isso"
- ✅ "Gere um teste E2E para o fluxo de login"

---

## 📸 Screenshots (opcional)

Se possível, tire screenshots de:
1. Ferramentas disponíveis no Cursor (ícone 🔧)
2. Resultado da detecção do projeto
3. Qualquer erro que aparecer

---

## 📬 Como Enviar Feedback

Escolha a forma mais fácil para você:

1. **GitHub Issue:** https://github.com/Wesley-Gomes93/mcp-lab-agent/issues
2. **Email:** [seu-email@exemplo.com]
3. **WhatsApp/Telegram:** [seu-contato]
4. **Mensagem direta:** [onde você preferir]

---

## 🎁 Agradecimento

Muito obrigado por testar! Seu feedback é super importante para melhorar o projeto.

Se funcionar bem para você, ficarei feliz se puder:
- ⭐ Dar uma estrela no GitHub
- 🐦 Compartilhar com outros devs
- 💬 Deixar feedback

**Obrigado!** 🙏

---

## 📚 Documentação Completa

Se quiser saber mais:
- **COMO_USAR.md** - Guia completo de uso
- **QUICKSTART.md** - Instalação rápida
- **README.md** - Visão geral do projeto
- **TROUBLESHOOTING.md** - Solução de problemas

---

## 🔗 Links Úteis

- **Repositório:** https://github.com/Wesley-Gomes93/mcp-lab-agent
- **Issues:** https://github.com/Wesley-Gomes93/mcp-lab-agent/issues
- **Groq API (gratuita):** https://console.groq.com/keys
- **Gemini API (gratuita):** https://aistudio.google.com/apikey

---

**Bons testes e obrigado pela ajuda!** 🚀
