# 🚀 mcp-lab-agent: Agente Autônomo de QA

## O Problema

**Ferramentas de QA tradicionais:**
- Geram testes, mas você corrige os erros manualmente
- Não aprendem com erros passados
- Sem contexto do projeto
- Configuração complexa e específica para cada framework

**Resultado:** QA continua sendo um gargalo manual.

---

## A Solução

**mcp-lab-agent** é um **agente autônomo que aprende com os próprios erros**.

### O que ele faz de diferente?

```
Outras ferramentas:          mcp-lab-agent:
┌─────────────────┐          ┌─────────────────┐
│ Gera teste      │          │ Gera teste      │
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
    ❌ Falhou                    ❌ Falhou
         │                            │
    (você corrige)                    ▼
                              ┌─────────────────┐
                              │ Analisa falha   │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Corrige auto    │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Roda de novo    │
                              └────────┬────────┘
                                       │
                                       ▼
                                  ✅ Passou
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Aprende         │
                              │ (salva correção)│
                              └─────────────────┘
```

---

## Demo: 1 comando

```bash
npx mcp-lab-agent auto "login flow" --max-retries 5
```

**O que acontece:**
1. Detecta seu projeto (Cypress, Playwright, Jest, etc.)
2. Gera o teste usando LLM + aprendizados anteriores
3. Executa o teste
4. **Se falhar:**
   - Analisa o erro (flaky detection: timing, selector, network)
   - Corrige automaticamente
   - Tenta de novo
5. **Aprende:** Salva a correção bem-sucedida
6. **Próxima vez:** Usa esse aprendizado para acertar na 1ª tentativa

**Métricas:**
```bash
npx mcp-lab-agent stats
```

Mostra:
- Taxa de sucesso na 1ª tentativa (melhora com o tempo)
- Correções aplicadas (seletores, timing, network)
- Total de testes gerados

---

## Diferencial vs. Memorikbank

| Memorikbank | mcp-lab-agent |
|-------------|---------------|
| Armazena conhecimento estático | **Aprende dinamicamente com erros** |
| Banco de dados de padrões | **Loop autônomo de auto-correção** |
| Você consulta e aplica | **Agente executa, corrige e aprende sozinho** |
| Sem execução de testes | **Gera, roda, corrige e valida** |
| Sem métricas de evolução | **Taxa de sucesso aumenta com o tempo** |

**Memorikbank é passivo. mcp-lab-agent é autônomo.**

---

## Escalabilidade

### Multi-projeto
- Cada projeto tem sua própria memória (`.qa-lab-memory.json`)
- Aprendizados isolados por contexto
- Suporte a monorepos

### CI/CD
```yaml
# .github/workflows/qa.yml
- run: npx mcp-lab-agent auto "smoke tests" --max-retries 2
- run: npx mcp-lab-agent stats
```

### Métricas exportáveis
- `.qa-lab-memory.json` pode ser lido por dashboards
- `stats` retorna JSON estruturado
- Integração com Grafana/DataDog via script

### Roadmap: Aprendizado compartilhado
- Exportar/importar memórias entre projetos
- Central de aprendizados da empresa
- Padrões globais + overrides locais

---

## Por que isso é "wow"?

### 1. Zero configuração
```bash
npx mcp-lab-agent auto "checkout flow"
```
Detecta automaticamente: Cypress, Playwright, Jest, Vitest, Robot, pytest, etc.

### 2. Auto-melhoria mensurável
```bash
npx mcp-lab-agent stats
```
Taxa de sucesso na 1ª tentativa: 30% → 60% → 85% (ao longo do tempo)

### 3. Integração IDE
Funciona no Cursor, Cline, Windsurf — qualquer IDE com MCP.

### 4. Flaky-aware
Detecta padrões de testes intermitentes:
- Timing issues → sugere waits explícitos
- Seletores frágeis → sugere data-testid
- Network flaky → sugere mocks ou retries

### 5. Model routing
- Tarefas simples → modelo barato (Groq llama-3.1-8b)
- Tarefas complexas → modelo forte (llama-3.3-70b, gpt-4o)
- **Economia de custo** sem perder qualidade

---

## Tecnologia

- **Node.js 18+** (não precisa Python, uv, etc.)
- **MCP (Model Context Protocol)** — padrão aberto
- **LLMs:** Groq (gratuito), Gemini, OpenAI
- **Playwright** (opcional) para browser mode
- **15+ frameworks** suportados

---

## Próximos passos

1. **Teste agora:**
   ```bash
   npx mcp-lab-agent auto "seu fluxo crítico"
   ```

2. **Integre no CI/CD:**
   ```yaml
   - run: npx mcp-lab-agent auto "smoke tests"
   ```

3. **Acompanhe a evolução:**
   ```bash
   npx mcp-lab-agent stats
   ```

---

## Contato

- **GitHub:** [Wesley-Gomes93/mcp-lab-agent](https://github.com/Wesley-Gomes93/mcp-lab-agent)
- **npm:** [mcp-lab-agent](https://www.npmjs.com/package/mcp-lab-agent)
- **Autor:** Wesley Gomes

---

**TL;DR:** Não é um banco de conhecimento. É um agente que **executa, erra, corrige e aprende** — e cada vez acerta mais.
