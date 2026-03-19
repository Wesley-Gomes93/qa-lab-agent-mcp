#!/bin/bash
# Gera relatório de métricas do mcp-lab-agent.
# Use na pasta do projeto onde você rodou o agente (Slack, analyze, etc.)
#
# Uso:
#   cd /caminho/do/projeto    # pasta que tem .qa-lab-memory.json e .qa-lab-metrics.json
#   npx mcp-lab-agent@latest metrics-report --output qa-metrics-report.md
#
# Ou com caminhos explícitos:
#   npx mcp-lab-agent@latest metrics-report /caminho/projeto1 /caminho/projeto2 --output relatorio.md

set -e

OUTPUT="qa-metrics-report.md"
PATHS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    *)
      PATHS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#PATHS[@]} -eq 0 ]]; then
  npx mcp-lab-agent@latest metrics-report --output "$OUTPUT"
else
  npx mcp-lab-agent@latest metrics-report --output "$OUTPUT" "${PATHS[@]}"
fi

echo ""
echo "Relatório salvo em: $(pwd)/$OUTPUT"
