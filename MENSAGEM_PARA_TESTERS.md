# 📧 Template de Mensagem para Testers

Use este template para convidar pessoas para testar seu MCP!

---

## 📱 Versão Curta (WhatsApp/Telegram)

```
Olá! 👋

Estou desenvolvendo um assistente de IA para testes que funciona dentro do Cursor. 

Ele detecta automaticamente frameworks de teste, gera testes com IA, executa e analisa falhas.

Pode me ajudar a testar? Leva só 2 minutos para instalar:

1. Edite ~/.cursor/mcp.json
2. Cole esta config:
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent"],
      "cwd": "${workspaceFolder}"
    }
  }
}
3. Reinicie o Cursor
4. Digite no chat: "Detecte a estrutura do meu projeto"

Guia completo: https://github.com/Wesley-Gomes93/mcp-lab-agent/blob/main/TESTE_COMIGO.md

Obrigado! 🙏
```

---

## 📧 Versão Média (Email)

**Assunto:** Ajuda para testar meu MCP de QA no Cursor?

```
Olá [Nome]!

Estou desenvolvendo um projeto open source e gostaria da sua ajuda para testar!

🎯 O que é?
Um MCP (Model Context Protocol) server que adiciona superpoderes de QA ao Cursor:
- Detecta automaticamente frameworks de teste (Cypress, Playwright, Jest, etc.)
- Gera testes com IA
- Executa e analisa testes
- Sugere correções automáticas
- Cria bug reports

Você só conversa normalmente com o Cursor, tipo:
"Detecte a estrutura do meu projeto"
"Gere um teste para o login"
"Rode os testes e analise as falhas"

⚡ Instalação (2 minutos):

1. Edite ~/.cursor/mcp.json:
   mkdir -p ~/.cursor
   nano ~/.cursor/mcp.json

2. Cole esta configuração:
   {
     "mcpServers": {
       "qa-lab-agent": {
         "command": "npx",
         "args": ["-y", "mcp-lab-agent"],
         "cwd": "${workspaceFolder}"
       }
     }
   }

3. Salve (Ctrl+O, Enter, Ctrl+X) e reinicie o Cursor

4. Teste: "Detecte a estrutura do meu projeto"

📚 Guia completo de testes:
https://github.com/Wesley-Gomes93/mcp-lab-agent/blob/main/TESTE_COMIGO.md

🙏 Feedback que preciso:
- Funcionou?
- Que erros apareceram?
- O que poderia ser melhor?
- Seu ambiente (OS, Node version, frameworks que usa)

Pode me enviar por aqui mesmo ou abrir uma issue no GitHub!

Muito obrigado pela ajuda! 🚀

Wesley
```

---

## 📝 Versão Longa (LinkedIn/Blog/Fórum)

**Título:** Testadores procuram-se! MCP de QA para Cursor

```
Olá comunidade! 👋

Estou desenvolvendo um projeto open source e preciso da ajuda de vocês para testar!

## 🎯 O que é o mcp-lab-agent?

Um MCP (Model Context Protocol) server que transforma o Cursor em um assistente de QA automation poderoso.

### Features:
✅ Detecção automática de frameworks (Cypress, Playwright, Jest, Vitest, Mocha, etc.)
✅ Geração de testes com IA (Groq, Gemini, OpenAI)
✅ Execução e análise de testes
✅ Sugestões inteligentes de correção
✅ Bug reports automáticos em Markdown
✅ Linter e coverage integrados
✅ Suporte para Node.js e Python

### Como funciona?

Você simplesmente conversa com o Cursor:
- "Detecte a estrutura do meu projeto"
- "Gere um teste E2E para o fluxo de checkout"
- "Rode os testes e analise as falhas"
- "Sugira correções para os erros"
- "Crie um bug report"

O Cursor entende e usa as ferramentas certas automaticamente!

## ⚡ Como testar (2 minutos)

### 1. Configure o MCP no Cursor

Edite `~/.cursor/mcp.json`:

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

### 2. Reinicie o Cursor

### 3. Teste em qualquer projeto

```
"Detecte a estrutura do meu projeto"
```

## 🧪 Roteiro de Testes

Preparei um guia completo com roteiro de testes e checklist:
👉 https://github.com/Wesley-Gomes93/mcp-lab-agent/blob/main/TESTE_COMIGO.md

## 💬 Feedback que Preciso

- ✅ O que funcionou bem?
- ❌ O que não funcionou?
- 💡 Sugestões de melhorias
- 🖥️ Seu ambiente (OS, Node version, frameworks)
- 🎯 Frameworks que você usa que não foram detectados

## 📬 Como Enviar Feedback

- GitHub Issues: https://github.com/Wesley-Gomes93/mcp-lab-agent/issues
- Comentários aqui
- DM

## 🌟 Frameworks Suportados

**E2E/UI:** Cypress, Playwright, WebdriverIO, Puppeteer, TestCafe
**Unit/Integration:** Jest, Vitest, Mocha, Jasmine, AVA
**Mobile:** Appium, Detox
**API:** Supertest, Pactum
**Python:** pytest, Robot Framework, Behave

## 🚀 Próximos Passos

Após os testes e feedback, planejo:
- Publicar no npm
- Adicionar mais frameworks
- Melhorar a geração de testes
- Adicionar integração com CI/CD
- Criar dashboard de métricas

## 🙏 Agradecimentos

Muito obrigado a todos que puderem testar e dar feedback!

Se funcionar bem para você, ficarei feliz se puder:
- ⭐ Dar uma estrela no GitHub
- 🐦 Compartilhar com outros devs
- 💬 Deixar feedback

**Repositório:** https://github.com/Wesley-Gomes93/mcp-lab-agent

**Bons testes!** 🚀

#cursor #mcp #qa #testing #automation #opensource
```

---

## 🎤 Versão para Apresentação (Slides)

### Slide 1: Título
```
mcp-lab-agent
Assistente de IA para QA no Cursor

Por Wesley Gomes
```

### Slide 2: Problema
```
❌ Escrever testes é chato
❌ Analisar falhas é demorado
❌ Manter testes é trabalhoso
❌ Cada framework tem sua sintaxe
```

### Slide 3: Solução
```
✅ Converse naturalmente com o Cursor
✅ Ele detecta seu framework automaticamente
✅ Gera testes com IA
✅ Executa e analisa falhas
✅ Sugere correções
```

### Slide 4: Demo
```
[Vídeo ou GIF mostrando:]

1. "Detecte a estrutura do meu projeto"
   → Mostra frameworks detectados

2. "Gere um teste para o login"
   → Gera código do teste

3. "Rode os testes"
   → Executa e mostra resultados

4. "Analise as falhas"
   → Mostra análise e sugestões
```

### Slide 5: Como Funciona
```
MCP (Model Context Protocol)
↓
Cursor AI
↓
Ferramentas de QA
↓
Seu Projeto
```

### Slide 6: Frameworks Suportados
```
E2E: Cypress, Playwright, WebdriverIO
Unit: Jest, Vitest, Mocha
Mobile: Appium, Detox
API: Supertest, Pactum
Python: pytest, Robot Framework
```

### Slide 7: Instalação
```
1. Edite ~/.cursor/mcp.json
2. Cole a config
3. Reinicie o Cursor
4. Pronto!

2 minutos ⏱️
```

### Slide 8: Preciso de Você!
```
🧪 Testadores procuram-se!

Ajude a testar:
✓ Diferentes frameworks
✓ Diferentes projetos
✓ Diferentes ambientes

github.com/Wesley-Gomes93/mcp-lab-agent
```

### Slide 9: Contato
```
Wesley Gomes

GitHub: Wesley-Gomes93
Email: [seu-email]
LinkedIn: [seu-linkedin]

⭐ Dê uma estrela no GitHub!
```

---

## 🎥 Script para Vídeo (1-2 minutos)

```
[0:00-0:10] Intro
"Olá! Hoje vou mostrar o mcp-lab-agent, um assistente de IA para testes que funciona dentro do Cursor."

[0:10-0:20] Problema
"Escrever e manter testes é chato, certo? E se você pudesse simplesmente conversar com o Cursor e ele fazer isso por você?"

[0:20-0:40] Demo - Instalação
"A instalação é super simples. Você só precisa editar um arquivo de configuração, colar esta config, e reiniciar o Cursor. Leva 2 minutos."

[0:40-1:20] Demo - Uso
"Agora veja a mágica. Eu só converso normalmente:
- 'Detecte a estrutura do meu projeto' - ele mostra os frameworks
- 'Gere um teste para o login' - ele gera o código
- 'Rode os testes' - ele executa
- 'Analise as falhas' - ele analisa e sugere correções"

[1:20-1:40] Features
"Ele suporta Cypress, Playwright, Jest, Vitest, e muitos outros frameworks. Detecta automaticamente e funciona em qualquer projeto."

[1:40-2:00] Call to Action
"O projeto é open source e preciso da sua ajuda para testar! Link na descrição. Se gostou, deixa uma estrela no GitHub. Valeu!"

[Descrição do vídeo]
🚀 mcp-lab-agent - Assistente de IA para QA no Cursor

Transforme o Cursor em um assistente de QA automation poderoso!

✅ Detecta frameworks automaticamente
✅ Gera testes com IA
✅ Executa e analisa testes
✅ Sugere correções automáticas

📚 Links:
- Repositório: https://github.com/Wesley-Gomes93/mcp-lab-agent
- Guia de instalação: [link]
- Como testar: [link]

🙏 Ajude a testar e dê seu feedback!

#cursor #mcp #qa #testing #automation
```

---

## 📊 Checklist de Divulgação

- [ ] Enviar para amigos desenvolvedores
- [ ] Postar no LinkedIn
- [ ] Postar em grupos de QA (Facebook, Telegram, Discord)
- [ ] Postar no Reddit (r/QualityAssurance, r/softwaretesting)
- [ ] Postar no Dev.to
- [ ] Postar no Twitter/X
- [ ] Criar vídeo demo
- [ ] Postar no YouTube
- [ ] Enviar para newsletters de dev
- [ ] Postar em fóruns (Stack Overflow, QA Stack Exchange)

---

**Boa sorte com os testes!** 🚀
