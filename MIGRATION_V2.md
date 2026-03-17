# 🔄 Guia de Migração: v1.x → v2.0

## O que mudou?

### Novas funcionalidades
- ✅ **Modo autônomo:** `qa_auto` (loop completo: gera → roda → corrige → aprende)
- ✅ **Sistema de learning:** Aprendizados salvos em `.qa-lab-memory.json`
- ✅ **Métricas:** `qa_learning_stats` e comando `stats`
- ✅ **CLI expandido:** Comandos `auto` e `stats`

### Breaking changes
**Nenhum.** Todas as ferramentas anteriores continuam funcionando.

---

## Migração

### Se você usa via MCP (Cursor/Cline/Windsurf)

**Nada muda.** Apenas atualize:

```bash
# Reinicie o Cursor
# O npx vai baixar automaticamente a v2.0.0
```

Ou force a atualização:

```bash
npm install -g mcp-lab-agent@latest
```

### Se você usa via CLI

**Comandos antigos continuam funcionando:**

```bash
mcp-lab-agent detect        # ✅ Funciona
mcp-lab-agent route "task"  # ✅ Funciona
mcp-lab-agent list          # ✅ Funciona
```

**Novos comandos disponíveis:**

```bash
mcp-lab-agent auto "login flow" --max-retries 5  # Novo
mcp-lab-agent stats                              # Novo
```

---

## Novos arquivos gerados

A partir da v2.0, o agente cria/atualiza:

```
.qa-lab-memory.json  ← [NOVO] Contém aprendizados
```

**Estrutura:**
```json
{
  "patterns": {},
  "conventions": {},
  "selectors": [],
  "learnings": [
    {
      "type": "selector_fix",
      "request": "login flow",
      "framework": "cypress",
      "fix": "cy.get('[data-testid=\"login-button\"]').click();",
      "success": true,
      "timestamp": "2026-03-17T17:30:00.000Z"
    }
  ],
  "lastRun": {},
  "updatedAt": "2026-03-17T17:40:00.000Z"
}
```

**Recomendação:** Adicione ao `.gitignore` se não quiser commitar aprendizados.

```gitignore
.qa-lab-memory.json
```

---

## Novas variáveis de ambiente (opcionais)

```bash
# Model routing (opcional)
QA_LAB_LLM_SIMPLE=gemini-1.5-flash    # Modelo para tarefas simples
QA_LAB_LLM_COMPLEX=gpt-4o             # Modelo para tarefas complexas
```

Se não configuradas, usa defaults:
- Simple: `llama-3.1-8b-instant` (Groq), `gemini-1.5-flash` (Gemini), `gpt-4o-mini` (OpenAI)
- Complex: `llama-3.3-70b-versatile` (Groq), `gemini-1.5-pro` (Gemini), `gpt-4o` (OpenAI)

---

## Testando a v2.0

### 1. Modo autônomo

```bash
cd seu-projeto-com-testes
npx mcp-lab-agent auto "login flow"
```

**Esperado:**
- Detecta framework
- Gera teste
- Executa
- Se falhar: corrige e tenta de novo
- Salva aprendizado

### 2. Métricas

```bash
npx mcp-lab-agent stats
```

**Esperado:**
```
📊 Estatísticas de Aprendizado

Total de aprendizados: 1
Correções bem-sucedidas: 1
Correções de seletores: 1
Correções de timing: 0
Testes gerados: 1
Taxa de sucesso na 1ª tentativa: 0%

(taxa aumenta com mais testes)
```

### 3. Ferramentas antigas (compatibilidade)

No chat do Cursor:

```
"Detecte a estrutura do meu projeto"  ← Funciona
"Rode os testes"                      ← Funciona
"Gere um teste E2E para login"        ← Funciona
"Por que o teste falhou?"             ← Funciona
```

---

## FAQ

### Preciso reconfigurar o MCP?
**Não.** Se você já tem `qa-lab-agent` no `mcp.json`, basta reiniciar o Cursor.

### Meus testes antigos continuam funcionando?
**Sim.** A v2.0 é 100% retrocompatível.

### O que acontece com `.qa-lab-memory.json` se eu deletar?
O agente cria um novo (vazio) e começa a aprender do zero.

### Posso desabilitar o learning?
Tecnicamente sim (deletando `.qa-lab-memory.json` após cada execução), mas você perde o diferencial.

### Como migrar aprendizados entre projetos?
Atualmente: copie `.qa-lab-memory.json` manualmente.
Roadmap: `mcp-lab-agent export-learnings` e `import-learnings`.

---

## Rollback (se necessário)

Se precisar voltar para v1.1.2:

```bash
npm install -g mcp-lab-agent@1.1.2
```

Ou no `mcp.json`:

```json
{
  "mcpServers": {
    "qa-lab-agent": {
      "command": "npx",
      "args": ["-y", "mcp-lab-agent@1.1.2"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

---

## Suporte

- **Issues:** [GitHub Issues](https://github.com/Wesley-Gomes93/mcp-lab-agent/issues)
- **Docs:** `mcp-lab-agent --help`
- **Referência completa:** `docs/REFERENCIA_COMPLETA.md` (local)

---

**Conclusão:** Migração é transparente. Novas funcionalidades são opt-in (você escolhe usar `auto` ou continuar com as ferramentas individuais).
