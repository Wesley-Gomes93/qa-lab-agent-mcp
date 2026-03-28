# 📦 Como Publicar o mcp-lab-agent

## Pré-requisitos

1. Ter conta no npm: https://www.npmjs.com/signup
2. Estar logado: `npm login`
3. Build atualizado: `npm run build`
4. Versão atualizada no `package.json`
5. CHANGELOG atualizado

## Passos para Publicar

### 1. Atualizar Versão

```bash
# Editar package.json manualmente ou usar:
npm version patch  # 2.1.11 -> 2.1.12
npm version minor  # 2.1.11 -> 2.2.0
npm version major  # 2.1.11 -> 3.0.0
```

### 2. Atualizar CHANGELOG.md

Adicionar seção com:
- Número da versão e data
- Lista de mudanças (fix, feat, breaking changes)
- Exemplos de uso se relevante

### 3. Build

```bash
npm run build
```

### 4. Testar Localmente

```bash
# Link global
npm link

# Testar em outro projeto
cd /path/to/test-project
mcp-lab-agent auto "teste" --max-retries 3
```

### 5. Commit e Tag

```bash
git add -A
git commit -m "feat: description of changes"
git tag v2.2.0
git push origin main
git push origin v2.2.0
```

### 6. Login no npm (se necessário)

```bash
npm login
# Abre browser para autenticação
```

### 7. Publicar

```bash
npm publish
```

### 8. Verificar Publicação

```bash
npm view mcp-lab-agent
npm view mcp-lab-agent versions
```

### 9. Testar Instalação

```bash
# Em outro diretório
npm install -g mcp-lab-agent
mcp-lab-agent --version
```

## 🚨 Troubleshooting

### Erro: "You do not have permission to publish"

```bash
# Verificar quem está logado
npm whoami

# Verificar permissões do pacote
npm access list packages

# Se for colaborador, pedir acesso ao owner
```

### Erro: "version already exists"

```bash
# Atualizar versão no package.json
# Fazer novo commit e tag
```

### Erro: "prepublishOnly script failed"

```bash
# Verificar se build está funcionando
npm run build

# Verificar se há erros de lint/test
npm test
```

## 📝 Checklist de Publicação

- [ ] Versão atualizada no `package.json`
- [ ] CHANGELOG.md atualizado
- [ ] Build executado com sucesso (`npm run build`)
- [ ] Testado localmente com `npm link`
- [ ] Commit feito
- [ ] Tag criada e pushed
- [ ] Login no npm feito
- [ ] `npm publish` executado
- [ ] Verificado no npmjs.com
- [ ] Testado instalação global

## 🎯 Versão Atual

**v2.2.0** - Correção crítica do modo auto + correção automática implementada
