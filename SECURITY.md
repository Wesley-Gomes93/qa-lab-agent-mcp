# Security policy

## Reporting a vulnerability

Please report security issues **privately** via [GitHub Security Advisories](https://github.com/Wesley-Gomes93/qa-lab-agent-mcp/security/advisories/new) for this repository, or open a draft security advisory if you prefer not to disclose details in public issues.

Include:

- Description of the issue and impact
- Steps to reproduce (if applicable)
- Affected versions / environment (Node.js, OS)

## Scope

This project runs test commands and may invoke LLM APIs when configured. Treat API keys and `.env` files as secrets; never commit them.

## Supported versions

Security fixes are applied to the latest published `mcp-lab-agent` on npm when issues are confirmed.
