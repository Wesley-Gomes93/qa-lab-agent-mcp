# Contributing

## Setup

```bash
git clone https://github.com/Wesley-Gomes93/qa-lab-agent-mcp.git
cd qa-lab-agent-mcp
npm install
npm run build
npm test
```

## Scripts

| Command | Description |
|--------|-------------|
| `npm run build` | Bundle `src/index.js` → `dist/` (tsup) |
| `npm test` | Vitest |
| `npm run test:coverage` | Coverage |
| `npm run lint` | ESLint |

## Pull requests

- Keep changes focused on one topic.
- Run `npm run lint` and `npm test` before pushing.
- Update `CHANGELOG.md` for user-visible changes.

## Package name

The npm package is **`mcp-lab-agent`**. This repository is the canonical source for releases.
