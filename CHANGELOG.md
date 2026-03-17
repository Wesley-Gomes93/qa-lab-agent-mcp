# Changelog

## [2.0.1] - 2026-03-17

### 🏢 Suporte Corporativo

#### Ollama (LLMs Locais)
- **100% offline:** Funciona sem APIs externas
- **Detecção automática:** Se nenhuma API key configurada, usa `http://localhost:11434`
- **Configurável:** `OLLAMA_BASE_URL` para servidor interno
- **Compliance:** Dados não saem do ambiente corporativo

#### LLM Customizado
- **Endpoint interno:** `QA_LAB_LLM_BASE_URL` para LLM da empresa
- **API key customizada:** `QA_LAB_LLM_API_KEY`

### 🎯 Ferramentas "Wow" (IA Proativa)

#### `qa_health_check`
- **Diagnóstico completo:** Analisa frameworks, testes, cobertura, aprendizados
- **Nota 0-100:** Score de saúde do QA
- **Recomendações:** Lista ações específicas
- **Chat:** "Faça um health check do QA"

#### `qa_suggest_next_test`
- **IA proativa:** Sugere qual teste criar a seguir
- **Priorização:** HIGH, MEDIUM, LOW
- **Baseado em:** Gaps de cobertura, fluxos críticos, qa-lab-flows.json
- **Chat:** "Sugira qual teste criar"

#### `qa_predict_flaky`
- **Predição:** Analisa testes e prevê quais vão ficar flaky
- **Classificação de risco:** ALTO, MÉDIO, BAIXO
- **Detecta:** Seletores frágeis, waits inadequados, network sem mock
- **Chat:** "Preveja quais testes vão dar problema"

#### `qa_compare_with_industry`
- **Benchmark:** Compara com padrões da indústria
- **Métricas:** Cobertura, taxa de sucesso, total de testes
- **Veredito:** Acima, na média ou abaixo
- **Chat:** "Compare meu projeto com a indústria"

#### `qa_time_travel`
- **Evolução temporal:** Timeline de aprendizados
- **Tendência:** Melhorando, estável ou começando
- **Períodos:** 7d, 30d, all
- **Chat:** "Mostre a evolução do agente nos últimos 30 dias"

### 📚 Documentação

- **CONFIGURACAO_CORPORATIVA.md:** Guia completo para ambientes com APIs bloqueadas
- **COMANDOS_WOW.md:** Comandos que impressionam no chat
- **README:** Seção atualizada com setup do Ollama

---

## [2.0.0] - 2026-03-17

### 🚀 Transformação: Agente Autônomo

**Novo pitch:** Agente autônomo de QA que aprende com os próprios erros.

### ✨ Novas Features

#### 🤖 Modo Autônomo (`qa_auto`)
- **Loop completo:** gera teste → executa → se falhar: analisa, corrige e tenta de novo → aprende
- **Auto-correção:** Usa LLM para analisar falhas e aplicar correções automaticamente
- **Retry inteligente:** Configurável via `--max-retries` (default: 3)
- **Disponível via:**
  - CLI: `mcp-lab-agent auto "login flow" --max-retries 5`
  - MCP chat: "Modo autônomo: gere teste para checkout"

#### 📊 Sistema de Learning
- **Memória de aprendizados:** Salva correções bem-sucedidas em `.qa-lab-memory.json`
- **Melhoria contínua:** Usa aprendizados anteriores para gerar testes mais assertivos
- **Métricas detalhadas:**
  - Total de aprendizados
  - Correções bem-sucedidas
  - Correções de seletores
  - Correções de timing
  - Testes gerados
  - Taxa de sucesso na 1ª tentativa

#### 📈 Comando `stats`
- CLI: `mcp-lab-agent stats`
- MCP tool: `qa_learning_stats`
- Mostra evolução do agente ao longo do tempo

### 🔧 Melhorias

- **CLI expandido:** Novos comandos `auto` e `stats`
- **Help atualizado:** Documentação inline completa
- **Escalabilidade:** Seção no README sobre uso em CI/CD, multi-projeto e métricas exportáveis
- **Diagrama arquitetural:** Atualizado para incluir o loop autônomo e sistema de learning
- **Suporte a Ollama:** LLMs locais (100% offline) para ambientes corporativos
- **LLM customizado:** Suporte a endpoints internos via `QA_LAB_LLM_BASE_URL`

### 📚 Documentação

- **README:** Reescrito com novo pitch e foco em autonomia
- **Seção Escalabilidade:** Como usar em empresas (CI/CD, multi-projeto, métricas)
- **Quick Start:** Prioriza modo autônomo CLI

### 🎯 Diferencial

Antes: Assistente de QA que gera testes
Agora: **Agente autônomo que gera, executa, corrige e aprende**

---

## [1.1.2] - 2026-03-16

### Features anteriores
- Detecção automática de 15+ frameworks
- Geração de testes via LLM (Groq, Gemini, OpenAI)
- Análise de falhas com IA
- Browser mode (Playwright)
- Flaky detection
- Model routing
- Project memory
- Agentes especializados
- CLI básico (detect, route, list)
