# 📦 Checklist de Publicação v2.0.0

## Pré-publicação

### ✅ Verificações técnicas

- [x] Código implementado
- [x] Build funcionando (`npm run build`)
- [x] Testes passando (`npm test`)
- [x] Linter sem erros
- [x] CLI testado (detect, route, list, auto, stats, --help)
- [x] Versão atualizada (2.0.0)
- [x] package.json atualizado (descrição, keywords)

### ✅ Documentação

- [x] README.md atualizado
- [x] CHANGELOG.md criado
- [x] PITCH.md criado
- [x] EXEMPLO_EVOLUCAO.md criado
- [x] ARQUITETURA_LEARNING.md criado
- [x] MIGRATION_V2.md criado
- [x] APRESENTACAO_TIME.md criado
- [x] GUIA_RAPIDO_V2.md criado
- [x] RESUMO_V2.md criado
- [x] docs/REFERENCIA_COMPLETA.md atualizado

---

## Publicação no npm

### 1. Verificar login

```bash
npm whoami
```

Se não estiver logado:

```bash
npm login
```

### 2. Verificar o que será publicado

```bash
npm pack --dry-run
```

**Esperado:**
- `dist/index.js` (113 KB)
- `dist/index.js.map` (192 KB)
- `README.md` (9 KB)
- `package.json` (1.4 KB)
- `qa-lab-flows.json.example` (394 B)

**Total:** ~320 KB

### 3. Publicar

```bash
npm publish
```

**Resultado esperado:**
```
+ mcp-lab-agent@2.0.0
```

### 4. Verificar publicação

```bash
npm view mcp-lab-agent
```

Ou: https://www.npmjs.com/package/mcp-lab-agent

---

## Git e GitHub

### 1. Commit das mudanças

```bash
git add .
git commit -m "v2.0.0: Agente autônomo que aprende com os próprios erros

- Adiciona qa_auto (loop completo: gera, roda, corrige, aprende)
- Sistema de learning (salva correções bem-sucedidas)
- Métricas de aprendizado (qa_learning_stats)
- Comandos CLI: auto e stats
- README reescrito com novo pitch
- Documentação expandida (PITCH, EXEMPLO_EVOLUCAO, ARQUITETURA_LEARNING)
"
```

### 2. Criar tag

```bash
git tag v2.0.0
git push origin main
git push origin v2.0.0
```

### 3. Criar release no GitHub

```bash
gh release create v2.0.0 \
  --title "v2.0.0 - Agente Autônomo que Aprende" \
  --notes-file CHANGELOG.md
```

Ou manualmente: https://github.com/Wesley-Gomes93/mcp-lab-agent/releases/new

**Conteúdo do release:**
- Tag: `v2.0.0`
- Title: `v2.0.0 - Agente Autônomo que Aprende`
- Description: Copiar de `CHANGELOG.md`

---

## Pós-publicação

### 1. Testar instalação

```bash
# Em outro diretório
cd /tmp
npx mcp-lab-agent@latest --help
```

### 2. Atualizar documentação (se necessário)

Se você quiser que os arquivos de documentação fiquem disponíveis no GitHub:

```bash
# Remover docs/ do .gitignore
# Commitar os arquivos de docs/
git add docs/
git commit -m "docs: Adiciona documentação completa"
git push origin main
```

**Ou deixar local:** Manter `docs/` no `.gitignore` (usuários podem gerar localmente).

### 3. Anunciar

**LinkedIn:**
```
🚀 Lancei o mcp-lab-agent v2.0!

Não é só um assistente de QA. É um agente autônomo que:
- Gera testes
- Executa
- Corrige erros automaticamente
- Aprende para acertar mais na próxima

1 comando: npx mcp-lab-agent auto "login flow"

Taxa de sucesso aumenta com o tempo. Testado em 15+ frameworks.

#QA #Testing #AI #Automation
```

**Twitter/X:**
```
🤖 mcp-lab-agent v2.0: Agente autônomo de QA que aprende com os próprios erros

1 comando: npx mcp-lab-agent auto "login flow"

Gera → Executa → Corrige → Aprende

Taxa de sucesso aumenta com o tempo 📈

https://github.com/Wesley-Gomes93/mcp-lab-agent
```

**Dev.to / Medium:**
Artigo: "Como construí um agente de QA que aprende com os próprios erros"
- Problema
- Solução técnica (loop de feedback)
- Resultados (taxa de sucesso aumenta)
- Código-chave (learning system)

---

## Roadmap pós-v2.0

### Próximas features (v2.1)
- [ ] Export/import de aprendizados
- [ ] Dashboard web de métricas
- [ ] Integração com GitHub Actions (action oficial)

### Médio prazo (v3.0)
- [ ] Central de learnings (API REST)
- [ ] Aprendizado compartilhado entre projetos
- [ ] Embeddings para busca semântica de correções

---

## Suporte

- **Issues:** https://github.com/Wesley-Gomes93/mcp-lab-agent/issues
- **Docs:** `mcp-lab-agent --help`
- **Email:** (adicionar se quiser)

---

## Checklist final

- [ ] npm publish
- [ ] git tag v2.0.0
- [ ] git push
- [ ] GitHub release
- [ ] Anunciar no LinkedIn
- [ ] Atualizar README badges (se necessário)
- [ ] Responder issues antigas (se houver)

---

**Pronto para publicar!** 🚀
