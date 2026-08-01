# mcp-lab-agent — CLI

Interface de linha de comando para uso rápido sem abrir a IDE.

---

## Instalação

```bash
npm install -g mcp-lab-agent
# ou
npx mcp-lab-agent <comando>
```

---

## Comandos

| Comando | Descrição |
|---------|-----------|
| `mcp-lab-agent` | Sem argumentos: inicia o servidor MCP (usado pela IDE) |
| `mcp-lab-agent --help` | Exibe ajuda |
| `mcp-lab-agent detect` | Detecta frameworks e estrutura do projeto (JSON) |
| `mcp-lab-agent route "tarefa"` | Sugere qual ferramenta usar para a tarefa |
| `mcp-lab-agent list` | Lista agentes e ferramentas MCP disponíveis |

---

## Exemplos

### Detectar estrutura do projeto

```bash
cd seu-projeto
mcp-lab-agent detect
```

Saída (JSON):

```json
{
  "hasTests": true,
  "testFrameworks": ["cypress", "jest"],
  "testDirs": ["cypress", "__tests__"],
  "hasBackend": true,
  "backendDir": "src",
  "hasFrontend": true,
  "frontendDir": "src"
}
```

### Sugerir ferramenta para uma tarefa

```bash
mcp-lab-agent route "rodar os testes"
mcp-lab-agent route "gerar teste de login"
mcp-lab-agent route "analisar por que o teste falhou"
mcp-lab-agent route "avaliar app no browser"
```

Saída:

```json
{
  "suggestedAgent": "execution",
  "suggestedTools": ["run_tests", "watch_tests", "get_test_coverage"],
  "description": "Execução de testes e cobertura"
}
```

### Listar ferramentas

```bash
mcp-lab-agent list
```

---

## Uso no MCP

O modo principal é via **MCP** na IDE. O CLI serve para:

- Validar a detecção antes de configurar o MCP
- Descobrir qual ferramenta usar
- Scripts e automações que precisam apenas de detecção

---

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `GROQ_API_KEY` | LLM (generate_tests, por_que_falhou) |
| `GEMINI_API_KEY` | LLM alternativo |
| `OPENAI_API_KEY` | LLM alternativo |

O CLI `detect` e `list` não usam API keys.
