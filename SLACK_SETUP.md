# 💬 Como Configurar o Slack Bot

## 🎯 **O Que o Bot Faz no Slack:**

Você pode mencionar o bot em qualquer canal e ele executa comandos:

```
@qa-lab-agent analyze
@qa-lab-agent auto "login, cadastro"
@qa-lab-agent flaky-report --runs 5
@qa-lab-agent stats
@qa-lab-agent run tests/login.spec.js
```

---

## 📋 **Passo a Passo de Configuração:**

### **1. Criar App no Slack**

1. Acesse: https://api.slack.com/apps
2. Clique em **Create New App** → **From scratch**
3. Nome: `QA Lab Agent`
4. Escolha seu workspace
5. Clique em **Create App**

---

### **2. Configurar Permissões (Scopes)**

1. No menu lateral, clique em **OAuth & Permissions**
2. Role até **Scopes** → **Bot Token Scopes**
3. Clique em **Add an OAuth Scope** e adicione:
   - `app_mentions:read` - Para receber menções
   - `chat:write` - Para enviar mensagens
   - `channels:read` - Para listar canais
   - `channels:history` - Para ler histórico

---

### **3. Ativar Socket Mode (Recomendado)**

1. No menu lateral, clique em **Socket Mode**
2. Ative **Enable Socket Mode** → ON
3. Clique em **Generate** para criar um token
4. Nome: `qa-lab-connection`
5. Scope: `connections:write`
6. Copie o token que começa com `xapp-...` (**App Token**)

---

### **4. Instalar o App no Workspace**

1. Volte em **OAuth & Permissions**
2. Clique em **Install to Workspace**
3. Clique em **Allow**
4. Copie o **Bot User OAuth Token** que começa com `xoxb-...` (**Bot Token**)

---

### **5. Configurar Eventos**

1. No menu lateral, clique em **Event Subscriptions**
2. Ative **Enable Events** → ON
3. Em **Subscribe to bot events**, clique em **Add Bot User Event**
4. Adicione: `app_mention`
5. Clique em **Save Changes**

---

### **6. Configurar Credenciais Localmente**

Edite o arquivo `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent@latest"],
      "cwd": "${workspaceFolder}",
      "slack": {
        "botToken": "xoxb-SEU-TOKEN-AQUI",
        "appToken": "xapp-SEU-TOKEN-AQUI",
        "useLocal": true,
        "workDir": "/Users/wesleyluiz/Desktop/test-teamhub"
      }
    }
  }
}
```

**Substitua:**
- `xoxb-SEU-TOKEN-AQUI` pelo **Bot User OAuth Token** (passo 4)
- `xapp-SEU-TOKEN-AQUI` pelo **App Token** (passo 3)
- `workDir` pelo caminho do seu projeto com testes

---

### **7. Iniciar o Bot**

```bash
mcp-lab-agent slack-bot
```

Você verá:

```
⚡️ Bolt app is running (Socket Mode)!
```

---

### **8. Testar no Slack**

1. Vá em qualquer canal do Slack
2. Convide o bot: `/invite @QA Lab Agent`
3. Mencione o bot:

```
@QA Lab Agent analyze
@QA Lab Agent auto "login, cadastro"
@QA Lab Agent stats
@QA Lab Agent flaky-report --runs 5
```

---

## 🎯 **Comandos Disponíveis no Slack:**

### **Análise e Geração:**
```
@qa-lab-agent analyze                           # Análise completa do projeto
@qa-lab-agent auto "login"                      # Gera 1 teste
@qa-lab-agent auto "login, cadastro, buscar"    # Gera múltiplos testes em paralelo
@qa-lab-agent detect                            # Detecta frameworks
```

### **Execução:**
```
@qa-lab-agent run                               # Executa todos os testes
@qa-lab-agent run tests/login.spec.js           # Executa teste específico
@qa-lab-agent run tests/login.spec.js --device iPhone_15
```

### **Relatórios:**
```
@qa-lab-agent stats                             # Estatísticas de aprendizado
@qa-lab-agent report                            # Relatório básico
@qa-lab-agent report --full                     # Relatório completo
@qa-lab-agent flaky-report --runs 5             # Detecta testes flaky
@qa-lab-agent flaky-report --runs 5 --spec tests/login.spec.js
@qa-lab-agent metrics-report                    # Métricas detalhadas
```

---

## 🔧 **Troubleshooting:**

### **Bot não responde:**
```bash
# Verificar se está rodando
ps aux | grep "slack-bot"

# Reiniciar
pkill -f "slack-bot"
mcp-lab-agent slack-bot
```

### **"Bot não está no canal":**
```
/invite @QA Lab Agent
```

### **Erro de permissão:**
- Verifique se os scopes estão corretos (passo 2)
- Reinstale o app: **OAuth & Permissions** → **Reinstall to Workspace**

---

## 📊 **Exemplo de Uso Real:**

```
👤 Você: @QA Lab Agent auto "login, cadastro, buscar" --max-retries 3

🤖 Bot: 
🤖 Modo autônomo iniciado: 3 testes em paralelo

📋 Testes a executar:
   1. login
   2. cadastro  
   3. buscar

✅ 1. login - PASSOU
✅ 2. cadastro - PASSOU
❌ 3. buscar - FALHOU

Total: 3 testes
✅ Passou: 2
❌ Falhou: 1
⏱️  Tempo total: 45s
```

---

## 🎯 **Próximos Passos:**

1. ✅ Criar app no Slack (passo 1-5)
2. ✅ Copiar tokens (Bot Token e App Token)
3. ✅ Editar `~/.cursor/mcp.json` com os tokens
4. ✅ Executar: `mcp-lab-agent slack-bot`
5. ✅ Testar no Slack: `@QA Lab Agent stats`

**Quer que eu te ajude a configurar os tokens?**
