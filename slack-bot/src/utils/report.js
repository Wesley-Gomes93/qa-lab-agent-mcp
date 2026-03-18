/**
 * Formata a saída do mcp-lab-agent para mensagem do Slack.
 * Slack limita mensagens em ~4000 caracteres; blocos têm limites menores.
 */
export function formatReportForSlack(stdout) {
  const lines = stdout.split("\n").filter(Boolean);
  const blocks = [];
  const maxBlock = 2900;

  let buffer = "";
  for (const line of lines) {
    if (buffer.length + line.length + 1 > maxBlock) {
      if (buffer) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "```\n" + buffer.trim() + "\n```" } });
        buffer = "";
      }
    }
    buffer += line + "\n";
  }
  if (buffer.trim()) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "```\n" + buffer.trim() + "\n```" } });
  }

  if (blocks.length === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Nenhum output._" } });
  }

  return [
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "*Relatório QA Lab Agent*" } },
    ...blocks,
    { type: "divider" },
  ];
}

export function formatSimpleMessage(text) {
  return [{ type: "section", text: { type: "mrkdwn", text } }];
}
