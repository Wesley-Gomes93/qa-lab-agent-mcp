# Changelog

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
