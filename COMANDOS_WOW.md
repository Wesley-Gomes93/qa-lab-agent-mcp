# 🎭 Comandos "WOW" para o Chat do Cursor

Estes comandos vão impressionar quem ver o agente funcionando.

---

## 🤖 1. Modo Autônomo (O Básico Surpreendente)

```
"Modo autônomo: gere teste para login"
```

**O que acontece:**
- Gera o teste
- Executa
- Se falhar: analisa, corrige e tenta de novo
- Aprende com o erro
- Mostra cada tentativa em tempo real

**Wow factor:** Vê o agente "pensando" e corrigindo sozinho.

---

## 🏥 2. Health Check (Diagnóstico Instantâneo)

```
"Faça um health check completo do QA"
```

**O que acontece:**
- Analisa frameworks, testes, cobertura, aprendizados
- Dá uma nota de 0-100
- Lista recomendações específicas

**Exemplo de resposta:**
```
🚀 Health Check do QA

Nota: 85/100

Frameworks: cypress, jest
Testes: 42 arquivo(s)
Taxa de sucesso (1ª tentativa): 78%
Aprendizados: 25
Última execução: ✅ passou

Recomendações:
- ✅ Projeto em excelente estado!
- 💡 Continue usando qa_auto para manter a taxa alta
```

**Wow factor:** Nota + recomendações em segundos.

---

## 💡 3. Sugestão Inteligente (IA Proativa)

```
"Sugira qual teste eu deveria criar agora"
```

**O que acontece:**
- Analisa testes existentes
- Detecta gaps de cobertura
- Lê `qa-lab-flows.json` (se existir)
- Sugere próximos testes por prioridade

**Exemplo de resposta:**
```
💡 Sugestões de Próximos Testes

1. checkout flow (high)
   - Fluxo crítico sem cobertura detectada
   - Framework: cypress
   - Comando: mcp-lab-agent auto "checkout flow"

2. API health check (medium)
   - Backend detectado mas sem testes de API
   - Framework: jest
   - Comando: mcp-lab-agent auto "API health check"
```

**Wow factor:** Agente sugere o que fazer (não espera você pedir).

---

## 🔮 4. Predição de Flaky (Visão do Futuro)

```
"Preveja quais testes vão ficar flaky"
```

**O que acontece:**
- Analisa código dos testes
- Detecta padrões de risco:
  - Seletores CSS frágeis
  - Waits fixos
  - Chamadas de rede sem mock
  - Valores não-determinísticos
- Classifica risco: ALTO, MÉDIO, BAIXO

**Exemplo de resposta:**
```
🔮 Predição de Testes Flaky

cypress/e2e/checkout.cy.js — Risco: 🔴 ALTO
  - Usa seletores CSS (frágeis)
  - Interações sem wait explícito
  - Chamadas de rede sem mock

cypress/e2e/login.cy.js — Risco: 🟢 BAIXO
  - Usa data-testid (estável)

💡 Recomendação: Refatore testes de risco ALTO antes que se tornem flaky.
```

**Wow factor:** Prevê problemas antes de acontecerem.

---

## 📊 5. Benchmark da Indústria (Comparação)

```
"Compare meu projeto com padrões da indústria"
```

**O que acontece:**
- Compara suas métricas com benchmarks
- Mostra onde você está: acima, na média ou abaixo
- Dá veredito

**Exemplo de resposta:**
```
📊 Benchmark: Seu Projeto vs. Indústria

Seu Projeto:
- Testes: 42 (indústria: ~50)
- Taxa de sucesso (1ª tentativa): 78% (indústria: ~85%)
- Aprendizados: 25

Indústria (média):
- Cobertura: 70-80%
- Taxa de sucesso: 85%
- Testes por projeto: ~50

Veredito: ✅ Na média da indústria.
```

**Wow factor:** Contexto externo (não só métricas isoladas).

---

## ⏳ 6. Viagem no Tempo (Evolução)

```
"Mostre a evolução do agente nos últimos 30 dias"
```

**O que acontece:**
- Mostra timeline de aprendizados
- Taxa de sucesso por data
- Top correções aplicadas
- Tendência (melhorando, estável, começando)

**Exemplo de resposta:**
```
⏳ Evolução do Agente

Período: Últimos 30 dias

Timeline:
2026-03-01: 3 teste(s), 33% sucesso
2026-03-08: 5 teste(s), 60% sucesso
2026-03-15: 4 teste(s), 75% sucesso
2026-03-17: 2 teste(s), 100% sucesso

Top Aprendizados:
- 8 correção(ões) de seletores
- 4 correção(ões) de timing

Tendência: 📈 Melhorando
```

**Wow factor:** Visualiza o aprendizado ao longo do tempo.

---

## 🎯 Sequência "Wow" Completa (Demo)

Use esta sequência para impressionar:

```
1. "Faça um health check do QA"
   → Mostra nota + diagnóstico

2. "Sugira qual teste criar"
   → IA sugere próximo teste

3. "Modo autônomo: gere teste para [sugestão]"
   → Gera, roda, corrige, aprende

4. "Mostre a evolução do agente"
   → Timeline de aprendizados

5. "Preveja quais testes vão ficar flaky"
   → Predição de riscos

6. "Compare com a indústria"
   → Benchmark
```

**Tempo total:** 3-5 minutos
**Impacto:** 🤯

---

## 💬 Comandos Naturais (Funcionam!)

```
"Qual a saúde do meu QA?"
"O que devo testar agora?"
"Quais testes vão dar problema?"
"Como estou comparado com outras empresas?"
"O agente está melhorando?"
"Viaje no tempo e mostre a evolução"
```

**Wow factor:** Linguagem natural. Sem comandos técnicos.

---

## 🎬 Roteiro de Apresentação (5 min)

### Minuto 1: Health Check
```
"Faça um health check do QA"
```
**Resultado:** Nota 85/100, recomendações

### Minuto 2: Sugestão Inteligente
```
"Sugira qual teste criar"
```
**Resultado:** Lista priorizada (checkout, API, etc.)

### Minuto 3: Modo Autônomo
```
"Modo autônomo: gere teste para checkout"
```
**Resultado:** Gera → executa → corrige → aprende (ao vivo)

### Minuto 4: Predição
```
"Preveja quais testes vão ficar flaky"
```
**Resultado:** Lista de riscos (ALTO, MÉDIO, BAIXO)

### Minuto 5: Evolução
```
"Mostre a evolução do agente"
```
**Resultado:** Timeline, tendência melhorando

**Impacto:** 🤯 "Isso é IA de verdade"

---

## 🚀 Comandos Avançados (Para Impressionar Mais)

### Combo 1: Diagnóstico + Ação
```
"Faça health check e execute o que for necessário"
```

### Combo 2: Análise + Predição
```
"Analise todos os testes e preveja problemas futuros"
```

### Combo 3: Benchmark + Plano
```
"Compare com a indústria e sugira como melhorar"
```

---

## 🎯 Por que isso é "Wow"?

### Outras ferramentas:
- Você pede: "gere teste"
- Ferramenta: gera teste
- Você: corrige manualmente

### mcp-lab-agent:
- Você pede: "qual a saúde do QA?"
- Agente: analisa tudo, dá nota, sugere próximos passos
- Você pede: "modo autônomo"
- Agente: gera, executa, corrige, aprende
- Você pede: "mostre a evolução"
- Agente: timeline de aprendizados, tendência

**Diferença:** Não é reativo. É **proativo e inteligente**.

---

## 📋 Checklist de Demo

Antes de apresentar:

1. [ ] Rode alguns testes com `qa_auto` (para ter aprendizados)
2. [ ] Crie `qa-lab-flows.json` com fluxos do projeto (opcional)
3. [ ] Tenha alguns testes existentes (para predição)
4. [ ] Reinicie o Cursor (para garantir que está na v2.0.1)

Durante a demo:

1. [ ] Comece com "health check" (impacto visual)
2. [ ] Mostre "sugestão" (IA proativa)
3. [ ] Execute "modo autônomo" (vê corrigindo ao vivo)
4. [ ] Finalize com "evolução" (prova de aprendizado)

---

**TL;DR:** Use `qa_health_check`, `qa_suggest_next_test`, `qa_predict_flaky` e `qa_time_travel` para impressionar. São comandos que nenhuma outra ferramenta tem.
