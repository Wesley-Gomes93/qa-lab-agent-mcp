# 💬 Comandos do Slack Bot

## 🎯 **Como Usar no Slack:**

Mencione o bot em qualquer canal:

```
@qa-lab-agent [comando]
```

---

## 🚀 **Comandos Disponíveis:**

### **1. Modo AUTO - Gerar e Executar Testes**

```slack
@qa-lab-agent auto "login"
@qa-lab-agent auto "login, cadastro, buscar" --max-retries 3
```

**O que faz:**
- 🤖 Gera teste com IA
- ✅ Executa automaticamente
- 🔧 Corrige se falhar
- 📊 Aprende e salva

**Resposta do bot:**
```
🤖 Modo autônomo iniciado: 2 testes em paralelo

✅ 1. login - PASSOU
✅ 2. cadastro - PASSOU

Total: 2 testes
✅ Passou: 2
⏱️  Tempo total: 15s
```

---

### **2. FLAKY REPORT - Detectar Testes Instáveis**

```slack
@qa-lab-agent flaky-report --runs 5
@qa-lab-agent flaky-report --runs 5 --spec tests/login.spec.js
@qa-lab-agent flaky-report --runs 5 --output flaky.md
```

**O que faz:**
- 🔄 Executa teste N vezes
- 🔍 Detecta intermitência
- 📊 Identifica causa (timing, selector, network)
- 💡 Sugere correções

**Resposta do bot:**
```
📊 Relatório de Flaky Tests

Teste: tests/login.spec.js
Execuções: 5
Passou: 3 vezes (60%)
Falhou: 2 vezes (40%)

⚠️ FLAKY DETECTADO (confiança: 85%)
Padrões: timing, selector

💡 Sugestões:
- Adicionar waitForSelector antes de interagir
- Usar data-testid em vez de classes CSS
```

---

### **3. ANALYZE - Análise Completa**

```slack
@qa-lab-agent analyze
```

**O que faz:**
- 🔍 Executa todos os testes
- 📊 Analisa estabilidade
- ⚠️ Prevê riscos por área
- 💡 Recomenda ações

---

### **4. STATS - Estatísticas**

```slack
@qa-lab-agent stats
```

**Resposta:**
```
📊 Estatísticas de Aprendizado

Total de aprendizados: 15
Correções bem-sucedidas: 8
Taxa de sucesso na 1ª tentativa: 53%
Testes gerados: 15
```

---

### **5. RUN - Executar Testes**

```slack
@qa-lab-agent run
@qa-lab-agent run tests/login.spec.js
@qa-lab-agent run tests/login.spec.js --device iPhone_15
```

**O que faz:**
- ▶️ Executa testes
- 📱 Detecta device automaticamente
- 🔧 Auto-fix de seletores

---

### **6. REPORT - Relatório de Evolução**

```slack
@qa-lab-agent report
@qa-lab-agent report --full
```

**Resposta:**
```
📈 Relatório de Evolução

Período: Últimos 7 dias
Testes executados: 45
Taxa de sucesso: 87%
Correções aplicadas: 12

💡 Recomendações:
- Adicionar data-testid em 5 componentes
- Revisar seletores em tests/buscar.spec.js
```

---

### **7. DETECT - Detectar Estrutura**

```slack
@qa-lab-agent detect
@qa-lab-agent detect --json
```

**Resposta:**
```
🔍 Estrutura Detectada

Framework: Playwright
Pasta de testes: tests/
Arquivos: 8 specs
Configuração: playwright.config.js
```

---

### **8. METRICS - Métricas Detalhadas**

```slack
@qa-lab-agent metrics-report
@qa-lab-agent metrics-report --json
```

---

## 🎯 **Exemplos de Uso Real:**

### **Cenário 1: Gerar Testes Rapidamente**
```slack
👤 Você: @qa-lab-agent auto "login, cadastro, recuperar senha" --max-retries 3

🤖 Bot: 
✅ 1. login - PASSOU
✅ 2. cadastro - PASSOU  
✅ 3. recuperar senha - PASSOU
⏱️  Tempo total: 25s
```

### **Cenário 2: Investigar Teste Flaky**
```slack
👤 Você: @qa-lab-agent flaky-report --runs 10 --spec tests/checkout.spec.js

🤖 Bot:
⚠️ FLAKY DETECTADO (85% confiança)
Passou: 6/10 vezes (60%)
Padrões: timing, network

💡 Adicione:
- await page.waitForLoadState('networkidle')
- Retry em chamadas de API
```

### **Cenário 3: Daily Standup**
```slack
👤 Você: @qa-lab-agent stats

🤖 Bot:
📊 Últimas 24h:
Testes executados: 23
Taxa de sucesso: 91%
Correções automáticas: 3
```

---

## ⚙️ **Configuração:**

Siga o guia completo em `SLACK_SETUP.md`:

1. Criar app no Slack
2. Adicionar scopes necessários
3. Ativar Socket Mode
4. Copiar tokens
5. Configurar `~/.cursor/mcp.json`
6. Iniciar: `mcp-lab-agent slack-bot`

---

## 🎊 **Benefícios:**

- ⚡ **QA no fluxo da conversa** - Sem sair do Slack
- 👥 **Time todo vê** - Transparência nos testes
- 🔒 **Seguro** - Socket Mode, sem URL pública
- 🤖 **Autônomo** - Gera, executa, corrige e aprende

---

**Recarregue o Learning Hub agora: http://localhost:3847**

**Quer configurar o Slack Bot agora?**
