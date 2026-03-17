# ⚡ Guia Rápido v2.0

## 30 segundos: O que é?

**Agente autônomo de QA que aprende com os próprios erros.**

Um comando. Tudo automático:

```bash
npx mcp-lab-agent auto "login flow"
```

O agente:
1. Gera o teste
2. Executa
3. Se falhar: corrige e tenta de novo
4. Aprende com o erro
5. Próxima vez: acerta na 1ª tentativa

---

## 2 minutos: Setup

### 1. Configure API key (Groq é gratuito)

```bash
# Crie .env no seu projeto
echo "GROQ_API_KEY=sua-key-aqui" > .env
```

Obtenha a key: https://console.groq.com/keys

### 2. Teste

```bash
npx mcp-lab-agent auto "login flow"
```

### 3. Veja as métricas

```bash
npx mcp-lab-agent stats
```

**Pronto.** Você tem um agente autônomo de QA.

---

## 5 minutos: Integração com IDE

### Cursor/Cline/Windsurf

**1. Adicione ao `~/.cursor/mcp.json`:**

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

**2. Reinicie o IDE**

**3. Use no chat:**

```
"Modo autônomo: gere teste para checkout"
"Mostre as estatísticas de aprendizado"
```

---

## Comandos essenciais

### CLI

```bash
# Modo autônomo (gera, roda, corrige, aprende)
mcp-lab-agent auto "descrição do teste" --max-retries 5

# Métricas de aprendizado
mcp-lab-agent stats

# Detectar estrutura do projeto
mcp-lab-agent detect

# Ajuda
mcp-lab-agent --help
```

### Chat (Cursor)

```
"Modo autônomo: gere teste para login"
"Rode os testes"
"Por que o teste falhou?"
"Mostre as estatísticas de aprendizado"
"Avalie http://localhost:3000 no browser"
```

---

## Como funciona?

### Primeira vez (sem aprendizados)

```bash
$ mcp-lab-agent auto "login flow"
```

```
[Tentativa 1/3] Gerando teste...
✅ Teste gravado: cypress/e2e/login-flow.cy.js

[Tentativa 1/3] Executando teste...
❌ Teste falhou (exit 1)

Saída:
CypressError: Timed out retrying: Expected to find element: `.login-button`

⚠️ Flaky detectado (0.70): selector

[Tentativa 1/3] Analisando falha...
[Tentativa 1/3] Aplicando correção...
✅ Correção aplicada.

[Tentativa 2/3] Executando teste...
✅ Teste passou na tentativa 2!

📊 Aprendizado salvo.
```

**Aprendizado salvo:** "Use data-testid em vez de classes CSS"

---

### Segunda vez (com aprendizados)

```bash
$ mcp-lab-agent auto "logout flow"
```

```
[Tentativa 1/1] Gerando teste...
✅ Teste gravado: cypress/e2e/logout-flow.cy.js

[Tentativa 1/1] Executando teste...
✅ Teste passou na tentativa 1!

📊 Aprendizado salvo.
```

**Resultado:** Usou o aprendizado anterior. Passou direto.

---

### Métricas

```bash
$ mcp-lab-agent stats
```

```
📊 Estatísticas de Aprendizado

Total de aprendizados: 2
Correções bem-sucedidas: 1
Correções de seletores: 1
Correções de timing: 0
Testes gerados: 2
Taxa de sucesso na 1ª tentativa: 50%
```

**Após 10 testes:** Taxa de sucesso → 70%
**Após 20 testes:** Taxa de sucesso → 85%

---

## Casos de uso

### 1. Gerar testes rapidamente

```bash
mcp-lab-agent auto "cadastro de usuário"
mcp-lab-agent auto "busca de produtos"
mcp-lab-agent auto "carrinho de compras"
```

### 2. CI/CD

```yaml
# .github/workflows/qa.yml
- name: Testes autônomos
  run: |
    npm install -g mcp-lab-agent
    mcp-lab-agent auto "smoke tests" --max-retries 2
    mcp-lab-agent stats
```

### 3. Onboarding de QA

```bash
# Novo QA no time
git clone projeto
cd projeto
mcp-lab-agent auto "fluxo crítico 1"
mcp-lab-agent auto "fluxo crítico 2"

# O agente já aprendeu os padrões do projeto
mcp-lab-agent stats
# Taxa de sucesso: 80% (porque o projeto já tem aprendizados)
```

---

## FAQ Rápido

### Precisa configurar algo?
**Não.** Detecta automaticamente 15+ frameworks.

### Funciona com meu framework?
**Sim.** Cypress, Playwright, Jest, Vitest, Robot, pytest, etc.

### Quanto custa?
**Groq é gratuito.** Ou use Gemini/OpenAI.

### E se o agente errar?
Ele tenta até `--max-retries` (default: 3). Você vê o log completo.

### Posso usar sem CLI?
**Sim.** Configure o MCP no Cursor e use no chat.

### Onde ficam os aprendizados?
`.qa-lab-memory.json` no seu projeto. Pode adicionar ao `.gitignore`.

---

## Próximo passo

```bash
npx mcp-lab-agent auto "seu fluxo mais crítico" --max-retries 5
```

**Tempo:** 2-5 min (tudo automático)
**Resultado:** Teste funcionando + aprendizado salvo

---

**Dúvidas?** `mcp-lab-agent --help`
