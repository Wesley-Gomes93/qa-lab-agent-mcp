#!/bin/bash

echo "🔗 Instalando mcp-lab-agent globalmente..."
echo ""
echo "Este comando precisa de permissões de administrador."
echo "Você será solicitado a digitar sua senha."
echo ""

# Verificar se o build existe
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build não encontrado. Execute primeiro:"
    echo "   npm run build"
    exit 1
fi

# Fazer o link global
echo "Executando: sudo npm link"
sudo npm link

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Instalação global concluída!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Agora você pode usar no Cursor com esta configuração:"
    echo ""
    echo '{
  "mcpServers": {
    "qa-lab": {
      "command": "mcp-lab-agent",
      "cwd": "${workspaceFolder}"
    }
  }
}'
    echo ""
    echo "Ou testar no terminal:"
    echo "   mcp-lab-agent"
    echo ""
else
    echo ""
    echo "❌ Erro ao fazer o link global."
    echo ""
    echo "Alternativa: Use o build local sem sudo"
    echo ""
    echo "Configure no ~/.cursor/mcp.json:"
    echo ""
    echo '{
  "mcpServers": {
    "qa-lab": {
      "command": "node",
      "args": ["'$(pwd)'/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}'
    echo ""
fi
