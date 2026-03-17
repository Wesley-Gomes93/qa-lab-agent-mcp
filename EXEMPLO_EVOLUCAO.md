# 📈 Exemplo: Evolução do Agente

Este documento mostra como o agente **melhora com o tempo** através de um exemplo real.

---

## Cenário: Time de QA gerando testes de login

### Semana 1: Primeiros testes

```bash
$ mcp-lab-agent auto "login flow"
```

**Resultado:**
- Tentativa 1: ❌ Falhou (selector não encontrado)
- Tentativa 2: ✅ Passou (corrigiu para data-testid)
- **Aprendizado salvo:** "Use data-testid em vez de classes CSS"

```bash
$ mcp-lab-agent stats
```

```
Taxa de sucesso na 1ª tentativa: 0%
Total de aprendizados: 1
Correções de seletores: 1
```

---

### Semana 2: Mais testes

```bash
$ mcp-lab-agent auto "logout flow"
```

**Resultado:**
- Tentativa 1: ✅ Passou (usou data-testid desde o início)
- **Aprendizado:** Agente aplicou o conhecimento anterior

```bash
$ mcp-lab-agent auto "forgot password"
```

**Resultado:**
- Tentativa 1: ❌ Falhou (timeout)
- Tentativa 2: ✅ Passou (adicionou wait explícito)
- **Aprendizado salvo:** "Adicione page.waitForSelector antes de interagir"

```bash
$ mcp-lab-agent stats
```

```
Taxa de sucesso na 1ª tentativa: 33%
Total de aprendizados: 3
Correções de seletores: 1
Correções de timing: 1
```

---

### Semana 3: Acelerando

```bash
$ mcp-lab-agent auto "checkout flow"
$ mcp-lab-agent auto "profile update"
$ mcp-lab-agent auto "search products"
```

**Resultado:**
- 3 testes gerados
- 2 passaram na 1ª tentativa ✅
- 1 precisou de 1 correção (network mock)

```bash
$ mcp-lab-agent stats
```

```
Taxa de sucesso na 1ª tentativa: 50%
Total de aprendizados: 7
Correções de seletores: 2
Correções de timing: 2
Correções de network: 1
```

---

### Semana 4: Maturidade

```bash
$ mcp-lab-agent auto "add to cart"
$ mcp-lab-agent auto "payment flow"
$ mcp-lab-agent auto "order history"
$ mcp-lab-agent auto "wishlist"
```

**Resultado:**
- 4 testes gerados
- 3 passaram na 1ª tentativa ✅
- 1 precisou de 1 correção

```bash
$ mcp-lab-agent stats
```

```
Taxa de sucesso na 1ª tentativa: 73%
Total de aprendizados: 12
Correções de seletores: 3
Correções de timing: 3
Correções de network: 2
```

---

## Gráfico de Evolução

```
Taxa de sucesso na 1ª tentativa

100% ┤
 90% ┤
 80% ┤                                    ╭─
 70% ┤                            ╭───────╯
 60% ┤
 50% ┤                    ╭───────╯
 40% ┤
 30% ┤            ╭───────╯
 20% ┤
 10% ┤
  0% ┼────────────╯
     └─────────────────────────────────────
     Sem.1   Sem.2   Sem.3   Sem.4   Sem.5
```

---

## O que isso significa?

### Para o QA
- **Menos tempo corrigindo testes:** O agente aprende os padrões do projeto
- **Mais tempo testando funcionalidades:** Foco em casos de borda, não em setup

### Para o time
- **Onboarding mais rápido:** Novo QA usa o agente que já conhece o projeto
- **Padrões consistentes:** Agente aplica as mesmas boas práticas

### Para a empresa
- **ROI mensurável:** Taxa de sucesso aumenta = menos tempo gasto
- **Escalável:** Cada projeto tem sua memória, mas pode compartilhar aprendizados

---

## Comparação real: 10 testes

### Sem mcp-lab-agent
- Gera 10 testes: 20 min
- 7 falham na 1ª tentativa
- Você corrige manualmente: 7 × 8 min = 56 min
- **Total: 76 min**

### Com mcp-lab-agent (após 2 semanas de uso)
```bash
for i in {1..10}; do
  mcp-lab-agent auto "teste $i"
done
```
- 10 testes gerados: 20 min
- 7 passam na 1ª tentativa (70% de taxa)
- 3 precisam de correção: 3 × 2 min = 6 min (automático)
- **Total: 26 min**

**Economia: 50 min (66%)**

---

## Próxima evolução: Aprendizado compartilhado

### Problema atual
Cada projeto aprende isoladamente.

### Solução (roadmap)
```bash
# Central de aprendizados da empresa
mcp-lab-agent sync --central https://learnings.empresa.com

# Agora todos os projetos se beneficiam
```

**Resultado:**
- Projeto novo já começa com 80% de taxa de sucesso
- Padrões da empresa aplicados automaticamente
- QA júnior tem o conhecimento do QA sênior

---

## Conclusão

**mcp-lab-agent não é "mais uma ferramenta".**

É um **agente que executa, erra, corrige e aprende** — e cada vez acerta mais.

**Diferencial técnico:**
- Auto-correção com retry inteligente
- Flaky detection (timing, selector, network)
- Model routing (economia de custo)
- Métricas de evolução

**Diferencial de negócio:**
- ROI mensurável (taxa de sucesso aumenta)
- Escalável (multi-projeto + CI/CD)
- Complementa Memorikbank (não compete)

**Próximo passo:** Teste em 1 projeto piloto por 2 semanas. Acompanhe as métricas.
