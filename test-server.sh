#!/bin/bash

echo "🧪 Testando mcp-lab-agent..."
echo ""

# Verificar Node.js
echo "1️⃣ Verificando Node.js..."
node --version || { echo "❌ Node.js não encontrado"; exit 1; }
echo "✅ Node.js OK"
echo ""

# Verificar build
echo "2️⃣ Verificando build..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ dist/index.js não encontrado. Execute: npm run build"
    exit 1
fi
echo "✅ Build OK"
echo ""

# Verificar dependências
echo "3️⃣ Verificando dependências..."
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules não encontrado. Execute: npm install"
    exit 1
fi
echo "✅ Dependências OK"
echo ""

# Verificar se o arquivo é executável
echo "4️⃣ Verificando permissões..."
if [ ! -x "dist/index.js" ]; then
    echo "⚠️  Arquivo não executável. Corrigindo..."
    chmod +x dist/index.js
fi
echo "✅ Permissões OK"
echo ""

# Verificar shebang
echo "5️⃣ Verificando shebang..."
FIRST_LINE=$(head -1 dist/index.js)
if [[ "$FIRST_LINE" == "#!/usr/bin/env node" ]]; then
    echo "✅ Shebang OK"
else
    echo "❌ Shebang incorreto: $FIRST_LINE"
    exit 1
fi
echo ""

# Verificar estrutura do código
echo "6️⃣ Verificando estrutura do código..."
if grep -q "McpServer" dist/index.js; then
    echo "✅ McpServer encontrado"
else
    echo "❌ McpServer não encontrado no build"
    exit 1
fi
echo ""

# Teste de sintaxe
echo "7️⃣ Testando sintaxe do arquivo..."
node --check dist/index.js && echo "✅ Sintaxe OK" || { echo "❌ Erro de sintaxe"; exit 1; }
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TODOS OS TESTES PASSARAM!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Configure o MCP no Cursor (~/.cursor/mcp.json):"
echo ""
echo '   {
     "mcpServers": {
       "qa-lab": {
         "command": "node",
         "args": ["'$(pwd)'/dist/index.js"],
         "cwd": "${workspaceFolder}"
       }
     }
   }'
echo ""
echo "2. Reinicie o Cursor"
echo ""
echo "3. Teste em um projeto com testes (Cypress, Playwright, Jest)"
echo ""
echo "4. No chat do Cursor, digite: 'Detecte a estrutura do meu projeto'"
echo ""
