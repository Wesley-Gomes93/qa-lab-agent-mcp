# Configuração de device para testes mobile

O `run_tests` detecta automaticamente o device/configuration para Appium e Detox.

## Comandos

```bash
# Roda todos os testes (detecta device automaticamente)
npx mcp-lab-agent run

# Roda um spec específico
npx mcp-lab-agent run specs/login.spec.js

# Força um device/configuration
npx mcp-lab-agent run specs/login.spec.js --device iPhone_15

# Desativa auto-fix de seletor
npx mcp-lab-agent run specs/login.spec.js --no-auto-fix
```

**Via IDE/Chat:** *"Roda o teste specs/login.spec.js"* — o agente usa `run_tests` com device e auto-fix.

## Fontes (ordem de prioridade)

1. **Parâmetro `device`** — Passado explicitamente na chamada
2. **qa-lab-agent.config.json** — Chave `device` ou `mobile`
3. **Variáveis de ambiente** — `DETOX_CONFIGURATION`, `APPIUM_UDID`, `APPIUM_DEVICE_NAME`
4. **wdio.conf.js** — capabilities (deviceName, udid, platformName)
5. **.detoxrc.js** — primeira configuration em `configurations`

---

## Exemplo completo: qa-lab-agent.config.json

Arquivo na raiz do projeto:

```json
{
  "device": {
    "configuration": "iPhone_15",
    "deviceName": "Pixel_5_API_34",
    "udid": "emulator-5554",
    "platformName": "iOS"
  },
  "mcp": {
    "description": "Para a IDE: adicione ao ~/.config/mcp-lab-agent/mcp.json",
    "command": "npx",
    "args": ["-y", "mcp-lab-agent@latest"],
    "cwd": "${workspaceFolder}"
  },
  "slack": {
    "repo": "https://github.com/seu-org/mcp-lab-agent.git",
    "branch": "main"
  }
}
```

### Campos de `device`

| Campo | Uso | Exemplo |
|-------|-----|---------|
| `configuration` | Detox — nome da config em `.detoxrc.js` | `"iPhone_15"`, `"Pixel_5_API_34"` |
| `deviceName` | Appium — nome do device/emulador | `"Pixel 5 API 34"`, `"iPhone 15"` |
| `udid` | Appium — ID único (Android: emulator-5554) | `"emulator-5554"`, `"00008030-001..."` |
| `platformName` | Appium — plataforma | `"Android"`, `"iOS"` |

### Por framework

- **Detox:** usa `configuration` → `detox test --configuration iPhone_15`
- **Appium/WDIO:** usa `deviceName`, `udid` → env `APPIUM_DEVICE_NAME`, `APPIUM_UDID`

---

## Alternativa: variáveis de ambiente

No `.env` do projeto:

```
DETOX_CONFIGURATION=iPhone_15
APPIUM_UDID=emulator-5554
APPIUM_DEVICE_NAME=Pixel_5_API_34
```

---

## Alternativa: wdio.conf.js (Appium)

O agente lê as capabilities:

```javascript
capabilities: [{
  platformName: 'Android',
  'appium:deviceName': 'Pixel_5_API_34',
  'appium:udid': 'emulator-5554',
  // ...
}]
```

## Auto-fix de seletor

Quando `run_tests` é chamado com `spec` e falha por seletor (element not found, selector, etc.):

1. O agente aplica correção via LLM (seletor mais resiliente)
2. Reescreve o arquivo de teste
3. Executa novamente

**Default:** `autoFixSelector: true` para projetos mobile quando `spec` é informado.
