import { runQaJob, parseUserIntent, buildAckMessage, sanitizeSlackTextForIntent } from "../workers/qa-job.js";
import { formatReportForSlack, formatSimpleMessage } from "../utils/report.js";

export function registerAppMention(app) {
  app.event("app_mention", async ({ event, client, say }) => {
    const raw = (event.text || "").replace(/<@[A-Z0-9]+>/g, " ");
    const text = sanitizeSlackTextForIntent(raw);
    const channel = event.channel;
    const threadTs = event.thread_ts || event.ts;
    const intent = parseUserIntent(text);

    await say({
      text: buildAckMessage(intent),
      thread_ts: threadTs,
    });

    setImmediate(async () => {
      try {
        const { ok, output, htmlFile } = await runQaJob({ channelId: channel, userMessage: text });

        const blocks = ok
          ? formatReportForSlack(output)
          : formatSimpleMessage(`Erro:\n\`\`\`${output}\`\`\``);

        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: ok ? "Relatório concluído." : "Ocorreu um erro.",
          blocks,
        });
        
        // Se gerou HTML, fazer upload
        if (htmlFile && ok) {
          try {
            const fs = await import('fs');
            await client.files.uploadV2({
              channel_id: channel,
              thread_ts: threadTs,
              file: fs.createReadStream(htmlFile),
              filename: 'learning-report.html',
              title: '📊 Relatório de Aprendizados QA Lab',
              initial_comment: '✅ Relatório HTML gerado! Baixe e abra no navegador.',
            });
          } catch (uploadErr) {
            console.error('Erro ao fazer upload do HTML:', uploadErr);
          }
        }
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
