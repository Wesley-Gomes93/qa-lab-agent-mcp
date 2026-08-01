# Bug Report: generate_tests + write_test — arquivos de teste vazios / "No tests found"

**Repositório:** [github.com/Wesley-Gomes93/mcp-lab-agent](https://github.com/Wesley-Gomes93/mcp-lab-agent)  
**Data:** 2026-03-19  
**Severidade:** Alta — fluxo principal de geração de testes quebrado no IDE

---

## Resumo

O agente não está escrevendo o conteúdo dos testes nos arquivos. Ao rodar os testes gerados (ex.: Playwright), o erro é:

```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
```

**Causa raiz identificada:** O `generate_tests` retorna o código gerado apenas em `structuredContent.specContent`, mas o texto em `content` não inclui o código. O cliente MCP (IDE) pode receber apenas `content`, então o agente não tem acesso ao `specContent` para passar ao `write_test`. Resultado: `write_test` é chamado com `content` vazio ou incorreto, gerando arquivos vazios.

---

## Possíveis causas (hipóteses)

| # | Causa | Probabilidade | Evidência |
|---|-------|----------------|-----------|
| 1 | **Orquestração IDE:** O agente não extrai `specContent` do resultado de `generate_tests` e passa string vazia ao `write_test` | **Alta** | O MCP retorna `content` (texto) e `structuredContent` (JSON). O protocolo MCP padrão prioriza `content`. Se o cliente não expõe `structuredContent` ao LLM, o agente não vê o código. |
| 2 | **Bug na geração pelo LLM:** `specContent` vem vazio da API | Média | Verificar se `GROQ_API_KEY`/`GEMINI_API_KEY` está configurado e se a API retorna conteúdo. |
| 3 | **Erro ao salvar:** `write_test` falha silenciosamente | Baixa | O código usa `fs.writeFileSync`; erros seriam propagados. |
| 4 | **Formato incompatível com Playwright:** Código gerado sem `test()` ou imports corretos | Média | Playwright espera `import { test } from '@playwright/test'` e `test('...', async ({ page }) => {...})`. |

---

## Fluxo atual (problemático)

```
1. Usuário: "Crie teste para login com o qa-lab-agent"
2. Agente chama detect_project
3. Agente chama generate_tests(context, request, framework)
   → Retorno: content: "Spec gerado (1234 chars). Use write_test para gravar."
   → Retorno: structuredContent: { specContent: "const { test } = require('@playwright/test');\n..." }
4. Agente chama write_test(name, content, framework)
   → content = ??? (agente não tem specContent se só viu o text de content)
5. write_test grava content no disco
   → Se content vazio → arquivo vazio → "No tests found"
```

---

## Solução proposta

### 1. Incluir `specContent` no `content` de `generate_tests`

Para que o agente sempre tenha acesso ao código, independente de como o cliente MCP expõe o resultado:

```javascript
// Antes
content: [{ type: "text", text: `Spec gerado (${specContent.length} chars). Use write_test para gravar.` }],

// Depois
content: [{ type: "text", text: `Spec gerado (${specContent.length} chars). Use write_test para gravar.\n\n--- Código (passe em content para write_test) ---\n${specContent}` }],
```

Assim o agente vê o código completo no texto e pode passá-lo ao `write_test`.

### 2. Validar `content` em `write_test`

Rejeitar gravação de conteúdo vazio:

```javascript
if (!content || !content.trim()) {
  return {
    content: [{ type: "text", text: "Erro: content não pode ser vazio. Use generate_tests primeiro e passe specContent em content." }],
    structuredContent: { ok: false, error: "Empty content" },
  };
}
```

### 3. (Opcional) Ferramenta composta `generate_and_write_test`

Uma ferramenta que chama generate_tests internamente e grava o arquivo em uma única chamada, eliminando a orquestração em duas etapas. O `qa_auto` já faz isso; poderia ser exposto como tool para o IDE.

---

## Workaround imediato

**Usar testes criados manualmente** até a correção. Ou usar o comando CLI:

```bash
npx mcp-lab-agent auto "login flow" --max-retries 3
```

O `qa_auto` (modo autônomo) gera e grava internamente, sem depender da orquestração generate_tests → write_test.

---

## Ambiente de reprodução

- **IDE:** IDE
- **MCP:** mcp-lab-agent (npx -y mcp-lab-agent@latest)
- **Framework de teste:** Playwright
- **Sintoma:** "No tests found" ao rodar testes gerados via chat

---

## Checklist para o mantenedor

- [ ] Incluir specContent no content de generate_tests
- [ ] Adicionar validação de content vazio em write_test
- [ ] Adicionar teste E2E: generate_tests → write_test → run_tests (verificar que arquivo tem conteúdo)
- [ ] Documentar no README que o agente deve passar specContent de generate_tests para write_test
