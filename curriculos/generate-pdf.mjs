#!/usr/bin/env node
/**
 * Generates PDF from Markdown resumes using Playwright
 * Run: node docs/generate-pdf.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function markdownToHtml(md) {
  let html = md;
  const tableBlockRegex = /(\|[^\n]+\|\n)(\|[-:\s|]+\|\n)((\|[^\n]+\|\n)*)/g;
  html = html.replace(tableBlockRegex, (full) => {
    const lines = full.trim().split('\n');
    const header = lines[0].split('|').slice(1, -1).map(s => s.trim());
    const data = lines.slice(2).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
    const th = header.map(h => `<th>${h}</th>`).join('');
    const trs = data.map(row => '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>').join('');
    return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  });
  html = html
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/gs, m => '<ul>' + m + '</ul>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return '<div>' + html + '</div>';
}

const template = (content, title) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.4; max-width: 800px; margin: 0 auto; padding: 24px; color: #222; }
    h1 { font-size: 22pt; margin-bottom: 4px; }
    h2 { font-size: 14pt; margin: 20px 0 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    h3 { font-size: 12pt; margin: 16px 0 8px; }
    p { margin: 8px 0; }
    ul { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    table { font-size: 10pt; margin: 12px 0; }
    th, td { text-align: left; padding: 6px 10px; }
    th { background: #f5f5f5; font-weight: 600; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 10pt; }
  </style>
</head>
<body>${content}</body>
</html>`;

function main() {
  const files = [
    { md: 'Resume_Wesley_Gomes_2025_EN.md', html: 'Resume_Wesley_Gomes_2025_EN.html', title: 'Wesley Gomes - Resume' },
    { md: 'Curriculo_Wesley_Gomes_2025_Melhorado.md', html: 'Curriculo_Wesley_Gomes_2025_PT-BR.html', title: 'Wesley Gomes - Currículo' },
    { md: 'Resume_Wesley_Gomes_2025_EN_ATS.md', html: 'Resume_Wesley_Gomes_2025_EN_ATS.html', title: 'Wesley Gomes - Resume (ATS)' },
    { md: 'Curriculo_Wesley_Gomes_2025_PT-BR_ATS.md', html: 'Curriculo_Wesley_Gomes_2025_PT-BR_ATS.html', title: 'Wesley Gomes - Currículo (ATS)' }
  ];
  for (const f of files) {
    const mdPath = join(__dirname, f.md);
    const md = readFileSync(mdPath, 'utf-8');
    const content = markdownToHtml(md);
    const fullHtml = template(content, f.title);
    const htmlPath = join(__dirname, f.html);
    writeFileSync(htmlPath, fullHtml);
    console.log('Generated:', f.html);
  }
  console.log('\nTo save as PDF: Open each .html in your browser, then Cmd+P (Mac) or Ctrl+P (Win) > "Save as PDF"');
}

main();
