# CI gates and JSON run reports

English | [Português](#português)

## JSON report schema (`schemaVersion: 1.0`)

Each run can write `.qa-lab-reports/latest.json` with:

- `runId`, `timestamp`, `framework`, `spec`
- `command`: `{ cmd, args, cwd }`
- `exitCode`
- `summary`: `outcome`, `passedCount`, `failedCount`, `skippedCount`, `durationMs`
- `tests[]`: synthetic rows and/or parsed failures
- `artifacts.outputTail`: last 4k chars of runner output

## CLI

```bash
# Run tests and write JSON (always updates latest.json)
mcp-lab-agent run --json-report

# Custom output path
mcp-lab-agent run --json-report --output ./reports/run.json

# Save baseline after a green run (commit or store in CI artifacts)
mcp-lab-agent run --json-report --save-baseline .qa-lab-reports/baseline.json

# Fail CI if current run regresses vs baseline
mcp-lab-agent run --json-report --compare-baseline .qa-lab-reports/baseline.json

# Compare two reports without re-running tests
mcp-lab-agent audit --baseline .qa-lab-reports/baseline.json --current .qa-lab-reports/latest.json
```

Exit codes: `0` OK · `1` test or gate failure · `2` inconclusive audit.

## MCP

Tool `run_tests` accepts `writeJsonReport: true` to write the same JSON file.

## GitHub Actions (minimal)

See `.github/workflows/ci.yml` in this repository.

---

## Português

Relatórios JSON permitem **bloquear deploy** quando o resultado piora em relação a um **baseline** gerado em `main` ou em artefato de CI. Use `--compare-baseline` no job de testes.
