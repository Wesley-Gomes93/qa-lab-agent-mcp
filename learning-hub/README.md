# QA Lab Learning Hub

API centralizada para aprendizados do **mcp-lab-agent**. Permite acumular memória entre projetos e ver métricas em um dashboard.

## Rodar

```bash
# Via npx (sem clonar)
npx mcp-lab-agent learning-hub

# Ou local
npm run learning-hub
# ou: node learning-hub/src/server.js
```

Porta padrão: **3847**. Acesse http://localhost:3847 para o dashboard.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Dashboard web (taxa de sucesso, padrões, recomendações) |
| POST | `/learning` | Recebe learnings do agente |
| GET | `/patterns` | Padrões agregados (`?framework=&projectId=&limit=`) |
| GET | `/health` | Health check |

## Configurar o agente para enviar ao Hub

No `.env` do seu projeto:

```env
LEARNING_HUB_URL=http://localhost:3847
LEARNING_HUB_PROJECT_ID=meu-projeto
```

O agente enviará automaticamente cada aprendizado para o Hub (assíncrono, não bloqueia).

## Formato POST /learning

```json
{
  "learnings": [
    {
      "type": "element_not_rendered",
      "framework": "playwright",
      "request": "login flow",
      "fix": "await element.waitFor({ state: 'attached' })",
      "success": false,
      "timestamp": "2025-03-18T..."
    }
  ]
}
```

## Armazenamento

Por padrão, dados em `./data/learnings.json`. Configure:

```env
LEARNING_HUB_DATA=/caminho/para/data
LEARNING_HUB_PORT=3847
```

## Escalar

Para produção: troque `store.js` por SQLite ou Postgres. A API permanece a mesma.
