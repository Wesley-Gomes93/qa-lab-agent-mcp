# 🔬 Pesquisa: Soluções e Dores de QA em 2025

> Baseado em relatórios (TestRail, Autonoma, BrowserStack, QASource, DEV/Forem), conteúdo LinkedIn e tendências de mercado.

---

## 📊 O que o mercado está postando/falando

### LinkedIn (2025–2026)
- **Shift-left testing** — qualidade mais cedo no ciclo
- **AI/ML testing** — testes gerados e mantidos por IA
- **QA como "hub de informação de qualidade"** — alta EQ + credibilidade técnica
- **Autonomous QA** — sistemas que exploram apps como usuários reais
- **Self-healing tests** — testes que se adaptam a mudanças de UI
- **Métricas de negócio** — rastreabilidade, custo por defeito, tempo de resolução

### Principais fontes
- TestRail Software Testing & Quality Report (4ª edição)
- Autonoma – State of QA 2025
- BrowserStack – 20 Challenges Every QA Faces
- DEV Community – QA Crisis (75% burnout)
- QASource – Top Software QA Challenges 2026

---

## 😫 As 20 Dores Principais do QA (consolidado)

| # | Dor | Frequência | Solução pregada pelo mercado |
|---|-----|------------|------------------------------|
| 1 | **Mudanças de requisitos em cima da hora** | Muito alta | Expectativa realista, comunicação clara, testes baseados em cenários de alto nível |
| 2 | **Informação insuficiente em user stories** | Muito alta | Cenários baseados em use cases genéricos, menos dependência de specs detalhadas |
| 3 | **Pouca experiência com automação** | Muito alta | Ferramentas que não exigem código (codeless/low-code) |
| 4 | **Colaboração fraca dev ↔ QA** | Muito alta | Shift-left, QA envolvido desde o início |
| 5 | **Testes falham em condições reais** | Muito alta | Device farms, testes em real devices, condições de rede reais |
| 6 | **Priorização de test cases** | Alta | IA para priorizar, risk-based testing |
| 7 | **Dependências entre times** | Alta | Melhor visibilidade, testes em containers |
| 8 | **Testes em múltiplas plataformas** | Alta | BrowserStack, Sauce Labs, device farms |
| 9 | **Alta rotatividade em QA** | Alta | Automação, menos trabalho repetitivo |
| 10 | **Gargalos de performance** | Média | Performance testing, APM |
| 11 | **Sprints de QA e dev sobrepostos** | Média | Integração contínua, pipelines alinhados |
| 12 | **Regressão dentro de prazos apertados** | Média | Automação inteligente, smoke + subset |
| 13 | **Pouca colaboração com stakeholders** | Média | Dashboards, métricas de negócio |
| 14 | **Falsos positivos/negativos** | Média | Self-healing, retry inteligente, ambiente estável |
| 15 | **Orçamento limitado para QA** | Média | ROI claro, automação eficiente |
| 16 | **Compliance e LGPD** | Média | Dados sintéticos, anonimização |
| 17 | **Excesso de testes manuais** | Alta | Automação gradual, codeless |
| 18 | **Builds falhando com frequência** | Média | CI estável, testes mais confiáveis |
| 19 | **Escalar automação** | Muito alta | IA para geração, manutenção reduzida |
| 20 | **Pouca visibilidade em progresso** | Alta | Dashboards, relatórios, integração com Jira |

---

## 🚀 Soluções que o mercado está vendendo

### 1. **Autonoma** (getautonoma.com)
- **Proposta:** QA 2.0 – “diga o que testar em linguagem natural ou mostre por gravação”
- **Diferencial:** testes que se adaptam a mudanças de UI (intenção em linguagem natural)
- **Papel:** “Test Workflow Designer” – qualquer um que consiga descrever pode criar teste
- **Foco:** empresas tech-native, regressão em múltiplos devices, shift-left

### 2. **Aurick** (aurick.ai)
- **Proposta:** QA autônomo – fornece URL e começa a testar
- **Diferencial:** explora o app como usuário real, sem scripts
- **Foco:** zero setup, zero manutenção, self-healing

### 3. **Autonomous QA (conceito genérico)**
- Exploração em tempo real (não scripts pré-definidos)
- Testes que “pensam” como QA (curioso, adaptável)
- Relatórios com contexto (screenshots, logs, passos de reprodução)
- Redução de 65% no esforço manual, ~53% mais produtividade na manutenção (Omdia)

### 4. **BrowserStack / Device Farms**
- Testes em dispositivos e navegadores reais
- Condições de rede, localização, performance
- Foco em testes que falham só em produção

### 5. **AI-driven test strategy**
- ML indica quais testes têm mais valor
- Otimização de cobertura vs tempo de execução
- **Predictive quality:** IA sugere onde bugs são mais prováveis (por código, histórico, comportamento)

---

## 📈 Iniciativas futuras (TestRail 2025)

| Iniciativa | % |
|------------|---|
| Aumentar automação | 43% |
| Shift-left | 39% |
| Ambientes e dados de teste melhores | 35% |

**Principais bloqueios:**
- Integrar novas ferramentas ao fluxo atual
- Contratar e reter engenheiros de automação
- Acompanhar evolução de ferramentas e IA

---

## 🎯 Desafios top 3 (TestRail)

1. **E2E em sistemas integrados** (33%) – ambientes estáveis, coordenação entre times
2. **Desenvolvimento de testes automatizados** (32%) – testes frágeis, falta de gente qualificada
3. **QA envolvido tarde no ciclo** (32%) – atrasos, desalinhamento, modo reativo

---

## 💡 Oportunidades para mcp-lab-agent

### Já cobre
- Detecção automática de frameworks
- Geração de testes via LLM
- Análise de falhas e sugestão de correções
- Bug reports em Markdown
- Suporte multi-framework (Cypress, Playwright, Jest, etc.)

### Gaps identificados (vs. concorrentes)

| Gap | Oportunidade |
|-----|--------------|
| **Priorização de testes** | Tool `prioritize_tests` – sugestão de quais rodar primeiro com base em risco/mudanças |
| **Self-healing de seletores** | Sugerir alternativas quando seletores falham (já existe `suggest_fix` – evoluir) |
| **Linguagem natural sem código** | Prompt: “Teste o fluxo de login” → gerar spec completo (já existe `generate_tests` – melhorar UX) |
| **Shift-left** | Integração com pre-commit / pre-push para rodar smoke em arquivos alterados |
| **Visibilidade/Relatórios** | Dashboard ou export de métricas (bugs evitados, tempo economizado, cobertura) |
| **Condições reais** | Integração com BrowserStack/Sauce Labs via configuração |
| **Traceabilidade** | Mapeamento teste ↔ user story ↔ código |
| **Test data** | Sugestões de dados sintéticos ou fixtures para cenários comuns |

### Roadmap sugerido (prioridade)

1. **Priorização inteligente** – `prioritize_tests` com base em git diff / riscos
2. **Self-healing melhorado** – alternativas de seletores quando `suggest_fix` detecta falha
3. **Relatórios de negócio** – template de bug report com custo estimado, impacto
4. **Integração CI (shift-left)** – comando/flag para smoke em alterações locais
5. **Linguagem natural** – prompts templates tipo “como QA descreveria” para `generate_tests`

---

## 📚 Métricas que times querem rastrear (TestRail)

**Atuais:** defeitos em prod (60%), pass/fail (70%), automação criada (43%), execução (42%).

**Desejados:**
- Traceabilidade de testes
- Tempo até resolução
- Custo por defeito
- ROI da automação

**Valor do mcp-lab-agent:** bug reports estruturados já contribuem para tempo de resolução e custo por defeito.

---

## 🔗 Fontes

- [BrowserStack – 20 Challenges](https://www.browserstack.com/guide/challenges-faced-by-qa)
- [TestRail – Software Testing Report 4ª ed.](https://www.testrail.com/blog/fourth-edition-software-testing-and-quality-report)
- [Autonoma – State of QA 2025](https://www.getautonoma.com/blog/state-of-qa-2025)
- [DEV – QA Crisis (Aurick)](https://forem.com/esha_suchana_3514f571649c/the-qa-crisis-why-75-of-software-teams-are-burning-out-and-the-ai-solution-thats-changing-3ap4)
- [QASource – Top QA Challenges 2026](https://blog.qasource.com/top-software-qa-challanges)

---

*Documento gerado para suportar decisões de produto e roadmap do mcp-lab-agent.*
