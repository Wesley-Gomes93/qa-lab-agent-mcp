import path from "node:path";
import fs from "node:fs";
import { resolveLLMProvider } from "./llm-router.js";
import { detectProjectStructure, inferFrameworkFromFile } from "./project-structure.js";

const PROJECT_ROOT = process.cwd();

export async function callLlm(provider, apiKey, baseUrl, model, systemPrompt, userPrompt) {
  if (provider === "gemini") {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function applySelectorFixAndRetry(testFilePath, errorOutput, framework) {
  const structure = detectProjectStructure();
  const fw = framework || inferFrameworkFromFile(testFilePath.split("/").pop(), structure);
  const fullPath = path.join(PROJECT_ROOT, testFilePath.replace(/^\//, "").replace(/\\/g, "/"));
  if (!fs.existsSync(fullPath)) return { applied: false };

  let testCode = "";
  try {
    testCode = fs.readFileSync(fullPath, "utf8");
  } catch {
    return { applied: false };
  }

  const llm = resolveLLMProvider("complex");
  if (!llm.apiKey) return { applied: false };
  const { provider, apiKey, baseUrl, model } = llm;

  const systemPrompt = `Você é um especialista em testes E2E. O teste falhou porque um seletor não encontrou o elemento.
Retorne APENAS em JSON (sem markdown) com a chave:
- codigoCorrigido: string (o ARQUIVO COMPLETO do teste corrigido, com imports e toda a estrutura. Substitua o seletor quebrado por um mais resiliente: data-testid, role, ~accessibility-id, ou XPath relacional com tipo específico.)

Framework: ${fw}. Priorize seletores estáveis.`;

  const userPrompt = `Output do erro:\n---\n${(errorOutput || "").slice(0, 8000)}\n---\n\nCódigo atual:\n---\n${testCode.slice(0, 6000)}\n---`;

  try {
    let raw = await callLlm(provider, apiKey, baseUrl, model, systemPrompt, userPrompt);
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const data = JSON.parse(raw);
    const fixed = (data.codigoCorrigido || "").trim();
    if (fixed.length > 50 && (/describe|it\(|test\(|cy\.|page\.|\$\(/.test(fixed))) {
      fs.writeFileSync(fullPath, fixed, "utf8");
      return { applied: true };
    }
  } catch {}
  return { applied: false };
}
