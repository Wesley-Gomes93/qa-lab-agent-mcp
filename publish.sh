#!/bin/bash

# Script de Publicação do mcp-lab-agent
# Uso: ./publish.sh [CODIGO_2FA]

set -e

echo "🚀 Publicando mcp-lab-agent..."
echo ""

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
  echo "❌ Erro: package.json não encontrado"
  echo "Execute este script no diretório do qa-lab-agent-mcp"
  exit 1
fi

# Verificar versão
VERSION=$(node -p "require('./package.json').version")
echo "📦 Versão: $VERSION"
echo ""

# Verificar se está logado
echo "🔐 Verificando login npm..."
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ Você não está logado no npm"
  echo "Execute: npm login"
  exit 1
fi

USER=$(npm whoami)
echo "✅ Logado como: $USER"
echo ""

# Build
echo "🔨 Executando build..."
npm run build
echo "✅ Build concluído"
echo ""

# Publicar
echo "📤 Publicando no npm..."
echo ""

if [ -z "$1" ]; then
  echo "⚠️  Sua conta tem 2FA ativado."
  echo ""
  echo "Para publicar, execute:"
  echo "  ./publish.sh CODIGO_2FA"
  echo ""
  echo "Onde CODIGO_2FA é o código de 6 dígitos do seu autenticador."
  echo ""
  echo "Ou execute manualmente:"
  echo "  npm publish --access public --otp=CODIGO_2FA"
  exit 0
fi

OTP=$1
echo "🔑 Usando código 2FA: $OTP"
npm publish --access public --otp=$OTP

echo ""
echo "✅ Publicado com sucesso!"
echo ""
echo "🔗 Verificar em: https://www.npmjs.com/package/mcp-lab-agent"
echo ""
echo "📊 Testar instalação:"
echo "  npm install -g mcp-lab-agent@$VERSION"
echo "  mcp-lab-agent --version"
