# 🏢 Configuração para Ambientes Corporativos

## Problema: APIs Externas Bloqueadas

Muitas empresas bloqueiam acesso a APIs externas (Groq, OpenAI, Gemini) por segurança.

**Solução:** Use LLMs locais ou endpoints internos.

---

## Opção 1: Ollama (Local, Sem Internet)

### Setup

**1. Instale o Ollama:**

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Baixe de https://ollama.com/download
```

**2. Baixe os modelos:**

```bash
# Modelo simples (geração de testes)
ollama pull llama3.1:8b

# Modelo complexo (análise de falhas)
ollama pull llama3.1:70b
```

**3. Inicie o Ollama:**

```bash
ollama serve
```

**4. Configure o projeto:**

```bash
# Não precisa de API key!
# O mcp-lab-agent detecta automaticamente o Ollama em localhost:11434
```

**5. Teste:**

```bash
npx mcp-lab-agent auto "login flow"
```

**Pronto!** Funciona 100% offline.

---

## Opção 2: Ollama com URL Customizada

Se o Ollama roda em outro servidor interno:

```bash
# .env
OLLAMA_BASE_URL=http://ollama-interno.empresa.com:11434
```

---

## Opção 3: LLM Interno da Empresa

Se sua empresa tem um endpoint LLM interno (ex: Azure OpenAI, AWS Bedrock, LLM próprio):

```bash
# .env
QA_LAB_LLM_BASE_URL=https://llm-interno.empresa.com/v1
QA_LAB_LLM_API_KEY=sua-key-interna
QA_LAB_LLM_SIMPLE=llama-8b
QA_LAB_LLM_COMPLEX=llama-70b
```

O agente vai usar esse endpoint em vez de APIs externas.

---

## Opção 4: Proxy Corporativo

Se sua empresa permite APIs externas via proxy:

```bash
# .env
HTTP_PROXY=http://proxy.empresa.com:8080
HTTPS_PROXY=http://proxy.empresa.com:8080
GROQ_API_KEY=sua-key
```

---

## Comparação de Opções

| Opção | Prós | Contras | Setup |
|-------|------|---------|-------|
| **Ollama (local)** | 100% offline, gratuito, privado | Requer GPU/CPU forte | 5 min |
| **Ollama (servidor interno)** | Compartilhado pelo time, rápido | Requer infra | 10 min |
| **LLM interno da empresa** | Compliance garantido | Depende da empresa ter | 2 min |
| **Proxy corporativo** | Usa APIs externas | Depende de aprovação | 2 min |

---

## Recomendação por Cenário

### Cenário 1: Empresa bloqueia tudo
**Solução:** Ollama local

```bash
brew install ollama
ollama pull llama3.1:8b
ollama serve
```

### Cenário 2: Empresa tem LLM interno
**Solução:** Configurar endpoint customizado

```bash
# .env
QA_LAB_LLM_BASE_URL=https://llm.empresa.com/v1
QA_LAB_LLM_API_KEY=key-interna
```

### Cenário 3: Empresa permite APIs via proxy
**Solução:** Configurar proxy

```bash
# .env
HTTPS_PROXY=http://proxy.empresa.com:8080
GROQ_API_KEY=sua-key
```

---

## Configuração Completa (.env)

### Para Ollama local

```bash
# Nada! O agente detecta automaticamente localhost:11434
```

### Para Ollama em servidor interno

```bash
OLLAMA_BASE_URL=http://ollama.empresa.com:11434
```

### Para LLM interno da empresa

```bash
QA_LAB_LLM_BASE_URL=https://llm-interno.empresa.com/v1
QA_LAB_LLM_API_KEY=sua-key-interna
QA_LAB_LLM_SIMPLE=modelo-simples
QA_LAB_LLM_COMPLEX=modelo-complexo
```

### Para APIs externas com proxy

```bash
HTTP_PROXY=http://proxy.empresa.com:8080
HTTPS_PROXY=http://proxy.empresa.com:8080
GROQ_API_KEY=sua-key
```

---

## Testando a Configuração

### 1. Verificar se o LLM está acessível

**Ollama:**
```bash
curl http://localhost:11434/v1/models
```

**LLM interno:**
```bash
curl https://llm-interno.empresa.com/v1/models \
  -H "Authorization: Bearer sua-key"
```

### 2. Testar geração

```bash
npx mcp-lab-agent auto "teste simples"
```

Se funcionar: ✅ Configuração correta

Se falhar com "No API key": ❌ Configure uma das opções acima

---

## Performance: Ollama vs. APIs Externas

| Aspecto | Ollama (local) | Groq/OpenAI |
|---------|----------------|-------------|
| **Latência** | 2-5s (depende da GPU) | 1-3s |
| **Custo** | Gratuito | Groq: gratuito / OpenAI: pago |
| **Privacidade** | 100% local | Dados enviados para API |
| **Requisitos** | GPU/CPU forte | Internet |
| **Compliance** | ✅ Total | Depende da empresa |

---

## Modelos Recomendados (Ollama)

### Para máquinas potentes (GPU ou M1/M2/M3)

```bash
# Simples (geração)
ollama pull llama3.1:8b

# Complexo (análise)
ollama pull llama3.1:70b
```

### Para máquinas mais fracas

```bash
# Simples (geração)
ollama pull llama3.1:8b

# Complexo (análise) - versão menor
ollama pull llama3.1:8b  # Usa o mesmo para ambos
```

Ou:

```bash
# Modelos menores
ollama pull phi3:mini      # 3.8B (rápido)
ollama pull mistral:7b     # 7B (bom custo-benefício)
```

---

## Configuração no Cursor (MCP)

### Com Ollama

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent"],
      "cwd": "${workspaceFolder}",
      "env": {
        "OLLAMA_BASE_URL": "http://localhost:11434"
      }
    }
  }
}
```

### Com LLM interno

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent"],
      "cwd": "${workspaceFolder}",
      "env": {
        "QA_LAB_LLM_BASE_URL": "https://llm-interno.empresa.com/v1",
        "QA_LAB_LLM_API_KEY": "sua-key-interna"
      }
    }
  }
}
```

---

## Troubleshooting

### Erro: "No API key"

**Causa:** Nenhuma API key configurada e Ollama não está rodando.

**Solução:**
```bash
# Opção 1: Inicie o Ollama
ollama serve

# Opção 2: Configure uma API key
echo "GROQ_API_KEY=sua-key" > .env
```

### Erro: "Connection refused"

**Causa:** Ollama não está rodando ou URL errada.

**Solução:**
```bash
# Verifique se o Ollama está rodando
curl http://localhost:11434/v1/models

# Se não estiver, inicie
ollama serve
```

### Erro: "Model not found"

**Causa:** Modelo não foi baixado.

**Solução:**
```bash
ollama pull llama3.1:8b
```

---

## FAQ Corporativo

### Preciso de aprovação para usar Ollama?
**Não.** Roda 100% local, sem enviar dados para fora.

### Qual o requisito de hardware?
- **Mínimo:** 8 GB RAM, CPU moderna
- **Recomendado:** 16 GB RAM, GPU ou Apple Silicon (M1/M2/M3)

### Ollama funciona em Windows?
**Sim.** Baixe de https://ollama.com/download

### Posso usar o LLM da empresa?
**Sim.** Configure `QA_LAB_LLM_BASE_URL` e `QA_LAB_LLM_API_KEY`.

### E se minha empresa bloquear o npm?
Use registry interno:
```bash
npm config set registry https://npm-interno.empresa.com
```

---

## Exemplo Completo: Setup Corporativo

### 1. Instalar Ollama (local)

```bash
brew install ollama
ollama pull llama3.1:8b
ollama serve
```

### 2. Configurar projeto

```bash
cd seu-projeto
# Não precisa de .env! Ollama é detectado automaticamente
```

### 3. Testar

```bash
npx mcp-lab-agent auto "login flow"
```

### 4. Integrar no Cursor

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

**Pronto!** 100% offline, sem APIs externas.

---

## Vantagens para Empresas

### Compliance
- ✅ Dados não saem do ambiente corporativo
- ✅ Sem dependência de APIs externas
- ✅ Auditável (logs locais)

### Custo
- ✅ Gratuito (Ollama)
- ✅ Sem limite de requisições
- ✅ Escalável (adicione mais servidores Ollama)

### Performance
- ✅ Baixa latência (rede local)
- ✅ Alta disponibilidade (não depende de uptime de API)

---

## Suporte Empresarial

Se sua empresa precisa de:
- Setup customizado
- Integração com LLM interno
- Treinamento do time
- SLA

Entre em contato: (adicionar email/contato se quiser oferecer suporte pago)

---

**TL;DR:** APIs bloqueadas? Use Ollama (local) ou configure o LLM interno da empresa. Zero dependência de APIs externas.
