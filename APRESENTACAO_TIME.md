# 🎯 Apresentação: mcp-lab-agent v2.0

## 1 minuto: O que mudou

**Antes:** "Mais um assistente de QA"
**Agora:** **Agente autônomo que aprende com os próprios erros**

---

## Demo ao vivo (2 minutos)

```bash
# 1. Modo autônomo
npx mcp-lab-agent auto "login flow" --max-retries 5
```

**O que acontece na tela:**
```
🤖 Modo autônomo iniciado: "login flow"

[Tentativa 1/5] Gerando teste...
✅ Teste gravado: cypress/e2e/login-flow.cy.js

[Tentativa 1/5] Executando teste...
❌ Teste falhou (exit 1)

Saída:
CypressError: Timed out retrying after 4000ms: Expected to find element: `#login-button`

⚠️ Flaky detectado (0.70): selector

[Tentativa 1/5] Analisando falha...
[Tentativa 1/5] Aplicando correção...
✅ Correção aplicada.

[Tentativa 2/5] Executando teste...
✅ Teste passou na tentativa 2!

📊 Aprendizado salvo. Use "mcp-lab-agent stats" para ver métricas.
```

```bash
# 2. Métricas de evolução
npx mcp-lab-agent stats
```

**Saída:**
```
📊 Estatísticas de Aprendizado

Total de aprendizados: 15
Correções bem-sucedidas: 12
Correções de seletores: 8
Correções de timing: 4
Testes gerados: 15
Taxa de sucesso na 1ª tentativa: 60%
```

**Mensagem:** "A cada teste, o agente aprende. Taxa de sucesso aumenta com o tempo."

---

## Diferencial vs. Memorikbank

| Aspecto | Memorikbank | mcp-lab-agent |
|---------|-------------|---------------|
| **Natureza** | Banco de conhecimento passivo | Agente autônomo ativo |
| **Execução** | Não executa testes | Gera, executa e valida |
| **Correção** | Você consulta e corrige | Auto-correção com retry |
| **Aprendizado** | Estático (você alimenta) | Dinâmico (aprende com erros) |
| **Métricas** | Não tem | Taxa de sucesso, evolução |
| **Uso** | Consulta manual | 1 comando, tudo automático |

**Analogia:**
- **Memorikbank:** Biblioteca de padrões (você lê e aplica)
- **mcp-lab-agent:** Engenheiro júnior que executa, erra, corrige e melhora

**Não competem. Complementam:**
- Memorikbank: conhecimento da empresa
- mcp-lab-agent: executor autônomo que aprende

---

## Escalabilidade

### 1. Multi-projeto
- Cada projeto tem sua memória isolada
- Aprendizados específicos por contexto
- Suporte a monorepos (múltiplos frameworks)

### 2. CI/CD
```yaml
# .github/workflows/qa.yml
- name: QA autônomo
  run: npx mcp-lab-agent auto "smoke tests" --max-retries 2

- name: Métricas
  run: npx mcp-lab-agent stats
```

### 3. Métricas exportáveis
- `.qa-lab-memory.json` → JSON estruturado
- `stats` → integrável com Grafana/DataDog
- Dashboard de evolução do agente

### 4. Roadmap: Aprendizado compartilhado
- Exportar/importar memórias entre projetos
- Central de aprendizados da empresa
- Padrões globais + overrides locais

**Exemplo:**
```bash
# Time A aprende com seletores de login
mcp-lab-agent export-learnings --type selector > learnings.json

# Time B importa e reutiliza
mcp-lab-agent import-learnings learnings.json
```

---

## Números

| Métrica | Valor |
|---------|-------|
| Frameworks suportados | 15+ (Cypress, Playwright, Jest, Vitest, Robot, pytest, etc.) |
| Ferramentas MCP | 23 |
| Comandos CLI | 7 |
| Tempo de setup | 2 minutos |
| Configuração necessária | Zero (auto-detecção) |
| Dependências | Node.js 18+ |

---

## ROI

### Antes (manual)
1. Gera teste com IA: 2 min
2. Teste falha: 1 min
3. Você analisa erro: 5 min
4. Você corrige: 3 min
5. Roda de novo: 1 min
6. Ainda falha: repete 3-5

**Total:** 15-30 min por teste

### Com mcp-lab-agent
```bash
npx mcp-lab-agent auto "login flow"
```
**Total:** 2-5 min (tudo automático)

**Economia:** 10-25 min por teste × 10 testes/dia = **2-4 horas/dia por QA**

---

## Próximos passos

### Imediato (você pode testar agora)
1. `npx mcp-lab-agent auto "seu fluxo crítico"`
2. `npx mcp-lab-agent stats`

### Curto prazo (1-2 sprints)
- Integrar no CI/CD
- Dashboard de métricas
- Exportar aprendizados para Memorikbank

### Médio prazo (roadmap)
- Central de aprendizados da empresa
- Multi-projeto com aprendizado compartilhado
- Integração com Jira/Linear (auto-create issues)

---

## Perguntas frequentes

### "Isso não é só um wrapper de LLM?"
Não. É um **loop de feedback**: gera → executa → analisa → corrige → aprende. A cada ciclo, melhora.

### "Como escala para 50 projetos?"
Cada projeto tem memória isolada. Roadmap: central de aprendizados compartilhados.

### "E se o agente corrigir errado?"
Ele tenta até `--max-retries`. Se falhar, você vê o log completo e pode intervir. Mas a taxa de sucesso aumenta com o tempo.

### "Qual o custo de LLM?"
- Model routing: tarefas simples usam modelos baratos (Groq gratuito, Gemini Flash)
- Tarefas complexas usam modelos fortes
- Economia: ~70% das tarefas são simples

### "Substitui o Memorikbank?"
Não. **Complementa.** Memorikbank é conhecimento estratégico. mcp-lab-agent é executor tático que aprende.

---

## Call to Action

**Teste agora (5 minutos):**

```bash
# 1. Instale (se ainda não tiver)
npm install -g mcp-lab-agent

# 2. Configure API key (Groq é gratuito)
export GROQ_API_KEY="sua-key"

# 3. Rode no seu projeto
cd seu-projeto
mcp-lab-agent auto "login flow"

# 4. Veja as métricas
mcp-lab-agent stats
```

**Resultado esperado:** Teste gerado, executado, corrigido (se necessário) e aprendizado salvo.

---

**Conclusão:** mcp-lab-agent não é "mais uma ferramenta de QA". É um **agente que se auto-melhora**. A cada teste, ele fica mais inteligente.
