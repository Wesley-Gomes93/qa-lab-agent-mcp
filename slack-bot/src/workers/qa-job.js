import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getRepoForChannel, getMcpLabAgentCmd, getCloneBaseDir } from "../config.js";

/**
 * Executa comando e retorna { stdout, stderr, code }
 */
function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (proc.stdout) proc.stdout.on("data", (d) => { stdout += d.toString(); });
    if (proc.stderr) proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

/**
 * Clona repo para dir ou faz pull se já existe.
 */
async function ensureRepo(repoUrl, branch, targetDir) {
  if (fs.existsSync(path.join(targetDir, ".git"))) {
    const r = await runCommand("git", ["pull", "origin", branch], targetDir);
    return targetDir;
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true });
  await runCommand("git", ["clone", "--depth", "1", "-b", branch, repoUrl, targetDir]);
  return targetDir;
}

/**
 * Normaliza texto vindo do Slack (menções já removidas no handler).
 * Evita falha de regex por NBSP, zero-width, links <url|texto>.
 */
export function sanitizeSlackTextForIntent(raw) {
  if (!raw) return "";
  let t = String(raw)
    .replace(/<@[A-Z0-9]+>/g, " ")
    .replace(/<#[A-Z0-9]+\|[^>]+>/g, " ")
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1")
    .replace(/<([^|>]+)>/g, "$1")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  t = t.normalize("NFKC").replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Mensagem curta para o primeiro reply no Slack (alinha expectativa ao comando real).
 */
export function buildAckMessage(intent) {
  const c = intent?.command;
  const messages = {
    generateReport:
      "Recebido: gerar relatório. Vou gerar o HTML dos aprendizados no projeto (rápido).",
    showDashboard:
      "Recebido: dashboard. Vou enviar o link do Learning Hub e o que ele mostra (instantâneo).",
    runStats: "Recebido: stats. Vou buscar as estatísticas do agente (rápido).",
    runDetect: "Recebido: detect. Vou detectar framework e estrutura de testes (rápido).",
    runTests: "Recebido: run. Vou executar os testes do projeto (pode levar alguns minutos).",
    runFlaky: "Recebido: flaky-report. Vou rodar repetições para achar instabilidade (pode demorar).",
    runExplore: "Recebido: explore. Vou mapear a página indicada e seguir o fluxo configurado.",
    runAuto: "Recebido: auto. Vou gerar/rodar testes com o agente (costuma levar 2–5 minutos).",
    runAnalyze: "Recebido: analyze. Vou rodar análise completa do projeto (2–5 minutos).",
    showHelp:
      "Não reconheci um comando específico. Vou enviar a lista de comandos e exemplos.",
  };
  return messages[c] || messages.showHelp;
}

/**
 * Extrai intent da mensagem do usuário.
 * Nunca assume "analyze" por padrão — comando inválido vira ajuda.
 */
export function parseUserIntent(text) {
  const lower = sanitizeSlackTextForIntent(text).toLowerCase();

  // ORDEM IMPORTA: comandos mais específicos primeiro

  // 1. Gerar relatório HTML
  if (/gerar\s+relat[oó]rio|gera\s+relat[oó]rio|exportar\s+html|export\s+html|gerar\s+html/i.test(lower)) {
    return { command: "generateReport" };
  }

  // 2. Analyze explícito (antes de "dashboard", para frases como "analyze o dashboard" não virarem só dashboard)
  if (/^\s*(analise|analisar|analyze)\b/i.test(lower)) {
    return { command: "runAnalyze" };
  }

  // 3. Dashboard (palavra-chave — não exige linha inteira igual; Slack costuma colar espaços/formatos)
  if (
    /^\s*(dashboard|learning\s+hub|painel|ver\s+aprendizados|relat[oó]rio\s+html)\b/i.test(lower) ||
    /\bdashboard\b/i.test(lower)
  ) {
    return { command: "showDashboard" };
  }

  // 4. Stats
  if (/^\s*(stats|estat[ií]sticas?)\b/i.test(lower)) {
    return { command: "runStats" };
  }

  // 5. Detect
  if (/^\s*(detect|detectar)\b/i.test(lower)) {
    return { command: "runDetect" };
  }

  // 6. Run
  if (/^\s*(run|executar\s+testes?|rodar\s+testes?)\b/i.test(lower)) {
    const specMatch = lower.match(/run\s+(tests\/[^\s]+\.spec\.js)/i);
    return { command: "runTests", spec: specMatch ? specMatch[1] : null };
  }

  // 7. Flaky
  if (/\bflaky\b|inst[aá]vel/i.test(lower)) {
    const runsMatch = lower.match(/--runs\s+(\d+)/i);
    return { command: "runFlaky", runs: runsMatch ? parseInt(runsMatch[1], 10) : 5 };
  }

  // 8. Explore (antes de auto)
  if (/explore|explorar|mapea|mapear|mape[ai]|verificar\s+p[aá]gina|verificar\s+tela/i.test(lower)) {
    const exploreMatch = lower.match(
      /(?:explore|explorar|mapea|mapear|mape[ai]|verificar)\s+(?:p[aá]gina|tela|a\s+tela)?\s*(?:de|da)?\s*[:\-]?\s*(.+)/i
    );
    const pages = exploreMatch ? exploreMatch[1].trim().slice(0, 200) : "página principal";
    return { command: "runExplore", explorePages: pages };
  }

  // 9. Auto — "gerar" sozinho não vira auto; precisa de contexto ou palavra auto
  if (
    /\bauto\b/i.test(lower) ||
    /\b(crie|criar)\b/i.test(lower) ||
    /\bteste[s]?\s+para\b/i.test(lower) ||
    /\bgerar\s+teste/i.test(lower)
  ) {
    const match =
      lower.match(/(?:crie|criar|auto)\s+(?:teste[s]?\s+)?(?:para\s+)?["']?([^"']+)["']?/i) ||
      lower.match(/teste[s]?\s+para\s+["']?([^"']+)["']?/i) ||
      lower.match(/\bauto\s+["']?([^"']+)["']?/i);
    const description = match ? match[1].trim().slice(0, 200) : "fluxo principal";
    return { command: "runAuto", autoDescription: description };
  }

  // 10. Help
  if (/^\s*(help|ajuda|comandos)\b/i.test(lower)) {
    return { command: "showHelp" };
  }

  return { command: "showHelp" };
}

/**
 * Executa o job QA: clona repo, roda mcp-lab-agent, retorna output.
 */
export async function runQaJob({ channelId, userMessage }) {
  const repo = getRepoForChannel();
  const { command, args } = getMcpLabAgentCmd();
  const baseDir = getCloneBaseDir();
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workDir = path.join(baseDir, runId);

  const outputs = [];
  let lastError = null;
  let cwd = workDir;

  if (repo.useLocal) {
    cwd = repo.workDir;
  } else {
    try {
      await ensureRepo(repo.url, repo.branch, workDir);
    } catch (err) {
      lastError = `Erro ao clonar repositório: ${err.message}`;
      return { ok: false, output: lastError, error: err.message };
    }
  }

  const intent = parseUserIntent(userMessage);

  try {
    // EXECUTAR COMANDO BASEADO NO INTENT
    switch (intent.command) {
      case 'generateReport':
        outputs.push("📊 Gerando relatório HTML dos aprendizados...\n");
        
        const reportScript = path.join(cwd, "generate-learning-report.js");
        if (!fs.existsSync(reportScript)) {
          outputs.push("⚠️  Script generate-learning-report.js não encontrado.");
          return { ok: false, output: outputs.join("\n") };
        }
        
        const reportRes = await runCommand("node", [reportScript], cwd);
        outputs.push(reportRes.stdout);
        if (reportRes.stderr) outputs.push(reportRes.stderr);
        
        const reportFile = path.join(cwd, "learning-report.html");
        if (fs.existsSync(reportFile)) {
          outputs.push("\n✅ Relatório HTML gerado com sucesso!");
          outputs.push(`📄 Arquivo: learning-report.html`);
          outputs.push("\n💡 O arquivo será enviado automaticamente no Slack!");
          return { ok: true, output: outputs.join("\n"), htmlFile: reportFile };
        }
        break;
      
      case 'showDashboard':
        outputs.push("📊 Dashboard de Aprendizados");
        outputs.push("");
        outputs.push("Acesse o dashboard HTML completo em:");
        outputs.push("🔗 http://localhost:3847");
        outputs.push("");
        outputs.push("O dashboard mostra:");
        outputs.push("• Total de aprendizados");
        outputs.push("• Taxa de sucesso");
        outputs.push("• Padrões identificados");
        outputs.push("• Evolução no tempo");
        outputs.push("• Recomendações");
        outputs.push("");
        outputs.push("💡 O dashboard é atualizado em tempo real!");
        outputs.push("");
        outputs.push("📥 Para exportar HTML:");
        outputs.push("   @QA Lab Agent gerar relatório");
        return { ok: true, output: outputs.join("\n") };
      
      case 'runStats':
        outputs.push("📊 Estatísticas de Aprendizado\n");
        const statsArgs = [...args, "stats"];
        const statsRes = await runCommand(command, statsArgs, cwd);
        outputs.push(statsRes.stdout);
        if (statsRes.stderr) outputs.push(statsRes.stderr);
        return { ok: true, output: outputs.join("\n") };
      
      case 'runDetect':
        outputs.push("🔍 Detectando estrutura do projeto...\n");
        const detectArgs = [...args, "detect"];
        const detectRes = await runCommand(command, detectArgs, cwd);
        outputs.push(detectRes.stdout);
        if (detectRes.stderr) outputs.push(detectRes.stderr);
        return { ok: true, output: outputs.join("\n") };
      
      case 'runFlaky':
        outputs.push("🔬 Detectando testes instáveis...\n");
        const flakyArgs = [...args, "flaky-report", "--runs", String(intent.runs || 5)];
        const flakyRes = await runCommand(command, flakyArgs, cwd);
        outputs.push(flakyRes.stdout);
        if (flakyRes.stderr) outputs.push(flakyRes.stderr);
        return { ok: true, output: outputs.join("\n") };
      
      case 'runTests':
        outputs.push("▶️  Executando testes...\n");
        const runArgs = intent.spec ? [...args, "run", intent.spec] : [...args, "run"];
        const runRes = await runCommand(command, runArgs, cwd);
        outputs.push(runRes.stdout);
        if (runRes.stderr) outputs.push(runRes.stderr);
        return { ok: true, output: outputs.join("\n") };
      
      case 'runExplore':
        outputs.push(`🔍 Explorando: ${intent.explorePages}\n`);
        
        const exploreScript = path.join(cwd, "explore-page.js");
        if (!fs.existsSync(exploreScript)) {
          outputs.push("⚠️  Script explore-page.js não encontrado no projeto.");
          outputs.push("Execute localmente: ./explore.sh \"nome da página\"");
        } else {
          const exploreEnv = {
            ...process.env,
            NON_INTERACTIVE: 'true',
            OPENAI_API_KEY: '',
            GROQ_API_KEY: '',
            GEMINI_API_KEY: '',
            QA_LAB_LLM_SIMPLE: 'llama3.2:3b'
          };
          
          const proc = spawn("node", [exploreScript, intent.explorePages], {
            cwd,
            env: exploreEnv,
            stdio: ["inherit", "pipe", "pipe"]
          });
          
          let stdout = "";
          let stderr = "";
          if (proc.stdout) proc.stdout.on("data", (d) => { stdout += d.toString(); });
          if (proc.stderr) proc.stderr.on("data", (d) => { stderr += d.toString(); });
          
          await new Promise((resolve) => proc.on("close", resolve));
          
          outputs.push("=== Mapeamento da Página ===\n" + stdout);
          if (stderr) outputs.push(stderr);
          
          if (stdout.includes("Elementos principais identificados")) {
            outputs.push("\n✅ Página mapeada com sucesso!");
            outputs.push("\n🤖 Gerando testes automaticamente...\n");
            
            const autoArgs = [...args, "auto", intent.explorePages, "--max-retries", "2"];
            const autoRes = await runCommand(command, autoArgs, cwd);
            outputs.push("=== Geração de Testes ===\n" + autoRes.stdout);
            if (autoRes.stderr) outputs.push(autoRes.stderr);
          }
        }
        return { ok: true, output: outputs.join("\n") };
      
      case 'runAuto':
        outputs.push(`🤖 Gerando teste: ${intent.autoDescription}\n`);
        const autoArgs = [...args, "auto", intent.autoDescription];
        const autoRes = await runCommand(command, autoArgs, cwd);
        outputs.push("=== mcp-lab-agent auto ===\n" + autoRes.stdout);
        if (autoRes.stderr) outputs.push(autoRes.stderr);
        if (autoRes.code !== 0) {
          outputs.push(`(exit code ${autoRes.code})`);
        }
        return { ok: true, output: outputs.join("\n") };
      
      case 'runAnalyze':
        outputs.push("🔍 Análise completa iniciada...\n");
        const analyzeArgs = [...args, "analyze"];
        const analyzeRes = await runCommand(command, analyzeArgs, cwd);
        outputs.push("=== mcp-lab-agent analyze ===\n" + analyzeRes.stdout);
        if (analyzeRes.stderr) outputs.push(analyzeRes.stderr);
        return { ok: true, output: outputs.join("\n") };
      
      case 'showHelp':
        outputs.push("🤖 Comandos Disponíveis:");
        outputs.push("");
        outputs.push("📊 **Relatórios:**");
        outputs.push("  • gerar relatório - Gera HTML");
        outputs.push("  • dashboard - Link do dashboard");
        outputs.push("  • stats - Estatísticas");
        outputs.push("");
        outputs.push("🔍 **Análise:**");
        outputs.push("  • analyze - Análise completa");
        outputs.push("  • detect - Detecta estrutura");
        outputs.push("  • explore [página] - Mapeia página");
        outputs.push("");
        outputs.push("🤖 **Testes:**");
        outputs.push("  • auto \"descrição\" - Gera testes");
        outputs.push("  • run - Executa testes");
        outputs.push("  • flaky-report - Detecta instáveis");
        outputs.push("");
        outputs.push("💡 **Exemplos:**");
        outputs.push("  @QA Lab Agent stats");
        outputs.push("  @QA Lab Agent gerar relatório");
        outputs.push("  @QA Lab Agent auto \"login\"");
        return { ok: true, output: outputs.join("\n") };
      
      default:
        outputs.push("⚠️  Comando não reconhecido.");
        outputs.push("Digite: @QA Lab Agent help");
        return { ok: false, output: outputs.join("\n") };
    }
    
    return { ok: true, output: outputs.join("\n") };
  } catch (err) {
    lastError = err.message;
    outputs.push(`Erro: ${err.message}`);
  } finally {
    if (!repo.useLocal) {
      try {
        if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true });
      } catch {}
    }
  }

  const output = outputs.join("\n\n").trim() || lastError || "Nenhum output.";
  return { ok: !lastError, output };
}
