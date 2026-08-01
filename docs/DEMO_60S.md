# Demo 60s — Failure→Proof com mcp-lab-agent

Roteiro para gravar GIF/asciinema ou apresentar ao vivo.

## Setup (antes do relógio)

```bash
cd seu-projeto-com-teste
npx mcp-lab-agent --help
```

Tenha 1 spec que falhe (ou force um timeout/seletor quebrado).

## Script (60s)

| t | Ação | Fala |
|---|------|------|
| 0–10s | `npx mcp-lab-agent run --spec <spec-que-falha>` (ou tool `run_tests`) | “CI vermelho. Em vez de re-run, peço causa.” |
| 10–25s | Mostrar saída com **resumo em 1 frase** | “Em 1 frase: por que falhou + solução.” |
| 25–40s | `detect_flaky_tests` com `runs: 3` no mesmo spec | “É bug ou flaky? Rodo 3x.” |
| 40–55s | `report_flaky_tests` ou abrir artefato | “Histórico + % de falha.” |
| 55–60s | Link GitHub / post LinkedIn | “Isso vira prova pública — Failure→Proof.” |

## Comandos (MCP / CLI)

1. `run_tests` com o spec que falha  
2. `por_que_falhou` (se quiser detalhe)  
3. `detect_flaky_tests` `{ "spec": "...", "runs": 3 }`  
4. `report_flaky_tests`

## Critério de sucesso da demo

- Apareceu resumo em **1 frase** sem cavar stack trace  
- Veredito flaky vs always_failing  
- Próximo passo claro (fix / issue / wait)
