# Frameworks Suportados

O MCP Lab Agent detecta e executa testes automaticamente para os seguintes frameworks:

## E2E / UI Testing

| Framework | Detecção | Comando | Tipo |
|-----------|----------|---------|------|
| **Cypress** | `cypress` no package.json | `npx cypress run` | Web E2E |
| **Playwright** | `@playwright/test` ou `playwright` | `npx playwright test` | Web E2E |
| **WebdriverIO** | `webdriverio` ou `@wdio/cli` | `npx wdio run` | Web E2E |

## Unit / Integration Testing

| Framework | Detecção | Comando | Tipo |
|-----------|----------|---------|------|
| **Jest** | `jest` no package.json | `npx jest` | Unit/Integration |
| **Vitest** | `vitest` no package.json | `npx vitest run` | Unit/Integration |
| **Mocha** | `mocha` no package.json | `npx mocha` | Unit/Integration |
| **Jasmine** | `jasmine` no package.json | `npx jasmine` | Unit/Integration |

## Mobile Testing

| Framework | Detecção | Comando | Tipo |
|-----------|----------|---------|------|
| **Appium** | `appium` ou `appium-webdriverio` | `npx wdio run` | Mobile (iOS/Android) |
| **Detox** | `detox` no package.json | `npx detox test` | Mobile (React Native) |

## API Testing

| Framework | Detecção | Comando | Tipo |
|-----------|----------|---------|------|
| **Supertest** | `supertest` no package.json | `npm test` | API REST |
| **Pactum** | `pactum` ou `@pactum/pactum` | `npm test` | API REST |

## Python Testing

| Framework | Detecção | Comando | Tipo |
|-----------|----------|---------|------|
| **Robot Framework** | `robotframework` no requirements.txt | `robot tests/` | Keyword-driven |
| **pytest** | `pytest` no requirements.txt | `pytest` | Unit/Integration |
| **Behave** | `behave` no requirements.txt | `behave` | BDD |

## Detecção Automática

O MCP analisa:

1. **Node.js/JavaScript/TypeScript**: `package.json` (dependencies + devDependencies)
2. **Python**: `requirements.txt`
3. **Pastas de teste**: `tests/`, `test/`, `e2e/`, `cypress/`, `playwright/`, `specs/`, `__tests__/`, `integration/`, `unit/`, `functional/`, `robot/`, `features/`, `mobile/`, `api/`

## Uso

Não é necessário especificar o framework. O MCP detecta automaticamente:

```
"Rode os testes" → detecta e executa automaticamente
"Gere um teste de API" → detecta framework e gera template
"Analise as falhas" → funciona com qualquer framework
```

## Suporte Futuro

Planejado para próximas versões:

- **Cucumber** (BDD JavaScript)
- **TestCafe** (E2E)
- **Nightwatch** (E2E)
- **Karate** (API)
- **K6** (Performance)
- **Locust** (Performance Python)
