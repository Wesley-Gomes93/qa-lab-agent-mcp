import { runQaJob } from "../workers/qa-job.js";
import { formatReportForSlack, formatSimpleMessage } from "../utils/report.js";

export function registerAppMention(app) {
  app.event("app_mention", async ({ event, client, say }) => {
    const text = (event.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
    const channel = event.channel;
    const threadTs = event.thread_ts || event.ts;

    await say({
      text: "Tarefa recebida. Vou analisar o projeto e executar os testes. Isso pode levar 2–5 minutos.",
      thread_ts: threadTs,
    });

    setImmediate(async () => {
      try {
        const { ok, output } = await runQaJob({ channelId: channel, userMessage: text });

        const blocks = ok
          ? formatReportForSlack(output)
          : formatSimpleMessage(`Erro:\n\`\`\`${output}\`\`\``);

        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: ok ? "Relatório concluído." : "Ocorreu um erro.",
          blocks,
        });
      } catch (err) {
        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `Erro ao processar: ${err.message}`,
        });
      }
    });
  });
}
